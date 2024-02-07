import open from 'open';

const os = require("os");
const path = require('path');
const fs = require("node:fs");

const logger = require('./logger');
const rpc = require('./weh-rpc');

const exec_dir = path.dirname(process.execPath);

const ffmpeg = findExecutableFullPath("ffmpeg", exec_dir);
const ffprobe = findExecutableFullPath("ffprobe", exec_dir);
const filepicker = findExecutableFullPath("filepicker", exec_dir);

if (!fileExistsSync(ffmpeg)) {
  logger.error("ffmpeg not found. Install ffmpeg and make sure it's in your path.");
  process.exit(1);
}

if (!fileExistsSync(ffprobe)) {
  logger.error("ffprobe not found. Install ffmpeg and make sure it's in your path.");
  process.exit(1);
}

if (!fileExistsSync(filepicker)) {
  logger.error("filepicker not found.");
  process.exit(1);
}

function findExecutableFullPath(programName, extraPath = "") {
  programName = ensureProgramExt(programName);
  const envPath = (process.env.PATH || '');
  const pathArr = envPath.split(path.delimiter);
  if (extraPath) {
    pathArr.unshift(extraPath);
  }
  return pathArr
    .map((x) => path.join(x, programName))
    .find((x) => fileExistsSync(x));
}

function fileExistsSync (filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

function ensureProgramExt(programPath) {
  if (os.platform() == "win32") {
    return programPath + ".exe";
  }
  return programPath;
}

// Record all started processes, and kill them if the coapp
// ends, crashes or is killed by the browser.
let to_kill = new Set();

function spawn(arg0, argv) {
  const { spawn } = require('child_process');
  let process = spawn(arg0, argv);
  if (process.pid) {
    to_kill.add(process);
    process.on("exit", () => to_kill.delete(process));
  }
  return process;
}

for (let e of ["exit", "SIGINT", "SIGTERM", "uncaughtException"]) {
  process.on(e, () => {
    for (let process of to_kill) {
      try {
        process.kill(9);
      } catch (_) {
        /* */
      }
    }
    process.exit(0);
  });
}

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

exports.star_listening = () => {

  const convertChildren = new Map();

  rpc.listen({

    "filepicker": async (action, directory, title, filename) => {
      let args = [action, directory, title];
      if (filename) {
        args.push(filename);
      }
      let stdout = await new Promise((ok, ko) => {
        let proc = spawn(filepicker, args);
        let stdout = "";
        proc.stdout.on("data", data => stdout += data);
        proc.on("exit", (code) => {
          if (code == 0) {
            ok(stdout);
          } else {
            ok("");
          }
        });
      });
      return stdout;
    },

    "abortConvert": (pid) => {
      let child = convertChildren.get(pid);
      if (child && child.exitCode == null) {
        // Give ffmpeg a chance to gracefully die.
        child.stdin.write("q");
        setTimeout(() => {
          if (child && child.exitCode == null) {
            child.kill(9);
          }
        }, 4000);
      }
    },

    // FIXME: Partly in test suite. But just for hls retrieval.
    "convert": async (args = ["-h"], options = {}) => {
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

      if (!child.pid) {
        throw new Error("Process creation failed");
      }

      convertChildren.set(child.pid, child);

      let stderr = "";

      let on_exit = new Promise((resolve) => {
        child.on("exit", (code) => {
          convertChildren.delete(child.pid);
          resolve({exitCode: code, pid: child.pid, stderr});
        });
      });

      child.stderr.on("data", (data) => stderr += data);

      if (options.startHandler) {
        rpc.call("convertStartNotification", options.startHandler, child.pid);
      }

      const PROPS_RE = new RegExp("\\S+=\\s*\\S+");
      const NAMEVAL_RE = new RegExp("(\\S+)=\\s*(\\S+)");
      let progressInfo = {};

      const on_line = async (line) => {
        let props = line.match(PROPS_RE) || [];
        props.forEach((prop) => {
          let m = NAMEVAL_RE.exec(prop);
          if (m) {
            progressInfo[m[1]] = m[2];
          }
        });
        // last line of block is "progress"
        if (progressInfo["progress"]) {
          let info = progressInfo;
          progressInfo = {};
          if (typeof info["out_time_ms"] !== "undefined") {
            // out_time_ms is in ns, not ms.
            const seconds = parseInt(info["out_time_ms"]) / 1_000_000;
            try {
              await rpc.call("convertOutput", options.progressTime, seconds, info);
            } catch (_) {
              // Extension stopped caring
              child.kill();
            }
          }
        }
      };

      if (options.progressTime) {
        child.stdout.on("data", (lines) => {
          lines.toString("utf-8").split("\n").forEach(on_line);
        });
      }

      return on_exit;
    },
    // FIXME: Partly in test suite. But just for hls retrieval.
    "probe": (input, json = false, headers = []) => {
      return new Promise((resolve, reject) => {
        let args = [];
        if (json) {
          args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams"];
        }
        if (headers.length) {
          args.push("-headers");
          args.push(headers.map((h) => {
            return h.name + ": " + h.value;
          }).join("\r\n") + "\r\n");
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
};

exports.info = () => {
  return new Promise((resolve, reject) => {
    let convProcess = spawn(ffmpeg, ["-h"]);
    let done = false;

    function Parse(data) {
      if (done) {
        return;
      }
      let str = data.toString("utf8");
      logger.info("stdout:", str);
      let words = str.split(" ");
      if (words[0] == "ffmpeg" && words[1] == "version") {
        done = true;
        resolve({
          program: "ffmpeg",
          version: words[2],
          converterBinary: ffmpeg,
        });
      }
    }

    convProcess.stdout.on("data", Parse);
    convProcess.stderr.on("data", Parse);
    convProcess.on("exit", (_code) => {
      if (!done) {
        reject(new Error("Exit without answer"));
      }
    });
  });
};
