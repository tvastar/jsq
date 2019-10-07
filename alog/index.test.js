"use strict"

// Copyright (C) 2019 rameshvk. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file.

let {expect} = require("chai");
let indexedDB = require("fake-indexeddb");
import {Log, Store} from "./index.js";

describe("log", () => {
 it("writes logs and buffers debug", async () => {
   let items = [];
   let worker = tasks => {
     items = items.concat(tasks);
     return tasks.length
   };
   let storage = new Store(indexedDB, "test");
   let log = new Log(worker, storage);

   // if this were a real client, the
   // waitForInit would be async and also immediately
   // followed by looking at storage.staleEntries:
   // each entry should be pushed via log.push()
   // followed by a storage.remove()
   await storage.waitForInit();

   
   log.debug("some debug");
   log.info("info");
   
   await log.flush();
   
   let payloads = [];
   for (let item of items) {
     payloads.push({level: item.level, payload: item.payload});
   }
   expect(payloads).to.deep.equal([{level: "INFO", payload: "info"}]);
   log.warn("boo");
   log.error("hoo");
   
   await log.flush();    
   payloads = [];
   for (let item of items) {
     payloads.push({level: item.level, payload: item.payload});
   }
   expect(items.length).to.equal(4);
   expect(payloads).to.deep.equal([
     {level: "INFO", payload: "info"},
     {level: "DEBUG", payload: "some debug"},
     {level: "WARN", payload: "boo"},
     {level: "ERROR", payload: "hoo"},      
   ]);

   // this part of the code if fragile.
   // the test works because of how promises are scheduled
   // the *add* calls are all scheduled immediately
   // the *delete* calls are only scheduled when the
   // adds finish but the following await finishes before
   // those new workitems get scheduled
   let storageItems = await storage.list();
   expect(storageItems.length).to.equal(4);
   payloads = [];
   for (let item of storageItems) {
     payloads.push({level: item.level, payload: item.payload});
   }
   expect(payloads).to.deep.equal([
     {level: "INFO", payload: "info"},
     {level: "DEBUG", payload: "some debug"},
     {level: "WARN", payload: "boo"},
     {level: "ERROR", payload: "hoo"},      
   ]);

   // lets call list and ensure things were properly deleted
   expect(await storage.list()).to.deep.equal([]);
 });
});

