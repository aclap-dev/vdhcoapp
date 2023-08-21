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

if (process.argv[2] == "install") {
require("./native-autoinstall").install();
}
if (process.argv[2] == "uninstall") {
require("./native-autoinstall").uninstall();
}

require('./native-messaging');
const logger = require('./logger');
const rpc = require('./weh-rpc');

rpc.setLogger(logger);
rpc.setDebugLevel(2);

const converter = require('./converter');
require('./file');
require('./downloads');
require('./request');

const manifest = require('../package');
const config = require('../config');

rpc.listen({
	quit: () => {
		logger.shutdown(() => {
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
		let result = {
			id: config.id,
			name: manifest.name,
			version: manifest.version,
			binary: process.execPath,
			displayName: config.name,
			description: config.description,
			home: process.env.HOME || process.env.HOMEDIR || ""
		};
		return converter.info()
			.then((convInfo) => {
				return Object.assign(result, {
					converterBinary: convInfo.converterBinary,
					converterBase: convInfo.program,
					converterBaseVersion: convInfo.version
				});
			})
			.catch((error) => {
				return Object.assign(result, {
					converterError: error.message
				});
			});
	}
});
