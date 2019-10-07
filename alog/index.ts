// Copyright (C) 2019 rameshvk. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file.

interface Event<T> {
  ts: Date;
  level: "DEBUG" | "INFO" | "ERROR" | "WARN";
  payload: T;
}

type Url = string;
type PostItems<T> = (items: Event<T>[]) => Promise<number>;

// Log provides asynchronous logging with various levels
//
// If the constructor is called with a handler, that handler is called
// to actually write the items.  If the constructor is passed a URL,
// then the fetch API is used to post to that URL.  The post contains
// the "current time" as seen by the client and the set of events. The
// payload is JSON of {now, events} where each event is {ts, level,
// payload}
//
// Debug level messages are not sent directly but instead they get
// queued locally.  If a warn or error level message appears, then the
// debug messages are sent.  The debug message buffer size can be
// specified  in second (but optional) argument to the constructor.
export class Log<T> {
  private q: Queue<Event<T>>;
  private stash: Event<T>[];
  private maxStash: number;

  constructor(
    post: PostItems<T> | Url,
    storage: Storage<Event<T>>,
    bufSize: number = 20
  ) {
    if (typeof post === "string") {
      let url = post;
      post = items => this._post(url, items);
    }
    post = retry(post, Infinity, 500, 30000, 0.2);
    this.q = new Queue<Event<T>>(post, storage);
    this.stash = [];
    this.maxStash = bufSize;
  }

  // push is mainly there for the init use case: stale entries
  // are pushed with the ability to wait for confirmation that this
  // was written to storage.
  push(e: Event<T>) {
    return this.q.push(e);
  }

  debug(payload: T) {
    this.stash.push({ ts: new Date(), level: "DEBUG", payload: payload });
    while (this.stash.length > this.maxStash) {
      this.stash.shift();
    }
  }

  info(payload: T) {
    this.q.push({ ts: new Date(), level: "INFO", payload: payload });
  }

  warn(payload: T) {
    this._flush();
    this.q.push({ ts: new Date(), level: "WARN", payload: payload });
  }

  error(payload: T) {
    this._flush();
    this.q.push({ ts: new Date(), level: "ERROR", payload: payload });
  }

  private _flush() {
    for (let item of this.stash) {
      this.q.push(item);
    }
    this.stash = [];
  }

  private async _post(url: string, items: Event<T>[]) {
    // TODO: serialize the event items before hand and store
    // that instead of the raw objects which may cause GC
    // penalties
    let count = items.length;
    let init = {
      method: "POST",
      body: JSON.stringify({ now: new Date(), events: items.slice() }),
      heaaders: { "Content-Type": "application/json" }
    };
    try {
      let res = await fetch(url, init);
      return res.ok ? count : 0;
    } catch (ignored) {
      return 0;
    }
  }

  flush() {
    return this.q.flush();
  }
}

// Queue is a simple async queue of items
type Worker<T> = (items: T[]) => Promise<number>;
interface Storage<T> {
  enqueue(items: T[], item: T): Promise<void>;
  dequeue(items: T[], count: number): void;
}

class Queue<T> {
  worker: Worker<T>;
  pending?: Promise<void>;
  items: T[];
  storage: Storage<T>;

  constructor(worker: Worker<T>, storage: Storage<T>) {
    this.worker = worker;
    this.pending = null;
    this.items = [];
    this.storage = storage;
  }

  push(item: T): Promise<void> {
    this.items.push(item);
    if (this.pending === null) {
      this.pending = this._send();
    }
    return this.storage.enqueue(this.items, item);
  }

  async flush() {
    return this.pending;
  }

  async _send() {
    while (this.items.length > 0) {
      let count = await this.worker(this.items); // this must not throw!
      if (count) {
        this.items.splice(0, count);
        this.storage.dequeue(this.items, count);
      }
    }
    this.pending = null;
  }
}

