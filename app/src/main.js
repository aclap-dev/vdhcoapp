const config = require('config.json');
const converter = require('./converter');
const os = require("os");

function info() {
  let result = {
    id: config.meta.id,
    name: config.meta.name,
    version: config.meta.version,
    binary: process.execPath,
    displayName: config.meta.name,
    description: config.meta.description,
    target: config.target,
    home: os.homedir() || ""
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

if (process.argv[2] == "install") {
  require("./native-autoinstall").install();
} else if (process.argv[2] == "uninstall") {
  require("./native-autoinstall").uninstall();
} else if (process.argv[2] == "--version") {
  console.log(config.meta.version);
} else if (process.argv[2] == "--info") {
  info().then(info => {
    console.log(JSON.stringify(info, null, "  "));
  }).catch(error => {
    console.error(error);
  });
} else if (process.argv[2] == "--help") {
  let help = `
Commands:
  vdhcoapp install    # register browser JSON files in browser-specific locations.
  vdhcoapp uninstall  # remove JSON files.

Options:
  --help    # this help
  --info    # list extra info from converter
  --version # show coapp version
  --user    # force installation in user mode (automatic if run as non-root user)
  --system  # force installation system wide (automatic if run as root user)
`;
  console.log(help);
} else {

  require('./native-messaging');
  const logger = require('./logger');
  const rpc = require('./weh-rpc');

  rpc.setLogger(logger);
  rpc.setDebugLevel(2);

  require('./file');
  require('./downloads');
  require('./request');
  require('./vm');

  converter.star_listening();

  rpc.listen({
    // In test suite
    quit: () => {
      process.exit(0);
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
    info,
  });

  let m = `vdhcoapp is running successfully. `;
  m += `This is not intended to be used directly from the command line. `;
  m += `You should press Ctrl+C to exit. `;
  m += `If your browser is unable to detect the coapp, run: "vdhcoapp install".`;
  console.error(m);
}
