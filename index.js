"use strict"

// Copyright (C) 2019 rameshvk. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file.

// Queue implements a simple async queue
//
// The worker function provided is called with a set of items to
// process. This is expected to be an async function itself and should
// not throw.  It should include any retry logic needed (though the
// exported Retry function can be used to wrap it if needed).
//
// The storage object provided is called with enqueue each time an item
// is pushed.  It is also called with dequeue when the worker
// finishes.  This allows the storage layer to implement persistence
// as needed.  The LocalStorage class implements persistence and can
// be used to save this info in local storage.
export class Queue {
  constructor(worker, storage) {
    this.worker = worker;
    this.pending = null;
    this.items = [];
    this.storage = storage;
  }

  push(item) {
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
      let count = this.items.length;
      await this.worker(this.items.slice()); // this must not throw!
      this.items.splice(0, count);
      this.storage.dequeue(this.items, count);
    }
    this.pending = null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Retry implements a simple binary expoential backoff.
//
// The provided function is expected to be an async function which
// throws on errors. If using promises, this is same as rejecting a
// promise.
//
// Suggested parameters: +Inf, 200, 30000, 0.2
export async function Retry(fn, maxCount, initialMilliseconds,  maxMilliseconds, randomizationFactor) {
  let delay = initialMilliseconds;
  for (let count = 0; count < maxCount; count ++) {
    try {
      await fn(count);
      return null;
    } catch(ignored) {
      delay = Math.min(delay, maxMilliseconds);
      let randomized = Math.round(delay * (1 + Math.random() * randomizationFactor));
      await sleep(Math.min(randomized, maxMilliseconds));
    }
  }
}

// LocalStorage implements a local-storage based persistence
//
// Note that it needs a key-prefix.  If this is supported on
// multiple-tabs, a single key prefix is not ideal as each tab will
// clobber the results of another tab.  A more sophisticated system
// would be needed to make that work.
export class LocalStorage {
  constructor (actualLocalStorageObject, keyPrefix) {
    this.localStorage = actualLocalStorageObject;
    this.keyPrefix = keyPrefix;
  }

  enqueue(items, item) {
    // this is not smart, just saves the whole set of items
    this.localStorage.setItem(this.keyPrefix, JSON.stringify(items));
  }

  dequeue(items, count) {
    // this is not smart, just saves the whole set of items
    if (items.length > 0) {
      this.localStorage.setItem(this.keyPrefix, JSON.stringify(items));
    } else {
      this.localStorage.removeItem(this.keyPrefix);
    }
  }

  getItems() {
    let v = this.localStorage.getItem(this.keyPrefix);
    if (v) {
      return JSON.parse(v);
    }
    return [];
  }
}
  