// retry does binary exponential backoff
function retry<T>(
  fn: PostItems<T>,
  maxCount: number,
  initialMilliseconds: number,
  maxMilliseconds: number,
  randomizationFactor: number
): PostItems<T> {
  return async (items: Event<T>[]) => {
    let delay = initialMilliseconds;
    for (let count = 0; count < maxCount; count++) {
      try {
        return await fn(items);
      } catch (ignored) {
        delay = Math.min(delay, maxMilliseconds);
        let randomized = Math.round(
          delay * (1 + Math.random() * randomizationFactor)
        );
        await sleep(Math.min(randomized, maxMilliseconds));
      }
    }
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Store implements an IDB-base multi-tab safe store.
//
// Much of the work in this is class is dealing with the fact that a
// dequeue call can happen before the enqueue call has completed.
//
// To make that work, the main state "entries" holds a list
// of IDs (but not the items themselves which are in indexeddb).
// The entry is an object which has a deleted flag. If a dequeue
// operations comes in while the add is still in progress, the flag
// is set to true and the entry removed.  When the add succeeds,
// this flag is checked and the item deleted immediately if needed.
export class Store<T> {
  private asyncDB: AsyncDB<T>;
  private entries: Array<{ id?: number; deleted: boolean }>;

  constructor(idb: IDBFactory, name: string) {
    this.asyncDB = new AsyncDB<T>(idb, name);
    this.entries = [];
  }

  waitForInit(): Promise<void> {
    return this.asyncDB.waitForInit();
  }

  list(): Promise<T[]> {
    return this.asyncDB.list();
  }

  async enqueue(items: T[], item: T): Promise<void> {
    let entry: { id?: number; deleted: boolean } = { id: null, deleted: false };
    this.entries.push(entry);
    entry.id = await this.asyncDB.add(item);
    if (entry.deleted) {
      await this.asyncDB.remove(entry.id);
    }
  }

  async dequeue(items: T[], count: number): Promise<void> {
    for (let kk = 0; kk < count; kk++) {
      if (this.entries[kk].id == null) {
        this.entries[kk].deleted = true;
      } else {
        // TODO: fix this orphaned promise
        this.asyncDB.remove(this.entries[kk].id);
      }
    }
    this.entries.splice(0, count);
  }
}

// AsyncDB provides a thin wrapper on top of IndexedDB
//
// All items are stored as {item, id} where id is an autoincrement
// column.  The add() call returns the id so things can be removed
// later.  The list() call fetches all items in the db now.
class AsyncDB<T> {
  private db: Promise<IDBDatabase>;
  public staleEntries: Array<{ id: number; item: T }>;

  constructor(idb: IDBFactory, name: string) {
    this.db = new Promise((resolve, reject) => {
      let req = idb.open(name, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("logs", {
          keyPath: "id",
          autoIncrement: true
        });
      };
      // TODO: the callback below cannot be async as its errors
      // will be uncaught
      req.onsuccess = async () => {
        let db = req.result;
        db.onerror = e => console.log("Unexpected idb error", e);
        this.staleEntries = await this._list(db);
        resolve(db);
      };
      req.onerror = reject;
    });
  }

  async waitForInit(): Promise<void> {
    await this.db;
  }

  async list(): Promise<T[]> {
    let entries = await this._list(await this.db);
    return entries.map(x => x.item);
  }

  _list(db: IDBDatabase): Promise<Array<{ id: number; item: T }>> {
    return new Promise(async (resolve, reject) => {
      let tx = db.transaction(["logs"], "readonly");
      tx.oncomplete = e => {};
      tx.onerror = reject;
      let req = tx.objectStore("logs").getAll();
      req.onerror = reject;
      req.onsuccess = () => {
        resolve(req.result);
      };
    });
  }

  add(item: T): Promise<number> {
    return new Promise(async (resolve, reject) => {
      let db = await this.db;
      let tx = db.transaction(["logs"], "readwrite");
      tx.onerror = reject;
      let req = tx.objectStore("logs").add({ item: item });
      req.onsuccess = () => {
        resolve(+req.result);
      };
      req.onerror = reject;
    });
  }

  remove(id: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let db = await this.db;
      let tx = db.transaction(["logs"], "readwrite");
      tx.onerror = reject;
      let req = tx.objectStore("logs").delete(id);
      req.onsuccess = () => {
        resolve();
      };
      req.onerror = reject;
    });
  }
}
