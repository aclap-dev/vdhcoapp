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

const dl = require('download');
const path = require('path');
const rpc = require('./weh-rpc');

var downloadFolder = path.join(process.env.HOME || process.env.HOMEDIR,"dwhelper");

var currentDownloadId = 0;

const downloads = {};
const NAME_PATTERN = new RegExp("/([^/]+?)(?:\\.([a-z0-9]{1,5}))?(?:\\?|#|$)","i");


function download(options) {
	if(!options.url)
		throw new Error("url not specified");
	if(!options.filename) {
		var m = NAME_PATTERN.exec(options.url);
		if(m)
			options.filename = m[1]+m[2];
		else
			options.filename = "file";
	}
	var dlOptions = {
		filename: options.filename,
		headers: {}
	};
	(options.headers||[]).forEach((header)=>{
		if(typeof header.value !== "undefined")
			dlOptions.headers[header.name] = header.value;
		else
			dlOptions.headers[header.name] = Buffer.from(header.binaryValue);
	});
	var downloadId = ++currentDownloadId;
	//var fileName = path.resolve(downloadFolder,options.filename);
	var downloadItem = dl(options.url,options.directory||downloadFolder,dlOptions);
	downloads[downloadId] = {
		downloadItem,
		totalBytes: 0,
		bytesReceived: 0,
		url: options.url,
		filename: path.resolve(options.directory||downloadFolder,options.filename),
		state: "in_progress",
		error: null
	}
	downloadItem.on('request', (request) => {
		var downloadEntry = downloads[downloadId];
		if(downloadEntry)
			downloadEntry.request = request;
	});
	downloadItem.on('response', (response) => {
		var downloadEntry = downloads[downloadId];
		var contentLength = response.headers['content-length'];
		if(downloadEntry && contentLength) {
			downloadEntry.totalBytes = parseInt(contentLength);
			response.on("data", (data) => {
				downloadEntry.bytesReceived += data.length;				
			});
		}
	});
	function RemoveEntry() {
		setTimeout(()=>{
			delete downloads[downloadId];
		},60000);
	}
	downloadItem.on('end', ()=>{
		var downloadEntry = downloads[downloadId];
		if(downloadEntry) {
			downloadEntry.state = "complete";
			RemoveEntry();
		}
	});
	downloadItem.on('error', (err)=>{
		var downloadEntry = downloads[downloadId];
		if(downloadEntry) {
			downloadEntry.state = "interrupted";
			downloadEntry.error = err.message || ""+err;
			RemoveEntry();
		}
	});
	return downloadId;
}

function search(query) {
	var downloadEntry = downloads[query.id];
	if(downloadEntry)
		return [{
			totalBytes: downloadEntry.totalBytes,
			bytesReceived: downloadEntry.bytesReceived,
			url: downloadEntry.url,
			filename: downloadEntry.filename,
			state: downloadEntry.state,
			error: downloadEntry.error
		}]
	else
		return [];
}

function cancel(downloadId) {
	var downloadEntry = downloads[downloadId];
	if(downloadEntry && downloadEntry.state=="in_progress") {
		downloadEntry.state = "interrupted";
		downloadEntry.error = "Aborted";	
		setTimeout(()=>{
			delete downloads[downloadId];
		},60000);
	}
}

rpc.listen({
	"downloads.download": download,
	"downloads.search": search,
	"downloads.cancel": cancel
});	
