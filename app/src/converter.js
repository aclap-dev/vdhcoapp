import open from 'open';

import { ProcessManager } from "./process";

const os = require("os");
const path = require('path');
const { spawn } = require('child_process');

const rpc = require('./weh-rpc');

const exec_dir = path.dirname(process.execPath);
let ffmpeg = path.join(exec_dir, "ffmpeg");
let ffprobe = path.join(exec_dir, "ffprobe");

if (os.platform() == "win32") {
  ffmpeg += ".exe";
  ffprobe += ".exe";
}

let ff_processes = new ProcessManager();

function ExecConverter(args) {
  return new Promise((resolve, reject) => {
    let convProcess = spawn(ffmpeg, args);
    let stdout = "";
    convProcess.stdout.on("data", (data) => stdout += data);
    convProcess.stderr.on("data", (_data) => {
      // need to consume data or process stalls
    });
    convProcess.on("exit", (exitCode) => {
      if (exitCode !== 0) {
        return reject(new Error("Converter returned exit code " + exitCode));
      }
      resolve(stdout);
    });
  });
}

rpc.listen({

  // FIXME: Partly in test suite. But just for hls retrieval.
  "convert": (args = ["-h"], options = {}) => new Promise((resolve, _reject) => {
    // `-progress pipe:1` send program-friendly progress information to stdin every 500ms.
    // `-hide_banner -loglevel error`: make the output less noisy.

    // This should never happen, but just in case a third party does a convert request
    // with the old version of ffmpeg arguments, let's rewrite the arguments to fit
    // the new syntax.
    let fixed = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith("[1:v][2:v] overlay=") && !args[i].endsWith("[m]")) {
        args[i] += " [m]";
        fixed = true;
      }
      if (fixed && args[i] == "1:v") {
        args[i] = "[m]";
      }
    }

    const ffmpeg_base_args = "-progress pipe:1 -hide_banner -loglevel error";
    args = [...ffmpeg_base_args.split(" "), ...args];

    const child = spawn(ffmpeg, args);

    let stderr = "";

    child.on("exit", (code) => resolve({exitCode: code, stderr}));
    child.stderr.on("data", (data) => stderr += data);

    const on_line = async (line) => {
      if (line.startsWith("out_time_ms=")) {
        // out_time_ms is in ns, not ms.
        const seconds = parseInt(line.split("=")[1]) / 1_000_000;
        try {
          await rpc.call("convertOutput", options.progressTime, seconds);
        } catch (_) {
          // Extension stopped caring
          child.kill();
        }
      }
    };

    if (options.progressTime) {
      child.stdout.on("data", (lines) => {
        lines.toString("utf-8").split("\n").forEach(on_line);
      });
    }

  }),
  // FIXME: Partly in test suite. But just for hls retrieval.
  "probe": (input, json = false) => {
    return new Promise((resolve, reject) => {
      let args = [];
      if (json) {
        args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams"];
      }
      args.push(input);
      let probeProcess = spawn(ffprobe, args);
      let stdout = "";
      let stderr = "";
      probeProcess.stdout.on("data", (data) => stdout += data);
      probeProcess.stderr.on("data", (data) => stderr += data);
      probeProcess.on("exit", (exitCode) => {
        if (exitCode !== 0) {
          return reject(new Error("Exit code: " + exitCode + "\n" + stderr));
        }
        if (json) {
          // FIXME: not parsed?
          resolve(stdout);
        } else {
          let info = {};
          let m = /([0-9]{2,})x([0-9]{2,})/g.exec(stderr);
          if (m) {
            info.width = parseInt(m[1]);
            info.height = parseInt(m[2]);
          }
          m = /Duration: ([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{2})/g.exec(stderr);
          if (m) {
            info.duration = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
          }
          m = /Video:\s+([^\s\(,]+)/g.exec(stderr);
          if (m) {
            info.videoCodec = m[1];
          }
          m = /Audio:\s+([^\s\(,]+)/g.exec(stderr);
          if (m) {
            info.audioCodec = m[1];
          }
          m = /([0-9]+(?:\.[0-9]+)?)\s+fps\b/g.exec(stderr);
          if (m) {
            info.fps = parseFloat(m[1]);
          }
          resolve(info);
        }
      });
    });
  },
  // FIXME: test (partly because open result is untested)
  "play": (filePath) => {
    return new Promise((resolve, _reject) => {
      open(filePath);
      resolve();
    });
  },
    // In test suite
  "codecs": () => {
    return ExecConverter(["-codecs"])
      .then((out) => {
        let lines = out.split("\n");
        let result = {};
        lines.forEach((line) => {
          let m = /^\s*(\.|D)(\.|E)(\.|V|A|S)(\.|I)(\.|L)(\.|S)\s+([^\s]+)\s+(.*?)\s*$/.exec(line);
          if (!m || m[7] === '=') {
            return;
          }
          result[m[7]] = {
            d: m[1] != ".",
            e: m[2] != ".",
            t: m[3] == "." && null || m[3],
            i: m[4] != ".",
            l: m[5] != ".",
            s: m[6] != ".",
            _: m[8]
          };
        });
        return result;
      });
  },
  // In test suite
  "formats": () => {
    return ExecConverter(["-formats"])
      .then((out) => {
        let lines = out.split("\n");
        let result = {};
        lines.forEach((line) => {
          let m = /^\s*(\.| |D)(\.| |E)\s+([^\s]+)\s+(.*?)\s*$/.exec(line);
          if (!m || m[3] === '=') {
            return;
          }
          result[m[3]] = {
            d: m[1] == "D",
            e: m[2] == "E",
            _: m[4]
          };
        });
        return result;
      });
  },
  // In test suite, but just to check if not throwing.
  "open": (filePath, options = {}) => {
    return open(filePath, options);
  },

});

exports.info = async () => {
  let proc = ff_processes.spawn(ffmpeg, ["-h"]);
  for await (let line of proc.read_stderr()) {
    let m = /^(\S+)\sversion\s(\S+)/.exec(line);
    if (m) {
      await proc.exited();
      return {
        program: m[1],
        version: m[2],
        converterBinary: ffmpeg,
      };
    }
  }
  let code = await proc.exited();
  throw new Error(`Unexpected output. Exited with code ${code}`);
};
