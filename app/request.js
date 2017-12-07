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

const rpc = require('./weh-rpc');
const got = require('got');
const logger = require('./logger');

var currentIndex = 0;

var requestStore = {};

const MAX_SIZE = 50000;
const EXPIRE_DATA_TIMEOUT = 30000;

function GetData(id) {
	var reqInfo = requestStore[id];
	if(!reqInfo)
		throw new Error("No such request id");
	if(reqInfo.timer)
		clearTimeout(reqInfo.timer);
	if(reqInfo.error) {
		delete requestStore[id];
		throw reqInfo.error;
	}
	reqInfo.timer = setTimeout(()=>{
		logger.warn("Expired data for request",reqInfo.url);
		if(reqInfo.reject) {
			reqInfo.reject(new Error("Timeout"));
			delete reqInfo.resolve;
			delete reqInfo.reject;
		}
		delete requestStore[id];
	},EXPIRE_DATA_TIMEOUT);
	var data, more = true;
	if(reqInfo.type=="buffer") {
		var retBuffers = [];
		var retLength = 0;
		while(reqInfo.data.length>0 && retLength+reqInfo.data[0].length<MAX_SIZE) {
			let buffer = reqInfo.data.shift();
			retBuffers.push(buffer);
			retLength += buffer.length;
		}
		var remainingLength = MAX_SIZE-retLength;
		if(reqInfo.data.length>0 && remainingLength>0) {
			let buffer = reqInfo.data.shift();
			let buffer2 = buffer.slice(0,remainingLength);
			retBuffers.push(buffer2);
			retLength += buffer2.length;
			let buffer3 = buffer.slice(remainingLength);
			reqInfo.data.unshift(buffer3);
		}
		more = reqInfo.running || reqInfo.data.length>0;
		if(!more) {
			delete requestStore[id];
			clearTimeout(reqInfo.timer);
			reqInfo.timer = null;
		}
		if(retBuffers.length>0) {
			data = new Buffer(retLength);
			let length = 0;
			retBuffers.forEach((buf)=>{
				data.set(buf,length);
				length+=buf.length;
			});
		} else if(!more)
			data = new Buffer(0);
		else
			return new Promise((resolve, reject) => {
				reqInfo.resolve = resolve;
				reqInfo.reject = reject;				
			});
	} else {
		data = reqInfo.data.substr(reqInfo.position,Math.min(MAX_SIZE,reqInfo.data.length-reqInfo.position));
		reqInfo.position += data.length;
		if(reqInfo.position==reqInfo.data.length) {
			more = false;
			delete requestStore[id];
			clearTimeout(reqInfo.timer);
			reqInfo.timer = null;
		}
	}
	return {
		id,
		data,
		more
	}
}

function GotHeaders(headers=[]) {
	var gotHeaders = {};
	headers.forEach((header)=>{
		if(typeof header.value !== "undefined")
			gotHeaders[header.name] = header.value;
		else
			gotHeaders[header.name] = Buffer.from(header.binaryValue);
	});
	return gotHeaders;
}

rpc.listen({
	"request": (url,options) => {
		options = options || {};
		options.headers = GotHeaders(options.headers);	
		return new Promise((resolve, reject) => {
			var id = ++currentIndex;
			got.get(url,options)
				.on('error',reject)
				.then((response)=>{
					requestStore[id] = {
						url: url,
						position: 0,
						data: response.body
					};
					resolve(GetData(id));
				})
				.catch(reject);
		});
	},
	"requestExtra": (id) => {
		return GetData(id);
	},
	"requestBinary": (url,options) => {
		options = options || {};
		var id = ++currentIndex;
		var reqInfo = requestStore[id];
		if(!reqInfo)
			reqInfo = requestStore[id] = {
				id,
				type: "buffer",
				data: [],
				running: true
			}
		options.headers = GotHeaders(options.headers);
		got.stream(url,options)
			.on('error',(err)=>{
				if(reqInfo.timer)
					clearTimeout(reqInfo.timer);
				if(reqInfo.reject) {
					delete requestStore[id];
					reqInfo.reject(err);
				} else
					reqInfo.error = err;
			})
			.on('data',(data)=>{
				reqInfo.data.push(data);
				if(reqInfo.resolve) {
					reqInfo.resolve(GetData(id));
					delete reqInfo.resolve;
					delete reqInfo.reject;
				}
			})
			.on('end',()=>{
				reqInfo.running = false;
				if(reqInfo.resolve) {
					reqInfo.resolve(GetData(id));
					delete reqInfo.resolve;
					delete reqInfo.reject;	
				}
			});
			return GetData(id);
	}
});
