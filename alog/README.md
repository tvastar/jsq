# alog

The alog module implements asynchronous logging.

## API

```js
   let store = new Store(window.indexedDB, "myapplogs");
   let log = new Log("/log", store); // post all messaages to /log

   // on app init, do the following
   await storage.waitForInit()
   for (let entry of storage.staleEntries) {
      await log.push(entry.item);
      storage.remove(entry.id);
   }
   // the above takes care of resubmitting old entries

   // now log can be used for debug/info/warn etc
   // debug entries will be buffered and only sent out when a
   // WARN or ERROR level event happens
   
   log.debug({x: 42});
   log.info({x: 41});
   log.warn({x: 99});
   log.error({err: "boo"});
```

Log provides a bunch of methods to do structured logging. All the
provided objects are JSON serialized when sending to the server.

The log events are automatically buffered.  Debug events are not sent
out unless there is an error or warn level event that shows up within
the window.  The window size can be specified as the second parameter
to the constructor of the log.

## Retries and persistence

Binary exponential backoff is automatically applied.  The package
comes with a `Store` class which implements persistence on IndexedDB
that works even when multiple tabs are active.

## XHR

The default implementation uses the fetch API, posting payloads like
the following to the url provided to `Log`:

```jsonn
{
   "now": "current date time",
   "events": [
      {"ts": "timestamp", "level": "INFO", "payload": ...},
      ...
   ]
}
```

