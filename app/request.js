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
	var data = reqInfo.data.substr(reqInfo.position,Math.min(MAX_SIZE,reqInfo.data.length-reqInfo.position));
	reqInfo.position += data.length;
	var more = true;
	if(reqInfo.position==reqInfo.data.length) {
		more = false;
		delete requestStore[id];
	} else {
		reqInfo.timer = setTimeout(()=>{
			logger.warn("Expired data for request",reqInfo.url);
			delete requestStore[id];
		},EXPIRE_DATA_TIMEOUT);
	}
	return {
		id,
		data,
		more
	}
}

rpc.listen({
	"request": (url,options={}) => {
		var gotHeaders = {};
		(options.headers||[]).forEach((header)=>{
			if(typeof header.value !== "undefined")
				gotHeaders[header.name] = header.value;
			else
				gotHeaders[header.name] = Buffer.from(header.binaryValue);
		});
		options.headers = gotHeaders;
	
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
	}
});
