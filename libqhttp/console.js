import { out, err, getenv } from 'std';

const consoleObj = {
    /**
     * @private
     */
    decorate: {
        bold: (/** @type {string} */ str) => `\x1b[1m${str}\x1b[0m`,
        dim: (/** @type {string} */ str) => `\x1b[2m${str}\x1b[0m`,
        italic: (/** @type {string} */ str) => `\x1b[3m${str}\x1b[0m`,
        underline: (/** @type {string} */ str) => `\x1b[4m${str}\x1b[0m`,
        inverse: (/** @type {string} */ str) => `\x1b[7m${str}\x1b[0m`,
        hidden: (/** @type {string} */ str) => `\x1b[8m${str}\x1b[0m`,
        strikethrough: (/** @type {string} */ str) => `\x1b[9m${str}\x1b[0m`,
        black: (/** @type {string} */ str) => `\x1b[30m${str}\x1b[0m`,
        red: (/** @type {string} */ str) => `\x1b[31m${str}\x1b[0m`,
        green: (/** @type {string} */ str) => `\x1b[32m${str}\x1b[0m`,
        yellow: (/** @type {string} */ str) => `\x1b[33m${str}\x1b[0m`,
        blue: (/** @type {string} */ str) => `\x1b[34m${str}\x1b[0m`,
        magenta: (/** @type {string} */ str) => `\x1b[35m${str}\x1b[0m`,
        cyan: (/** @type {string} */ str) => `\x1b[36m${str}\x1b[0m`,
        white: (/** @type {string} */ str) => `\x1b[37m${str}\x1b[0m`,
        bgBlack: (/** @type {string} */ str) => `\x1b[40m${str}\x1b[0m`,
        bgRed: (/** @type {string} */ str) => `\x1b[41m${str}\x1b[0m`,
        bgGreen: (/** @type {string} */ str) => `\x1b[42m${str}\x1b[0m`,
        bgYellow: (/** @type {string} */ str) => `\x1b[43m${str}\x1b[0m`,
        bgBlue: (/** @type {string} */ str) => `\x1b[44m${str}\x1b[0m`,
        bgMagenta: (/** @type {string} */ str) => `\x1b[45m${str}\x1b[0m`,
        bgCyan: (/** @type {string} */ str) => `\x1b[46m${str}\x1b[0m`,
        bgWhite: (/** @type {string} */ str) => `\x1b[47m${str}\x1b[0m`,
    },

    /**
     * @private
     * @param {number} num 
     */
    __print_num(num){
        out.puts(this.decorate.blue(num.toString()));
    },

    /**
     * @private
     * @param {string} str 
     */
    __print_str(str){
        out.puts(this.decorate.green(str));
    },

    /**
     * @private
     * @param {bigint} num 
     */
    __print_bigint(num){
        out.puts(this.decorate.blue(num.toString() + 'n'));
    },

    /**
     * @private
     * @param {boolean} bool 
     */
    __print_bool(bool){
        out.puts(
            bool ? this.decorate.cyan('true') : this.decorate.red('false')
        )
    },

    /**
     * @private
     * @param {null | undefined} nul 
     */
    __print_null(nul){
        let str = null === null ? 'null' : 'undefined';
        out.puts(this.decorate.underline(str));
    },

    /**
     * @private
     * @param {Array<any>} arr 
     * @param {number} tab 
     */
    __print_arr(arr, tab = 0){
        if(arr.length <= 3){
            out.puts('[ ');
            for(let i = 0; i < arr.length; i++){
                this.__print_val(arr[i], tab + 1);
                if(i < arr.length - 1){
                    out.puts(', ');
                }
            }
            out.puts(']');
        }else if(arr.length < 20){
            out.puts('[\n');
            for(let i = 0; i < arr.length; i++){
                out.puts(' '.repeat(tab + 2));
                this.__print_val(arr[i], tab + 2);
                if(i < arr.length - 1){
                    out.puts(',\n');
                }else{
                    out.puts('\n');
                }
            }
            out.puts(' '.repeat(tab) + ']');
        }else{
            out.puts(this.decorate.cyan('Array') +'[' + arr.length + ']');
        }
    },

    /**
     * @private
     * @param {any} val 
     * @param {number} tab 
     */
    __print_val(val, tab = 0){
        switch(typeof val){
            case 'number':
                this.__print_num(val);
                break;
            case 'string':
                this.__print_str(val);
                break;
            case 'bigint':
                this.__print_bigint(val);
                break;
            case 'boolean':
                this.__print_bool(val);
                break;
            case 'object':
                if(val === null){
                    this.__print_null(val);
                }else if(Array.isArray(val)){
                    this.__print_arr(val, tab);
                }else{
                    this.__print_obj(val, tab);
                }
                break;
            case 'undefined':
                this.__print_null(val);
                break;
            case 'function':
                out.puts(this.decorate.yellow('Function(') + (val.name || 'anonymous') + ')');
                break;
            default:
                out.puts(this.decorate.red('unknown'));
                break;
        }
    },

    /**
     * @private
     * @param {Record<string, any>} obj 
     * @param {number} tab 
     */
    __print_obj(obj, tab = 0){
        let keys = Object.keys(obj);
        if(keys.length <= 3){
            out.puts('Object{ ');
            for(let i = 0; i < keys.length; i++){
                let key = keys[i];
                out.puts(' ' + this.decorate.bold(key) + ': ');
                this.__print_val(obj[key], tab + 2);
                if(i < keys.length - 1){
                    out.puts(', ');
                }
            }
            out.puts('}');
        }else if(keys.length < 20){
            out.puts('Object{\n');
            for(let i = 0; i < keys.length; i++){
                let key = keys[i];
                out.puts(' '.repeat(tab + 2) + this.decorate.bold(key) + ': ');
                this.__print_val(obj[key], tab + 2);
                if(i < keys.length - 1){
                    out.puts(',\n');
                }else{
                    out.puts('\n');
                }
            }
            out.puts(' '.repeat(tab) + '}');
        }else{
            out.puts(this.decorate.cyan('Object') +'{' + keys.length + '}' + this.decorate.black('...'));
        }
    },

    /**
     * @param {...any} args 
     */
    log(...args){
        for(let i = 0; i < args.length; i++){
            this.__print_val(args[i]);
            if(i < args.length - 1){
                out.puts(' ');
            }
        }
        out.puts('\n');
    },

    /**
     * @param {...any} args 
     */
    error(...args){
        for(let i = 0; i < args.length; i++){
            this.__print_val(args[i]);
            if(i < args.length - 1){
                err.puts(' ');
            }
        }
        err.puts('\n');
    },

    /**
     * @param {...any} args 
     */
    warn(...args){
        out.puts(this.decorate.yellow('WARN '));
        for(let i = 0; i < args.length; i++){
            this.__print_val(args[i]);
            if(i < args.length - 1){
                out.puts(' ');
            }
        }
        out.puts('\n');
    },

    /**
     * @param {...any} args 
     */
    info(...args){
        out.puts(this.decorate.cyan('INFO '));
        for(let i = 0; i < args.length; i++){
            this.__print_val(args[i]);
            if(i < args.length - 1){
                out.puts(' ');
            }
        out.puts('\n');
        }
    },

    /**
     * @param {...any} args 
     */
    debug(...args){
        if(!getenv('DEV')) return;
        out.puts(this.decorate.magenta('DEBUG '));
        for(let i = 0; i < args.length; i++){
            this.__print_val(args[i]);
            if(i < args.length - 1){
                out.puts(' ');
            }
        }
        out.puts('\n');
    },

    /**
     * @param {any} obj 
     * @param {Record<string, any>} options 
     */
    dir(obj, options = {}){
        let depth = options.depth || 0;
        let max_array_length = options.max_array_length || 10;
        let max_string_length = options.max_string_length || 100;
        let max_depth = options.max_depth || 5;
        let tab = 0;
        let seen = new Set();
        let stack = [obj];
        while(stack.length > 0){
            let obj = stack.pop();
            if(seen.has(obj)){
                out.puts(this.decorate.dim('...'));
                break;
            }
            seen.add(obj);
            if(typeof obj === 'object' && obj !== null){
                if(Array.isArray(obj)){
                    if(depth >= max_depth){
                        out.puts(this.decorate.cyan('Array') +'[' + obj.length + ']');
                    }else{
                        out.puts(this.decorate.cyan('Array') +'[' + obj.length + ']:\n');
                        for(let i = 0; i < obj.length; i++){
                            if(i > max_array_length){
                                out.puts(this.decorate.dim('...'));
                                break;
                            }
                            out.puts(' '.repeat(tab + 2));
                            this.__print_val(obj[i], tab + 2);
                            if(i < obj.length - 1){
                                out.puts(',\n');
                            }else{
                                out.puts('\n');
                            }
                        }
                    }
                }else{
                    let keys = Object.keys(obj);
                    if(depth >= max_depth){
                        out.puts(this.decorate.cyan('Object') +'{' + keys.length + '}' + this.decorate.black('...'));
                    }else{
                        out.puts(this.decorate.cyan('Object') +'{' + keys.length + '}:');
                        for(let i = 0; i < keys.length; i++){
                            let key = keys[i];
                            out.puts('\n');
                            out.puts(' '.repeat(tab + 2) + this.decorate.bold(key) + ': ');
                            this.__print_val(obj[key], tab + 2);
                        }
                    }
                }
            }else{    
                this.__print_val(obj);
            }
            tab--;
        }
    }
}

// @ts-ignore
globalThis.console = consoleObj;