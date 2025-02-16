declare var scriptArgs: string[];
declare var print: (...args: any[]) => void;
declare var console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  trace(...args: any[]): void;
};

/**
 * Callback function for accepting a new connection.
 * @param fd The file descriptor of the new connection.
 */
declare var onAccept: (fd: number) => any;

/**
 * (inWorker) get the parent environment.
 * it is the same as `globalThis` in the main thread.
 */
declare const parent: globalThis;

declare interface WorkerMessage {
  name: string;
  value: any;
}

declare interface ImportMeta {
  main: boolean;
  url: string;
  dirname: string;
  filename: string;
}

interface process {
  entry: string;
  dirname: string;
  filename: string;
  pid: number;
}

declare var process: process;