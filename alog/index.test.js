"use strict"

// Copyright (C) 2019 rameshvk. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file.

let {expect} = require("chai");
import {Log} from "./index.js";

describe("log", () => {
 it("writes logs and buffers debug", async () => {
    let items = [];
    let worker = tasks => {
      items = items.concat(tasks);
      return tasks.length
    };
    let log = new Log(worker);

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
  });
});

