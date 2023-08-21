if (process.argv[2] == "install") {
  require("./native-autoinstall").install();
}
if (process.argv[2] == "uninstall") {
  require("./native-autoinstall").uninstall();
}

require('./native-messaging');
const logger = require('./logger');
const rpc = require('./weh-rpc');

rpc.setLogger(logger);
rpc.setDebugLevel(2);

const converter = require('./converter');
require('./file');
require('./downloads');
require('./request');

const manifest = require('../package');
const config = require('../config');

rpc.listen({
  // FIXME: test
  quit: () => {
    logger.shutdown(() => {
      process.exit(0);
    });
  },
  // FIXME: test
  env: () => {
    return process.env;
  },
  // FIXME: test
  ping: (arg) => {
    return arg;
  },
  // FIXME: test
  info: () => {
    let result = {
      id: config.id,
      name: manifest.name,
      version: manifest.version,
      binary: process.execPath,
      displayName: config.name,
      description: config.description,
      home: process.env.HOME || process.env.HOMEDIR || ""
    };
    return converter.info().then((convInfo) => {
      return Object.assign(result, {
        converterBinary: convInfo.converterBinary,
        converterBase: convInfo.program,
        converterBaseVersion: convInfo.version
      });
    }).catch((error) => {
      return Object.assign(result, {
        converterError: error.message
      });
    });
  }
});
