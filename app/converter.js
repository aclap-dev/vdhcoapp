/*
vdhcoapp: Video DownloadHelper Companion app

Copyright (C) 2017  downloadhelper.net

This file is part of vdhcoapp.

Vdhcoapp is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 2 of the License, or
(at your option) any later version.

Vdhcoapp is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Vdhcoapp. If not, see <http://www.gnu.org/licenses/>
*/

const path = require('path');
const { spawn } = require('child_process');
const opn = require('opn');
const { ffmpeg, ffprobe, ffplay } = require('./binaries');

const logger = require('./logger');
const rpc = require('./weh-rpc');

logger.info("process.cwd",process.cwd);
logger.info("__dirname",__dirname);
logger.info("__filename",__filename);
logger.info("path.resolve('.')",path.resolve('.'));
logger.info("process.execPath",process.execPath);

function ExecConverter(args) {
	var outBuffers = [];
	return new Promise((resolve, reject) => {
		var convProcess = spawn(ffmpeg, args);
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

const PARSETIME_RE = new RegExp("time=([0-9]+):([0-9]+):([0-9]+)");

rpc.listen({
	"convert": (args=["-h"],options={}) => {
		return new Promise((resolve, reject) => {
			var convProcess = spawn(ffmpeg, args);
			var stdErrParts = [];
			var stdErrSize = 0;

			convProcess.stderr.on("data",(data)=>{
				// just consume data
			});

			convProcess.stderr.on("data",(data)=>{
				var str = data.toString("utf8");
				var m = PARSETIME_RE.exec(str);
				if(m) {
					if(options.progressTime) {
						var frameTime = parseFloat(m[1])*3600 + parseFloat(m[2])*60 + parseFloat(m[3]);
						rpc.call("convertOutput",options.progressTime,frameTime)
							.catch((err)=>{
								convProcess.kill();
							});
					}
				} else {
					const maxSize = 20000;
					if(stdErrSize+str.length>=maxSize)
						str = str.substr(0,maxSize-stdErrSize);
					if(str.length>0) {
						stdErrParts.push(str);
						stdErrSize+=str.length;
					}
				}
			});

			convProcess.on("exit", (exitCode) => {
				resolve({exitCode,stderr:stdErrParts.join("")});						
			});
		});
	},
	"probe": (filePath,json=false) => {
		return new Promise((resolve, reject) => {
			var args = [];
			if(json)
				args = ["-v","quiet","-print_format","json","-show_format","-show_streams"];
			args.push(filePath);
			var probeProcess = spawn(ffprobe, args);
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
					return reject(new Error("Exit code: "+exitCode+"\n"+streams.stderr));
				if(json)
					try {
						resolve(streams.stdout);
					} catch(e) {
						reject(new Error("Invalid format: "+e.message));
					}
				else {
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
					m=/Audio:\s+([^\s\(,]+)/g.exec(streams.stderr);
					if(m)
						info.audioCodec = m[1];
					m=/([0-9]+(?:\.[0-9]+)?)\s+fps\b/g.exec(streams.stderr);
					if(m)
						info.fps = parseFloat(m[1]);
			
					resolve(info);
				}
			});
		});
	},
	"play": (filePath) => {
		return new Promise((resolve, reject) => {
			var playProcess = spawn(ffplay, [filePath]);
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
					if(!m || m[7]==='=')
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
					var m = /^\s*(\.| |D)(\.| |E)\s+([^\s]+)\s+(.*?)\s*$/.exec(line);
					if(!m || m[3]==='=')
						return;
					result[m[3]] = {
						d: m[1]=="D",
						e: m[2]=="E",
						_: m[4]
					}
				});
				return result;		
			});
	},
	"open": (filePath) => {
		opn(filePath);
	},

});

exports.info = () => {
	return new Promise((resolve, reject) => {
		var convProcess = spawn(ffmpeg, ["-h"]);
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
					converterBinary: ffmpeg, 
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
