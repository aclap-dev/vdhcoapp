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

const log4js = require('log4js');
const nullAppender = require('./null-appender.js');

var logAppender = {
	type: 'app/null-appender'
};
if(process.env.WEH_NATIVE_LOGFILE)
	var	logAppender = {
			type: 'file',
			filename: process.env.WEH_NATIVE_LOGFILE
		}

log4js.configure({
	appenders: {
		logger: logAppender
	},
	categories: {
		default: { appenders: ['logger'], level: process.env.WEH_NATIVE_LOGLEVEL || 'debug' }
	}
});

const logger = log4js.getLogger('logger');

logger.shutdown = (callback) => {
	log4js.shutdown(callback);
}

module.exports = logger;
