# alog

The alog module implements asynchronous logging.

## API

```js
   let log = new Log("/log"); // post all messaages to /log

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

Binary exponential backoff is already wired in.  Persistence is NYI.

