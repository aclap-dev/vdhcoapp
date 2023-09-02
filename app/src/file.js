const fs = require('node:fs');
const path = require('path');
const tmp = require('tmp');
const rpc = require('./weh-rpc');
const { spawn } = require('child_process');
const os = require('os');
const base64 = require("base64-js");

const uniqueFileNames = {};
const MAX_FILE_ENTRIES = 1000;

rpc.listen({
  // In test suite
  "listFiles": (directory) => {
    return new Promise((resolve, reject) => {
      directory = path.resolve(os.homedir(), directory);
      fs.readdir(directory, (err, files) => {
        if (err) {
          return reject(err);
        }
        Promise.all(files.map((file) => {
          return new Promise((resolve, _reject) => {
            let fullPath = path.resolve(directory, file);
            fs.stat(fullPath, (err, stats) => {
              if (err) {
                return resolve(null);
              }
              resolve([file, Object.assign(stats, {
                dir: stats.isDirectory(),
                path: fullPath
              })]);
            });
          });
        })).then((files) => {
          if (files.length > MAX_FILE_ENTRIES) {
            files.sort((a, b) => {
              if (a[1].dir && !b[1].dir) {
                return -1;
              }
              if (!a[1].dir && b[1].dir) {
                return 1;
              }
              return 0;
            });
            resolve(files.slice(0, MAX_FILE_ENTRIES));
          } else {
            resolve(files);
          }
        })
          .catch(reject);
      });
    });
  },
  // In test suite
  "path.homeJoin": (...args) => {
    return path.resolve(os.homedir(), path.join(...args));
  },
  // In test suite
  "getParents": (directory) => {
    return new Promise((resolve, _reject) => {
      directory = path.resolve(os.homedir(), directory);
      let parents = [];
      while (true) {
        let parent = path.resolve(directory, "..");
        if (!parent || parent == directory) {
          return resolve(parents);
        }
        parents.push(parent);
        directory = parent;
      }
    })
      .then((parents) => {
        if (os.platform() == "win32") {
          return new Promise((resolve, _reject) => {
            let outBuffers = [];
            let process = spawn("cmd");
            process.stdout.on("data", (data) => {
              outBuffers.push(data);
            });
            process.stderr.on("data", (_data) => {
              // need to consume data or process stalls
            });
            process.on("exit", (_exitCode) => {
              let out = Buffer.concat(outBuffers).toString("utf8");
              let lines = out.split("\n");
              let lastParent = parents[parents.length - 1];
              lines.forEach((line) => {
                let m = /^([0-9]*)\s+([A-Z]):\s*$/.exec(line);
                if (m) {
                  if (m[1]) {
                    let drive = m[2] + ":\\";
                    if (lastParent !== drive) {
                      parents.push(drive);
                    }
                  }
                }
              });
              resolve(parents);
            });
            process.stdin.write('wmic logicaldisk get name,freespace\n');
            process.stdin.end();
          });
        } else {
          return parents;
        }
      });
  },
  // In test suite
  "makeUniqueFileName": (...args) => {
    return new Promise((resolve, _reject) => {
      let filePath = path.resolve(os.homedir(), path.join(...args));
      let index = uniqueFileNames[filePath] || 0;
      let dirName = path.dirname(filePath);
      let extName = path.extname(filePath);
      let baseName = path.basename(filePath, extName);
      let fileParts = /^(.*?)(?:\-(\d+))?$/.exec(baseName);
      if (fileParts[2]) {
        index = parseInt(fileParts[2]);
      }

      function Check() {
        uniqueFileNames[filePath] = index + 1;
        let fileName = fileParts[1] + (index ? "-" + index : "") + extName;
        let fullName = path.join(dirName, fileName);
        fs.stat(fullName, (err) => {
          if (err) {
            resolve({
              filePath: fullName,
              fileName: fileName,
              directory: dirName
            });
          } else {
            index = parseInt(index) + 1;
            Check();
          }
        });
      }

      Check();
    });
  },
  // In test suite
  "tmp.file": (args) => {
    return new Promise((resolve, reject) => {
      tmp.file(args, (err, path, fd) => {
        if (err) {
          return reject(err);
        }
        resolve({ path, fd });
      });
    });
  },
  // In test suite
  "tmp.tmpName": (args = {}) => {
    return new Promise((resolve, reject) => {
      tmp.tmpName(args, (err, filePath) => {
        if (err) {
          return reject(err);
        }
        resolve({
          filePath: filePath,
          fileName: path.basename(filePath),
          directory: path.dirname(filePath)
        });
      });
    });
  },
  // In test suite
  "fs.write2": (...args) => {
    return new Promise((resolve, reject) => {
      const byte_array = base64.toByteArray(args[1]);
      args[1] = byte_array;
      fs.write(...args, (err, written) => {
        if (err) {
          reject(err);
        } else {
          resolve(written);
        }
      });
    });
  },
  // In test suite
  "fs.write": (...args) => {
    return new Promise((resolve, reject) => {
      args[1] = Uint8Array.from(JSON.parse("[" + args[1] + "]"));
      fs.write(...args, (err, written) => {
        if (err) {
          return reject(err);
        }
        resolve(written);
      });
    });
  },
  // In test suite
  "fs.close": (...args) => {
    return new Promise((resolve, reject) => {
      fs.close(...args, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  },
  // In test suite
  "fs.open": (...args) => {
    return new Promise((resolve, reject) => {
      fs.open(...args, (err, fd) => {
        if (err) {
          return reject(err);
        }
        resolve(fd);
      });
    });
  },
  // In test suite
  "fs.stat": (...args) => {
    return new Promise((resolve, reject) => {
      fs.stat(...args, (err, stat) => {
        if (err) {
          return reject(err);
        }
        resolve(stat);
      });
    });
  },
  // In test suite
  "fs.rename": (...args) => {
    return new Promise((resolve, reject) => {
      fs.rename(...args, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  },
  // In test suite
  "fs.unlink": (...args) => {
    return new Promise((resolve, reject) => {
      fs.unlink(...args, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  },
  // In test suite
  "fs.copyFile": (source, dest) => {
    return new Promise((resolve, reject) => {
      fs.copyFile(source, dest, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  },
  // In test suite
  "fs.readFile": (...args) => {
    return new Promise((resolve, reject) => {
      fs.readFile(...args, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  },
  // In test suite
  "fs.mkdirp": (path) => {
    return new Promise((resolve, reject) => {
      fs.mkdir(path, {recursive: true}, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }
});
