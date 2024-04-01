import simplelogger from "simple-node-logger";

const logfile = process.env.WEH_NATIVE_LOGFILE;
//const logfile = "/run/user/1000/vdhcoapp.log"; // debug

export default () => (!logfile) ? (
  {
    info: () => {},
    error: () => {},
    warn: () => {},
    log: () => {},
  }
) : (
  simplelogger.createSimpleFileLogger(logfile)
);
