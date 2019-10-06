"use strict"

// Copyright (C) 2019 rameshvk. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file.

let {expect} = require("chai");
import {Queue, Retry, LocalStorage} from "./index.js";

describe("queue", () => {
  it("enqueues items", async () => {
    let items = [];
    let worker = tasks => { items = items.concat(tasks) }
    let queue = new Queue(worker, new FakeStore());

    queue.push(42);
    await queue.flush();
    expect(items).to.deep.equal([42]);
  });

  it("enqueues multiple items", async () => {
    let items = [];
    let worker = tasks => { items = items.concat(tasks) }
    let queue = new Queue(worker, new FakeStore());

    queue.push(42);
    queue.push(45);
    await queue.flush();
    expect(items).to.deep.equal([42, 45]);
  });

  it("enqueues multiple items in sequence", async () => {
    let items = [];
    let worker = tasks => { items = items.concat(tasks) }
    let queue = new Queue(worker, new FakeStore());

    queue.push(42);
    await queue.flush();
    queue.push(45);
    await queue.flush();
    expect(items).to.deep.equal([42, 45]);
  });

  class FakeStore {
    enqueue() {
    }
    dequeue() {
    }
  }
});

describe("storage", () => {
  class FakeStorage {
    constructor() {
      this.items = {};
    }
    getItem(key) {
      return this.items[key];
    }
    setItem(key, value) {
      if (typeof value != "string") {
        throw new Error("unexpected type");
      }
      this.items[key] = value;
    }
  }

  it("enqueues items", async () => {
    let store = new LocalStorage(new FakeStorage(), "key");
    store.enqueue([42, 43], null);
    store.enqueue([42, 43, 44], null);
    expect(store.getItems()).to.deep.equal([42, 43, 44]);
    store.enqueue([], null);
    expect(store.getItems()).to.deep.equal([]);
  });
});

describe("retry", () => {
  it("retries on error", async () => {
    let count = 0;
    let worker = n => {
      count ++;
      if (n < 5) {
        throw new Error("fail!");
      }
      return null;
    };
    await Retry(worker, Infinity, 1, 1, 0);
    expect(count).to.equal(6);
  });

  it("retries on async error", async () => {
    let count = 0;
    let worker = async (n) => {
      count ++;
      if (n < 5) {
        throw new Error("fail!");
      }
      return null;
    };
    await Retry(worker, Infinity, 1, 1, 0);
    expect(count).to.equal(6);
  });

  it("does not retry past maxCount", async () => {
    let count = 0;
    let worker = async (n) => {
      count ++;
      if (n < 5) {
        throw new Error("fail!");
      }
      return null;
    };
    await Retry(worker, 2, 1, 1, 0);
    expect(count).to.equal(2);
  });

  it("does not retry past maxMilliseconds", async () => {
    let count = 0;
    let worker = async (n) => {
      count ++;
      if (n < 5) {
        throw new Error("fail!");
      }
      return null;
    };
    await Retry(worker, 2, 100000, 1, 100);
    expect(count).to.equal(2);
  });
});
