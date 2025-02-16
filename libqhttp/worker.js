// @ts-check
// Worker entry
import { kill, SIGALRM, Worker } from "os";
import Client from "./object.js";
import { handle } from "./handle.js";
import "./console.js";

// 接受FD
Worker.parent.onmessage = ({ data }) => {
    try{
        const req = new Client(data[0], data[1]);

        if(req.method == 'GET' && req.url == '/__reload__'){
            req.status(200).send('ok', 'text/plain').close();
            Worker.parent.postMessage('reload');
        }

        try{
            handle(req);
            req.close();
        }catch(e){
            req.status(500).send(/** @type {string} */(new String(e)), 'text/plain').close();
        }
    }catch(e){
        console.error(e);
    }

    Worker.parent.postMessage('done');
}