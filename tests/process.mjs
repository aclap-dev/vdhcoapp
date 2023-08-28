import { on_receive } from "./rpc.mjs";
import { spawn } from "node:child_process";

export function spawn_process(path) {
  const child = spawn(path, [], {
    env: { ...process.env, FOO: "BAR" }
  });

  child.stdin.setEncoding('utf-8');

  child.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  child.on('error', (code) => {
    console.error(`child process exited with error ${code}`);
  });

  let buffer = Buffer.alloc(0);

  child.stdout.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);
    while (true) {
      if (buffer.length < 4) {
        return;
      }
      let len = buffer.readUInt32LE(0);
      if (buffer.length < len + 4) {
        return;
      }
      if (len == 0) {
        return;
      }
      let subs = buffer.toString("utf8", 4, len + 4);
      let obj = JSON.parse(subs);
      buffer = buffer.slice(len + 4);
      on_receive(obj);
    }
  });

  let exiting = new Promise((ok) => {
    child.on('close', (code) => {
      ok(code);
    });
  });

  return {
    stdin: child.stdin,
    exiting
  };
}
