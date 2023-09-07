let simplelogger = require("simple-node-logger");

let logfile = process.env.WEH_NATIVE_LOGFILE;

if (!logfile) {
  module.exports = {
    info: () => {},
    error: () => {},
    warn: () => {},
    log: () => {},
  };
} else {
  let logger = simplelogger.createSimpleFileLogger(logfile);
  logger.setLevel('debug');
  module.exports = logger;
}
