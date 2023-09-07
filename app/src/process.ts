import { ChildProcess, spawn } from 'node:child_process';
import { Readable } from 'stream';

export type Pid = number;
export type ExitCode = number;

export class Process {
  private _process: ChildProcess;

  constructor(process: ChildProcess) {
    this._process = process;
  }

  kill9() {
    this._process.kill(9);
  }

  async exited(): Promise<ExitCode> {
    if (this._process.exitCode !== null) {
      // Process has already exited.
      return this._process.exitCode;
    } else {
      return new Promise((ok) => {
        this._process.on("exit", (exitCode: ExitCode) => {
          ok(exitCode);
        });
      });
    }
  }

  async * read_std(stream: Readable) {
    type reading_step = {line: string | undefined, finished: boolean};
    type resolver = (_:reading_step) => void;
    let resolve: resolver;
    let promise: Promise<reading_step> = new Promise((ok: resolver) => {
      resolve = ok
    });

    stream.on('data', async function(data: Buffer) {
      const lines = data.toString("utf8").split('\n');
      for (let line of lines) {
        resolve({line, finished: false});
        promise = new Promise(ok => resolve = ok);
        await new Promise(process.nextTick);
      }
    });

    this._process.on("exit", () => {
      resolve({line: undefined, finished: true});
    });

    for (;;) {
      const value = await promise;
      if (value.finished) {
        return;
      }
      yield value.line;
    }

  }

  // FIXME: before way than looping again?
  async * read_stderr() {
    for await (let line of this.read_std(this._process.stderr!)) {
      yield line;
    }
  }

  async * read_stdout() {
    for await (let line of this.read_std(this._process.stdout!)) {
      yield line;
    }
  }
}

export class ProcessManager {
  private _processes: Map<Pid, Process>;

  constructor() {
    this._processes = new Map();
  }

  findProcess(pid: Pid): Process | undefined {
    return this._processes.get(pid);
  }

  kill9(pid: Pid) {
    this._processes.get(pid)?.kill9();
  }

  spawn(command: string, args: string[] = []): Process {
    let child = spawn(command, args);

    if (!child.pid) {
      throw new Error("Process creation failed");
    }
    let pid = child.pid;
    let process = new Process(child);
    this._processes.set(pid, process);
    process.exited().then(() => {
      this._processes.delete(pid);
    });
    return process;
  }
}
