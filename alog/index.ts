// Copyright (C) 2019 rameshvk. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file.

interface Event<T> {
   ts: Date;
   level: "DEBUG" | "INFO" | "ERROR" | "WARN";
   payload: T;
}

type Url = string;
type PostItems<T> = ((items: Event<T>[]) => Promise<number>);

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

   constructor(post: PostItems<T> | Url, bufsize: number = 20) {
       if (typeof post === "string") {
           let url = post;
           post = items => this._post(url, items);
       }
       post = retry(post, Infinity, 500, 30000, 0.2);
       this.q = new Queue<Event<T>>(post, new FakeStorage<Event<T>>());
       this.stash = [];
       this.maxStash = bufsize;
   }

   debug(payload: T) {
       this.stash.push({ts: new Date(), level: "DEBUG", payload: payload});
       while (this.stash.length > this.maxStash) {
           this.stash.shift();
       }
   }

   info(payload: T) {
       this.q.push({ts: new Date(), level: "INFO", payload: payload});
   }

   warn(payload: T) {
       this._flush();
       this.q.push({ts: new Date(), level: "WARN", payload: payload});
   }

   error(payload: T) {
       this._flush();
       this.q.push({ts: new Date(), level: "ERROR", payload: payload});
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
          body: JSON.stringify({now: new Date(), events: items.slice()}),
          heaaders: {"Content-Type": "application/json"},
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
type Worker<T> = (items: T[]) => Promise<number>
interface Storage<T> {
   enqueue(items: T[], item: T): void;
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

  push(item: T) {
    this.items.push(item);
    this.storage.enqueue(this.items, item);
    if (this.pending === null) {
      this.pending = this._send()
    }
  }

  async flush() {
    return this.pending;
  }

  async _send() {
    while (this.items.length > 0 ) {
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
function retry<T>(fn: PostItems<T>, maxCount: number, initialMilliseconds: number,  maxMilliseconds: number, randomizationFactor: number): PostItems<T> {
    return async (items: Event<T>[]) => {
        let delay = initialMilliseconds;
        for (let count = 0; count < maxCount; count ++) {
            try {
                return await fn(items);
            } catch(ignored) {
                delay = Math.min(delay, maxMilliseconds);
                let randomized = Math.round(delay * (1 + Math.random() * randomizationFactor));
                await sleep(Math.min(randomized, maxMilliseconds));
            }
        }
    };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

class FakeStorage<T> {
   enqueue(items: T[], item: T): void {
   }

   dequeue(items: T[], count: number): void {
   }
}
