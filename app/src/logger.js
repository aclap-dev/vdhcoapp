const log4js = require('log4js');
const _ = require('./null-appender.js');

const silent = {
  type: 'app/src/null-appender'
};

const file = {
  type: 'file',
  filename: process.env.WEH_NATIVE_LOGFILE
};

log4js.configure({
  appenders: {
    logger: process.env.WEH_NATIVE_LOGFILE ? file : silent,
  },
  categories: {
    default: { appenders: ['logger'], level: process.env.WEH_NATIVE_LOGLEVEL || 'debug' }
  }
});

const logger = log4js.getLogger('logger');

logger.shutdown = (callback) => {
  log4js.shutdown(callback);
};

module.exports = logger;
