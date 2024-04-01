import config from './config.js';

import os from 'os';

const globalState = {
  config,
  logger: null,
  rpc: null,
  converter: null,
};

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
  return globalState.converter.info().then((convInfo) => {
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
  (await import("./native-autoinstall.js")).install();
} else if (process.argv[2] == "uninstall") {
  (await import("./native-autoinstall.js")).uninstall();
} else if (process.argv[2] == "--version") {
  console.log(config.meta.version);
} else if (process.argv[2] == "--info") {
  info().then((info) => {
    console.log(JSON.stringify(info, null, "  "));
  }).catch((error) => {
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

  // note: this disables the exception handler
  // so exceptions will silently fail
  // fix: WEH_NATIVE_LOGFILE=/dev/stderr vdhcoapp

  const logger = (await import('./logger.js')).default();
  globalState.logger = logger;

  const rpc = (await import('./weh-rpc.js')).default();
  rpc.setLogger(logger);
  rpc.setDebugLevel(2);
  globalState.rpc = rpc;

  const converter = (await import('./converter.js')).default(globalState);
  globalState.converter = converter;

  (await import('./file.js')).default(globalState);
  (await import('./downloads.js')).default(globalState);
  (await import('./request.js')).default(globalState);
  (await import('./vm.js')).default(globalState);

  converter.start_listening();

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

  // start listening for RPC requests from stdin
  (await import('./native-messaging.js')).default(globalState);

  let m = `vdhcoapp is running successfully. `;
  m += `This is not intended to be used directly from the command line. `;
  m += `You should press Ctrl+C to exit. `;
  m += `If your browser is unable to detect the coapp, run: "vdhcoapp install".`;
  console.error(m);
}
