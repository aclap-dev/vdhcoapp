/*
 * weh - WebExtensions Helper
 *
 * @summary workflow and base code for developing WebExtensions browser add-ons
 * @author Michel Gutierrez
 * @link https://github.com/mi-g/weh
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
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
	logger.info("Send",message);
	let msgStr = JSON.stringify(message);
	let lengthBuf = Buffer.alloc(4);
	lengthBuf.writeUInt32LE(msgStr.length,0);
	process.stdout.write(lengthBuf);
	process.stdout.write(msgStr);
}

rpc.setPost(Send);

process.stdin.on('data', (chunk) => {
    AppendInputString(chunk);
});

