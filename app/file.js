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

const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const logger = require('./logger');
const rpc = require('./weh-rpc');
const { spawn } = require('child_process');
const os = require('os');

const uniqueFileNames = {};

rpc.listen({
	"listFiles": (directory) => {
		return new Promise((resolve, reject) => {
			directory = path.resolve(process.env.HOME || process.env.HOMEDIR,directory);
			fs.readdir(directory,(err,files)=>{
				if(err)
					return reject(err);
				Promise.all(files.map((file)=>{
					return new Promise((resolve, reject) => {
						var fullPath = path.resolve(directory,file);
						fs.stat(fullPath,(err,stats)=>{
							if(err)
								return resolve(null);
							resolve([file,Object.assign(stats,{
								dir: stats.isDirectory(),
								path: fullPath
							})]);
						})
					})
				}))
				.then((files)=>{
					resolve(files);
				})
				.catch(reject);
			});
		});
	},
	"path.homeJoin": (...args)=>{
		return path.resolve(process.env.HOME||process.env.HOMEDIR,path.join(...args));
	},
	"getParents": (directory) => {
		return new Promise((resolve, reject) => {
			directory = path.resolve(process.env.HOME || process.env.HOMEDIR,directory);
			var parents = [];
			while(true) {
				var parent = path.resolve(directory,"..");
				if(!parent || parent==directory)
					return resolve(parents);
				parents.push(parent);
				directory = parent;
			}
		})
		.then((parents)=>{
			if(os.platform()=="win32") {
				return new Promise((resolve, reject) => {
					var outBuffers = [];
					var process = spawn("cmd");
					process.stdout.on("data", (data) => {
						outBuffers.push(data);
					});	
					process.stderr.on("data", (data) => {
						// need to consume data or process stalls
					});	
					process.on("exit", (exitCode) => {
						var out = Buffer.concat(outBuffers).toString("utf8");
						var lines = out.split("\n");
						var lastParent = parents[parents.length-1];
						lines.forEach((line)=>{
							var m = /^([0-9]*)\s+([A-Z]):\s*$/.exec(line);
							if(m) {
								if(m[1]) {
									var drive = m[2]+":\\";
									if(lastParent!==drive)
										parents.push(drive);
								}
							}
						});
						resolve(parents);
					});
					process.stdin.write('wmic logicaldisk get name,freespace\n');
					process.stdin.end();						
				});
			} else
				return parents;
		})
	},
	"makeUniqueFileName": (...args) => {
		return new Promise((resolve, reject) => {
			var filePath = path.resolve(process.env.HOME||process.env.HOMEDIR,path.join(...args));
			var index = uniqueFileNames[filePath] || 0;
			var dirName = path.dirname(filePath);
			var extName = path.extname(filePath);
			var baseName = path.basename(filePath,extName);
			var fileParts = /^(.*?)(?:\-(\d+))?$/.exec(baseName);
			if(fileParts[2])
				index = parseInt(fileParts[2]);
			function Check() {
				uniqueFileNames[filePath] = index + 1;
				var fileName = fileParts[1] + (index ? "-"+index : "") + extName;
				var fullName = path.join(dirName,fileName);
				fs.stat(fullName, (err)=>{
					if(err)
						resolve({
							filePath: fullName,
							fileName: fileName,
							directory: dirName
						});
					else {
						index = parseInt(index) + 1;
						Check();
					}
				});
			}
			Check();
		});
	},
	"tmp.file": (args) => {
		return new Promise((resolve, reject) => {
			tmp.file(args,(err,path,fd)=>{
				if(err)
					return reject(err);	
				resolve({ path, fd });
			});							
		});
	},
	"tmp.tmpName": (args={}) => {
		return new Promise((resolve, reject) => {
			tmp.tmpName(args,(err,filePath)=>{
				if(err)
					return reject(err);	
				resolve({ 
					filePath: filePath,
					fileName: path.basename(filePath),
					directory: path.dirname(filePath)
				});
			});							
		});
	},
	"fs.write": (...args) => {
		return new Promise((resolve, reject) => {
			args[1] = Uint8Array.from(JSON.parse("["+args[1]+"]"));
			fs.write(...args,(err,written)=>{
				if(err)
					return reject(err);
				resolve(written);
			});			
		});
	},
	"fs.close": (...args) => {
		return new Promise((resolve, reject) => {
			fs.close(...args,(err)=>{
				if(err)
					return reject(err);
				resolve();
			});						
		});
	},
	"fs.open": (...args) => {
		return new Promise((resolve, reject) => {
			fs.open(...args,(err,fd)=>{
				if(err)
					return reject(err);
				resolve(fd);
			});				
		});
	},
	"fs.stat": (...args) => {
		return new Promise((resolve, reject) => {
			fs.stat(...args,(err,stat)=>{
				if(err)
					return reject(err);
				resolve(stat);
			});						
		});
	},
	"fs.rename": (...args) => {
		return new Promise((resolve, reject) => {
			fs.rename(...args,(err)=>{
				if(err)
					return reject(err);
				resolve();
			});				
		})
	},
	"fs.unlink": (...args) => {
		return new Promise((resolve, reject) => {
			fs.unlink(...args,(err)=>{
				if(err)
					return reject(err);
				resolve();
			});				
		})
	},
	"fs.copyFile": (source,dest) => {
		return new Promise((resolve, reject) => {
			fs.copyFile(source,dest,(err)=>{
				if(err)
					return reject(err);
				resolve();			
			})
		})
	}
});

