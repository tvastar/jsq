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
    function Log(post, bufsize) {
        var _this = this;
        if (bufsize === void 0) { bufsize = 20; }
        if (typeof post === "string") {
            var url_1 = post;
            post = function (items) { return _this._post(url_1, items); };
        }
        post = retry(post, Infinity, 500, 30000, 0.2);
        this.q = new Queue(post, new FakeStorage());
        this.stash = [];
        this.maxStash = bufsize;
    }
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
        this.storage.enqueue(this.items, item);
        if (this.pending === null) {
            this.pending = this._send();
        }
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
var FakeStorage = /** @class */ (function () {
    function FakeStorage() {
    }
    FakeStorage.prototype.enqueue = function (items, item) {
    };
    FakeStorage.prototype.dequeue = function (items, count) {
    };
    return FakeStorage;
}());
