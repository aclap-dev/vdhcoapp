let simplelogger = require("simple-node-logger");

let logfile = "/tmp/paul.logs"; //process.env.WEH_NATIVE_LOGFILE;

if (!logfile) {
  module.exports = {
    info: () => {},
    error: () => {},
    warn: () => {},
    log: () => {},
  };
} else {
  let logger = simplelogger.createSimpleFileLogger(logfile);
  module.exports = logger;
}
