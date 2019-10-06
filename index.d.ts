// Copyright (C) 2019 rameshvk. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file.

interface StorageInstance<T> {
   enqueue(items: T[], item: T): void;
   dequeue(items: T[], count: number): void;
}

interface WorkerInstance<T> {
   (items: T[]): Promise<number>;
}

// Queue implements an async queue on top of an async worker
export class Queue<T> {
   constructor(worker: WorkerInstance<T>, storage: StorageInstance<T>);
   push(item: T): void;
   flush(): Promise<void>;
}

