// Copyright (C) 2019 rameshvk. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
var Log = /** @class */ (function () {
    function Log(post, storage, bufSize) {
        var _this = this;
        if (bufSize === void 0) { bufSize = 20; }
        if (typeof post === "string") {
            var url_1 = post;
            post = function (items) { return _this._post(url_1, items); };
        }
        post = retry(post, Infinity, 500, 30000, 0.2);
        this.q = new Queue(post, storage);
        this.stash = [];
        this.maxStash = bufSize;
    }
    // push is mainly there for the init use case: stale entries
    // are pushed with the ability to wait for confirmation that this
    // was written to storage.
    Log.prototype.push = function (e) {
        return this.q.push(e);
    };
    Log.prototype.debug = function (payload) {
        this.stash.push({ ts: new Date(), level: "DEBUG", payload: payload });
        while (this.stash.length > this.maxStash) {
            this.stash.shift();
        }
    };
    Log.prototype.info = function (payload) {
        this.q.push({ ts: new Date(), level: "INFO", payload: payload });
    };
    Log.prototype.warn = function (payload) {
        this._flush();
        this.q.push({ ts: new Date(), level: "WARN", payload: payload });
    };
    Log.prototype.error = function (payload) {
        this._flush();
        this.q.push({ ts: new Date(), level: "ERROR", payload: payload });
    };
    Log.prototype._flush = function () {
        for (var _i = 0, _a = this.stash; _i < _a.length; _i++) {
            var item = _a[_i];
            this.q.push(item);
        }
        this.stash = [];
    };
    Log.prototype._post = function (url, items) {
        return __awaiter(this, void 0, void 0, function () {
            var count, init, res, ignored_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        count = items.length;
                        init = {
                            method: "POST",
                            body: JSON.stringify({ now: new Date(), events: items.slice() }),
                            heaaders: { "Content-Type": "application/json" }
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, fetch(url, init)];
                    case 2:
                        res = _a.sent();
                        return [2 /*return*/, res.ok ? count : 0];
                    case 3:
                        ignored_1 = _a.sent();
                        return [2 /*return*/, 0];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    Log.prototype.flush = function () {
        return this.q.flush();
    };
    return Log;
}());
export { Log };
var Queue = /** @class */ (function () {
    function Queue(worker, storage) {
        this.worker = worker;
        this.pending = null;
        this.items = [];
        this.storage = storage;
    }
    Queue.prototype.push = function (item) {
        this.items.push(item);
        if (this.pending === null) {
            this.pending = this._send();
        }
        return this.storage.enqueue(this.items, item);
    };
    Queue.prototype.flush = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.pending];
            });
        });
    };
    Queue.prototype._send = function () {
        return __awaiter(this, void 0, void 0, function () {
            var count;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.items.length > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.worker(this.items)];
                    case 1:
                        count = _a.sent();
                        if (count) {
                            this.items.splice(0, count);
                            this.storage.dequeue(this.items, count);
                        }
                        return [3 /*break*/, 0];
                    case 2:
                        this.pending = null;
                        return [2 /*return*/];
                }
            });
        });
    };
    return Queue;
}());
// retry does binary exponential backoff
function retry(fn, maxCount, initialMilliseconds, maxMilliseconds, randomizationFactor) {
    var _this = this;
    return function (items) { return __awaiter(_this, void 0, void 0, function () {
        var delay, count, ignored_2, randomized;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    delay = initialMilliseconds;
                    count = 0;
                    _a.label = 1;
                case 1:
                    if (!(count < maxCount)) return [3 /*break*/, 7];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, fn(items)];
                case 3: return [2 /*return*/, _a.sent()];
                case 4:
                    ignored_2 = _a.sent();
                    delay = Math.min(delay, maxMilliseconds);
                    randomized = Math.round(delay * (1 + Math.random() * randomizationFactor));
                    return [4 /*yield*/, sleep(Math.min(randomized, maxMilliseconds))];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    count++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/];
            }
        });
    }); };
}
function sleep(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
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
var Store = /** @class */ (function () {
    function Store(idb, name) {
        this.asyncDB = new AsyncDB(idb, name);
        this.entries = [];
    }
    Store.prototype.waitForInit = function () {
        return this.asyncDB.waitForInit();
    };
    Store.prototype.list = function () {
        return this.asyncDB.list();
    };
    Store.prototype.enqueue = function (items, item) {
        return __awaiter(this, void 0, void 0, function () {
            var entry, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        entry = { id: null, deleted: false };
                        this.entries.push(entry);
                        _a = entry;
                        return [4 /*yield*/, this.asyncDB.add(item)];
                    case 1:
                        _a.id = _b.sent();
                        if (!entry.deleted) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.asyncDB.remove(entry.id)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    Store.prototype.dequeue = function (items, count) {
        return __awaiter(this, void 0, void 0, function () {
            var kk;
            return __generator(this, function (_a) {
                for (kk = 0; kk < count; kk++) {
                    if (this.entries[kk].id == null) {
                        this.entries[kk].deleted = true;
                    }
                    else {
                        // TODO: fix this orphaned promise
                        this.asyncDB.remove(this.entries[kk].id);
                    }
                }
                this.entries.splice(0, count);
                return [2 /*return*/];
            });
        });
    };
    return Store;
}());
export { Store };
// AsyncDB provides a thin wrapper on top of IndexedDB
//
// All items are stored as {item, id} where id is an autoincrement
// column.  The add() call returns the id so things can be removed
// later.  The list() call fetches all items in the db now.
var AsyncDB = /** @class */ (function () {
    function AsyncDB(idb, name) {
        var _this = this;
        this.db = new Promise(function (resolve, reject) {
            var req = idb.open(name, 1);
            req.onupgradeneeded = function () {
                req.result.createObjectStore("logs", {
                    keyPath: "id",
                    autoIncrement: true
                });
            };
            // TODO: the callback below cannot be async as its errors
            // will be uncaught
            req.onsuccess = function () { return __awaiter(_this, void 0, void 0, function () {
                var db, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            db = req.result;
                            db.onerror = function (e) { return console.log("Unexpected idb error", e); };
                            _a = this;
                            return [4 /*yield*/, this._list(db)];
                        case 1:
                            _a.staleEntries = _b.sent();
                            resolve(db);
                            return [2 /*return*/];
                    }
                });
            }); };
            req.onerror = reject;
        });
    }
    AsyncDB.prototype.waitForInit = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AsyncDB.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            var entries, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this._list;
                        return [4 /*yield*/, this.db];
                    case 1: return [4 /*yield*/, _a.apply(this, [_b.sent()])];
                    case 2:
                        entries = _b.sent();
                        return [2 /*return*/, entries.map(function (x) { return x.item; })];
                }
            });
        });
    };
    AsyncDB.prototype._list = function (db) {
        var _this = this;
        return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
            var tx, req;
            return __generator(this, function (_a) {
                tx = db.transaction(["logs"], "readonly");
                tx.oncomplete = function (e) { };
                tx.onerror = reject;
                req = tx.objectStore("logs").getAll();
                req.onerror = reject;
                req.onsuccess = function () {
                    resolve(req.result);
                };
                return [2 /*return*/];
            });
        }); });
    };
    AsyncDB.prototype.add = function (item) {
        var _this = this;
        return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
            var db, tx, req;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db];
                    case 1:
                        db = _a.sent();
                        tx = db.transaction(["logs"], "readwrite");
                        tx.onerror = reject;
                        req = tx.objectStore("logs").add({ item: item });
                        req.onsuccess = function () {
                            resolve(+req.result);
                        };
                        req.onerror = reject;
                        return [2 /*return*/];
                }
            });
        }); });
    };
    AsyncDB.prototype.remove = function (id) {
        var _this = this;
        return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
            var db, tx, req;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db];
                    case 1:
                        db = _a.sent();
                        tx = db.transaction(["logs"], "readwrite");
                        tx.onerror = reject;
                        req = tx.objectStore("logs")["delete"](id);
                        req.onsuccess = function () {
                            resolve();
                        };
                        req.onerror = reject;
                        return [2 /*return*/];
                }
            });
        }); });
    };
    return AsyncDB;
}());
