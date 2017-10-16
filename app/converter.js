
const path = require('path');
const { spawn } = require('child_process');
const open = require('open');

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
const probeBinaryPath = path.join(binaryDir,"avprobe");
const playBinaryPath = path.join(binaryDir,"avplay");

logger.info("process.cwd",process.cwd);
logger.info("__dirname",__dirname);
logger.info("__filename",__filename);
logger.info("path.resolve('.')",path.resolve('.'));
logger.info("process.execPath",process.execPath);

function ExecConverter(args) {
	var outBuffers = [];
	return new Promise((resolve, reject) => {
		var convProcess = spawn(binaryPath, args, {
			env: {
				LD_LIBRARY_PATH: binaryDir
			}
		});
		convProcess.stdout.on("data", (data) => {
			outBuffers.push(data);
		});	
		convProcess.stderr.on("data", (data) => {
			// need to consume data or process stalls
		});	
		convProcess.on("exit", (exitCode) => {
			if(exitCode!==0)
				return reject(new Error("Converter returned exit code "+exitCode));
			var out = Buffer.concat(outBuffers).toString("utf8");
			resolve(out);
		});
	});
}

rpc.listen({
	"convert": (args=["-h"],options={}) => {
		return new Promise((resolve, reject) => {
				var convProcess = spawn(binaryPath, args, {
				env: {
					LD_LIBRARY_PATH: binaryDir
				}
			});
			["stdout","stderr"].forEach((stream) => {
				convProcess[stream].on("data", (data) => {
					if(options[stream])
						rpc.call("convertOutput",stream,options[stream],data.toString("utf8"))
							.catch((err) => {
								logger.error("Error calling convertOutput ("+stream+
									") for convert call '"+args.join(" ")+"':",err);
							});
				});	
			});
			convProcess.on("exit", (exitCode) => {
				resolve(exitCode);
			});
		});
	},
	"probe": (filePath) => {
		return new Promise((resolve, reject) => {
				var probeProcess = spawn(probeBinaryPath, [filePath], {
				env: {
					LD_LIBRARY_PATH: binaryDir
				}
			});
			var streams = {
				stdout: "",
				stderr: ""
			}
			Object.keys(streams).forEach((stream) => {
				probeProcess[stream].on("data", (data) => {
					streams[stream] += data.toString("utf8");
				});	
			});
			probeProcess.on("exit", (exitCode) => {
				if(exitCode!==0)
					return reject(new Error(""+exitCode+" "+streams.stderr));
				var info={};
				var m=/([0-9]{2,})x([0-9]{2,})/g.exec(streams.stderr);
				if(m) {
					info.width = parseInt(m[1]);
					info.height = parseInt(m[2]);
				}
				m=/Duration: ([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{2})/g.exec(streams.stderr);
				if(m)
					info.duration = parseInt(m[1])*3600+parseInt(m[2])*60+parseInt(m[3]);
				m=/Video:\s+([^\s\(,]+)/g.exec(streams.stderr);
				if(m)
					info.videoCodec = m[1];
				m=/([0-9]+(?:\.[0-9]+)?)\s+fps\b/g.exec(streams.stderr);
				if(m)
					info.fps = parseFloat(m[1]);
		
				resolve(info);
			});
		});
	},
	"avplay": (filePath) => {
		return new Promise((resolve, reject) => {
			var playProcess = spawn(playBinaryPath, [filePath], {
				env: Object.assign({},process.env,{
					LD_LIBRARY_PATH: binaryDir,
				})
			});
			var stderr = [];
			playProcess.stderr.on("data", (data) => {
				stderr.push(data.toString("utf8"));
			});	
			playProcess.on("exit", (exitCode) => {
				if(exitCode!==0)
					reject(new Error(stderr.slice(1).join("")));
				else
					resolve();
			});
		});
	},
	"codecs": () => {
		return ExecConverter(["-codecs"])
			.then((out)=>{
				var lines = out.split("\n");
				var result = {};
				lines.forEach((line)=>{
					var m = /^\s*(\.|D)(\.|E)(\.|V|A|S)(\.|I)(\.|L)(\.|S)\s+([^\s]+)\s+(.*?)\s*$/.exec(line);
					if(!m)
						return;
					result[m[7]] = {
						d: m[1]!=".",
						e: m[2]!=".",
						t: m[3]=="." && null || m[3],
						i: m[4]!=".",
						l: m[5]!=".",
						s: m[6]!=".",
						_: m[8]
					}
				});
				return result;		
			});
	},
	"formats": () => {
		return ExecConverter(["-formats"])
			.then((out)=>{
				var lines = out.split("\n");
				var result = {};
				lines.forEach((line)=>{
					var m = /^\s*(\.|D)(\.|E)\s+([^\s]+)\s+(.*?)\s*$/.exec(line);
					if(!m)
						return;
					result[m[3]] = {
						d: m[1]!=".",
						e: m[2]!=".",
						_: m[4]
					}
				});
				return result;		
			});
	},
	"open": (filePath) => {
		open(filePath);
	},

});

exports.info = () => {
	return new Promise((resolve, reject) => {
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
