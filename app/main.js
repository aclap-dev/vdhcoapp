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

if(process.argv[2]=="install")
	require("./native-autoinstall").install();
if(process.argv[2]=="uninstall")
	require("./native-autoinstall").uninstall();

require('./native-messaging');
const logger = require('./logger');
const rpc = require('./weh-rpc');

rpc.setLogger(logger);
rpc.setDebugLevel(2);

const converter = require('./converter');
require('./file');
const manifest = require('../package');
const config = require('../config');

rpc.listen({
	quit: () => {
		logger.shutdown(()=>{
			process.exit(0);						
		});
	},
	env: () => {
		return process.env;
	},
	ping: (arg) => {
		return arg;
	},
	info: () => {
		var result = {
			id: config.id,
			name: manifest.name,
			version: manifest.version,
			binary: process.execPath,
			displayName: config.name,
			description: config.description
		};
		return converter.info()
			.then((convInfo)=>{
				return Object.assign(result, {
					converterBinary: convInfo.converterBinary,
					converterBase: convInfo.program,
					converterBaseVersion: convInfo.version
				});
			})
			.catch((error)=>{
				return Object.assign(result, {
					converterError: error.message
				});
			});
	}
});

