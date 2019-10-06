# jsq

jsq is a simple Javascript async queue (implemented with modern ES6 code).

## Usage

```js
import {Queue, Retry, LocalStorage} from "jsq";

class AsyncTasks {
    constructor() {
       let storage = new LocalStorage(window.localStorage, "some key");
       let worker = items => this.processTasks(items);
       this.q = new Queue(Retry(items), storage);
    }

    schedule(task) {
       this.q.push(task);
    }

    async processTasks(tasks) {
        ... actually process the taskss...
    }
}

```

## Details

The module is rather small.  See the index.js for details.
