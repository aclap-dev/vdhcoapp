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

const yargs = require('yargs').argv;
if(yargs._.length==0 || yargs._[0]=="install")
	require("./native-autoinstall").install();
if(yargs._[0]=="uninstall")
	require("./native-autoinstall").uninstall();

require('./native-messaging');
const logger = require('./logger');
const rpc = require('./weh-rpc');

rpc.setLogger(logger);
rpc.setDebugLevel(2);

require('./converter');

rpc.listen({
	quit: () => {
		logger.shutdown(()=>{
			process.exit(0);						
		});
	},
	getEnv: () => {
		return process.env;
	}
});

