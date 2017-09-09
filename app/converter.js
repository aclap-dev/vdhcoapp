
const path = require('path');
const { spawn } = require('child_process');

const logger = require('./logger');
const rpc = require('./weh-rpc');

var platform;
if(process.platform=="linux")
	platform = "linux";
else if(process.platform=="darwin")
	platform = "mac";
else if(/^win/.test(process.platform))
	platform = "win";
else
	throw new Error("Unsupported platform",process.platform);

var arch;
if(process.arch=="x64")
	arch = "64";
else if(process.arch=="ia32")
	arch = "32";
else
	throw new Error("Unsupported architecture",process.arch);

const binaryDir = path.join(path.dirname(process.execPath),"..","libav","build",platform,arch);
const binaryPath = path.join(binaryDir,"avconv");

logger.info("process.cwd",process.cwd);
logger.info("__dirname",__dirname);
logger.info("__filename",__filename);
logger.info("path.resolve('.')",path.resolve('.'));
logger.info("process.execPath",process.execPath);

rpc.listen({
	"converter.getVersion": () => {
		return new Promise((resolve, reject) => {
			logger.info("script",__dirname,__filename);
			logger.info("process.cwd",process.cwd());
			var convProcess = spawn(binaryPath, ["-h"], {
				env: {
					LD_LIBRARY_PATH: binaryDir
				}
			});
			var done = false;
			function Parse(data) {
				if(done) return;
				var str = data.toString("utf8");
				logger.info("stdout:",str);
				var m = /^(\S+).*?v.*?((?:\d+\.)+\d+)/.exec(str);
				if(m) {
					done = true;
					resolve({
						program: m[1],
						version: m[2],
						appBinary: process.execPath,
						converterBinary: binaryPath
					});
				}
			}
			convProcess.stdout.on("data", Parse);
			convProcess.stderr.on("data", Parse);
			convProcess.on("exit", (code) => {
				if(!done)
					reject(new Error("Exit without answer"));
			});
		})
	}
})

