// @ts-check

import { fdopen } from "std"

/**
 * HTTP客户端对象
 */
export default class Client {
    static status = /** @type {Record<number, string>} */ ({
        100: 'Continue',
        200: 'OK',
        206: 'Partial Content',
        301: 'Moved Permanently',
        302: 'Found',
        304: 'Not Modified',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        406: 'Not Acceptable',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        505: 'HTTP Version not supported',
    });

    /**
     * 创建一个Client对象
     * @param {number} fd 文件描述符
     * @param {string} addr 客户端地址
     */
    constructor(fd, addr){
        try{
            /**
             * @private
             */
            this.$fd = /** @type {import("os").File} */ (fdopen(fd, 'w+'));
        }catch(e){
            throw new Error('Failed to create Client object:' + /** @type {Error} */ (e).message);
        }

        // 读取HTTP响应头
        const line1 = this.$fd.getline(),
            items = line1.match(/^\s*([a-z]+)\s+(\/\S*)\s+HTTP\/(1\.\d+)\s*$/i);
        if(!items){
            console.log('Invalid HTTP response header:\n',line1);
            this.close();
            this.$destroyed = true;
            return;
        }
        /**
         * @private
         */
        this.$method = items[1];
        /**
         * @private
         */
        this.$url = items[2];
        /**
         * @private
         */
        this.$version = parseFloat(items[3]);
        /**
         * @private
         */
        this.$resHeaders = /** @type {Record<string, string>} */ ({});
        /**
         * @private
         */
        this.$addr = addr;
        /**
         * @private
         */
        this.$readed_body = false;
        /**
         * @private
         */
        this.$destroyed = false;

        // 读取参数
        let line = this.$fd.getline().trim();
        /**
         * @private
         */
        this.$headers = /** @type {Record<string, string>} */ ({});
        while(line){
            const [key, value] = line.split(':');
            this.$headers[key.trim().toLowerCase()] = value.trim();
            line = this.$fd.getline().trim();
        }
        if(!this.$headers['host']){
            this.__error(400, 'Host header is missing');
            return;
        }
    }

    /**
     * 向客户端报告错误
     * @private
     * @param {number} status 
     * @param {string} message 
     * @returns {void}
     */
    __error(status, message){
        this.$fd.puts(`HTTP/1.1 ${status} ${Client.status[status] || 'Unknown Error'}\r\n\r\n${message}`);
        this.$fd.flush();
        this.$fd.close();
        this.$destroyed = true;
    }

    /**
     * 读取body内容
     * @returns body
     */
    content(){
        if(!this.$headers) return null;
        const type = this.$headers['content-type'] || 'application/octet-stream';
        if(this.$headers['content-length']){
            const length = parseInt(this.$headers['content-length']);
            if(isNaN(length)){
                this.__error(400, 'Invalid Content-Length header');
                return null;
            }
            const dataBuf = new ArrayBuffer(length);
            let pos = 0;
            while(pos < length){
                const n = this.$fd.read(dataBuf, pos, length - pos);
                if(n <= 0) break;
                pos += n;
            }
            if(pos < length){
                this.__error(400, 'Short read');
                return null;
            }
            if(type.startsWith('text/')){
                return /** @type {string} */ (new String(dataBuf));
            }else{
                return dataBuf;
            }
        }else{
            if(type.startsWith('text/')){
                return this.$fd.readAsString();
            }else{
                const buffers = [];
                let buffer = new ArrayBuffer(1024);
                let pos = 0;
                while(true){
                    const n = this.$fd.read(buffer, pos, buffer.byteLength - pos);
                    if(n <= 0) break;
                    pos += n;
                    if(pos == buffer.byteLength){
                        buffers.push(buffer);
                        buffer = new ArrayBuffer(1024);
                        pos = 0;
                    }
                }
                if(pos > 0){
                    buffers.push(buffer.slice(0, pos));
                }
                if(buffers.length == 0){
                    return null;
                }else if(buffers.length == 1){
                    return buffers[0];
                }else{
                    const result = new Uint8Array(buffers.reduce((acc, buf) => acc + buf.byteLength, 0));
                    let pos = 0;
                    for(let i = 0; i < buffers.length; i++){
                        const buf = buffers[i];
                        result.set(new Uint8Array(buf), pos);
                        pos += buf.byteLength;
                    }
                    return result.buffer;
                }
            }
        }
        this.$readed_body = true;
    }

    /**
     * 设置HTTP响应头
     * @param {string} key 
     * @param {string} value 
     */
    setHeader(key, value){
        if(!this.$resHeaders) return;
        this.$resHeaders[key.toLowerCase()] = value;
        return this;
    }

    /**
     * 设置状态码
     * @param {number} status 
     */
    status(status){
        /**
         * @private
         */
        this.$status = status;
        return this;
    }

    /**
     * 缓存内容
     * @param {Uint8Array | string | ArrayBuffer} obj 
     */
    write(obj){
        if(!this.$cache) 
            /**
             * @private
             */
            this.$cache = /** @type {(string|Uint8Array)[]} */ ([]);
        if(typeof obj === 'string'){
            this.$cache.push(obj);
        }else{
            this.$cache.push(new Uint8Array(obj));
        }
    }

    /**
     * @private
     */
    __calc_body_length(){
        let length = 0;
        if(!this.$cache) return 0;
        for(let i = 0; i < this.$cache.length; i++){
            const item = this.$cache[i];
            if(typeof item === 'object'){
                length += item.byteLength;
            }else{
                length += item.length;
            }
        }
        return length;
    }

    /**
     * 发送响应
     * @param {ArrayBuffer | string | Uint8Array} content 
     * @param {string} type 
     */
    send(content, type = 'text/plain'){
        if(!this.$resHeaders) throw new Error('The client is not initialized normally');
        // 整合
        this.$resHeaders['Content-Type'] = type;
        content && this.write(content);
        const len = this.__calc_body_length();
        // 发送响应头
        this.$fd.puts(`HTTP/1.1 ${this.$status} ${Client.status[this.$status || 200] || 'Unknown Error'}\r\n`);
        for(const key in this.$resHeaders){
            this.$fd.puts(`${key}: ${this.$resHeaders[key]}\r\n`);
        }
        this.$fd.puts(`Content-Length: ${len}\r\n\r\n`);
        // 发送body
        const body = /** @type {(string|Uint8Array)[]} */ (this.$cache);
        for(let i = 0; i < body.length; i++){
            const item = body[i];
            if(typeof item === 'object'){
                this.$fd.write(/** @type {ArrayBuffer} */ (item.buffer), 0, item.byteLength);
            }else{
                this.$fd.puts(item);
            }
        }
        console.log(this.$method, this.$url, this.$status);
        if(!this.$readed_body){ 
            this.$fd.close();
            this.$destroyed = true;
        }

        return this;
    }

    get url(){
        if(!this.$url) throw new Error('The client is not initialized normally');
        return this.$url;
    }

    get method(){
        if(!this.$method) throw new Error('The client is not initialized normally');
        return this.$method;
    }

    get version(){
        if(!this.$version) throw new Error('The client is not initialized normally');
        return this.$version;
    }

    get headers(){
        if(!this.$headers) throw new Error('The client is not initialized normally');
        return this.$headers;
    }

    get addr(){
        if(!this.$addr) throw new Error('The client is not initialized normally');
        return this.$addr;
    }

    get reuseable(){
        return !this.$destroyed;
    }

    close(){
        if(this.$destroyed) return;
        this.$fd.flush();
        this.$fd.close();
        this.$destroyed = true;
    }
}