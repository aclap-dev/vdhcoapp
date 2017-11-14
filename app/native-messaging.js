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
const logger = require('./logger');

logger.info("started");

function exitHandler(reason,err) {
    logger.info('ended');
	if (err) logger.warn(err.stack);
	if(reason=="exit")
		logger.shutdown(()=>{
			process.exit(err ? -1 : 0);
		})
}
process.on('exit', exitHandler.bind(null,'exit'));
process.on('uncaughtException', exitHandler.bind(null,'uncaughtException'));

let msgBacklog = Buffer.alloc(0);
let msgExpectedLength=0, msgCurrentLength=0;

function AppendInputString(chunk) {
	msgBacklog = Buffer.concat([msgBacklog,chunk]);
	while(true) {
        if (msgBacklog.length < 4)
			return;
		let msgLength = msgBacklog.readUInt32LE(0);
		if (msgBacklog.length < msgLength + 4)
			return;
		if(msgLength==0)
			return;
		try {
			let msgString = msgBacklog.toString("utf8",4,msgLength+4);
			logger.info("msgString",msgString);
			let msgObject = JSON.parse(msgString);
			rpc.receive(msgObject,Send);
		} catch(err) {
			logger.error("Could not read message",err);
		}
		msgBacklog = msgBacklog.slice(msgLength+4);
	}
}

function Send(message) {
	let msgStr = Buffer.from(JSON.stringify(message),"utf8");
	let lengthBuf = Buffer.alloc(4);
	lengthBuf.writeUInt32LE(msgStr.length,0);
	process.stdout.write(lengthBuf);
	process.stdout.write(msgStr);
}

rpc.setPost(Send);

process.stdin.on('data', (chunk) => {
    AppendInputString(chunk);
});

