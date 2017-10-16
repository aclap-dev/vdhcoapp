
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const logger = require('./logger');
const rpc = require('./weh-rpc');

const uniqueFileNames = {};

rpc.listen({
	"makeUniqueFileName": (filePath) => {
		return new Promise((resolve, reject) => {
			var index = uniqueFileNames[filePath] || 0;
			var dirName = path.dirname(filePath);
			var extName = path.extname(filePath);
			var baseName = path.basename(filePath,extName);
			var fileParts = /^(.*?)(?:\-(\d+))?$/.exec(baseName);
			if(fileParts[2])
				index = parseInt(fileParts[2]);
			function Check() {
				uniqueFileNames[filePath] = index + 1;
				var fullName = path.join(dirName,fileParts[1] + (index ? "-"+index : "") + extName);
				fs.stat(fullName, (err)=>{
					if(err)
						resolve(fullName);
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
	}
});

