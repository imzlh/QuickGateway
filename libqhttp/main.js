// @ts-check

import { signal, SIGALRM, Worker } from 'os';
import './console.js';

/**
 * @typedef {Object} WorkerInfo
 * @property {Worker} worker
 * @property {boolean} free
 */

// worker池
const workers = /** @type {Array<WorkerInfo>} */ ([]),
    worker_num = 2;

/**
 * @type {Array<[number, string]>}
 */
let fd_queue = [];

for (let i = 0; i < worker_num; i++) {
    const worker = new Worker(process.dirname + '/worker.js'),
        ref = { worker, free: true };
    worker.onmessage = ({ data }) => {
        console.log('worker message:', data);
        if((typeof data != 'object') || !data.name) return;
        switch(data.name) {
            case 'done':
                if(fd_queue.length){
                    // 派发新任务
                    const fd = fd_queue.shift();
                    worker.postMessage(fd);
                }else{
                    ref.free = true;
                }
            break;

            case 'reload':
                reload();
            break;
        }
    }
    workers.push(ref);
}

function reload(){
    console.log('Get SIGHUP signal, reload worker')
    // 重载Worker
    for(let i = 0; i < workers.length; i++) {
        const worker = workers[i];
        worker.worker.close();
        const new_worker = new Worker(process.dirname + '/worker.js');
        new_worker.onmessage = worker.worker.onmessage;
        workers[i] = { worker: new_worker, free: true };
    }
    console.log('Worker reload success');
}

signal(SIGALRM, reload)

globalThis.onAccept = (/** @type {number} */ fd, /** @type { string } */ addr) => {
    // 找空闲Worker
    for(let i = 0; i < workers.length; i++) {
        const worker = workers[i];
        if(worker.free) {
            worker.free = false;
            worker.worker.postMessage([fd, addr]);
            return;
        }
    }
    // 没有空闲Worker，加入队列
    fd_queue.push([fd, addr]);
}