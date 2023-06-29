const log4js = require('log4js');

let logAppender = {
  type: 'file',
  filename: '/tmp/coapp.logs'
};

log4js.configure({
  appenders: {
    logger: logAppender
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
