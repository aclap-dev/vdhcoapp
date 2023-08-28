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
require('./vm');

const config = require('../../dist/config.json');

rpc.listen({
  // In test suite
  quit: () => {
    logger.shutdown(() => {
      process.exit(0);
    });
  },
  // In test suite
  env: () => {
    return process.env;
  },
  // In test suite
  ping: (arg) => {
    return arg;
  },
  // In test suite
  info: () => {
    let result = {
      id: config.meta.id,
      name: config.meta.name,
      version: config.meta.version,
      binary: process.execPath,
      displayName: config.meta.name,
      description: config.meta.description,
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
