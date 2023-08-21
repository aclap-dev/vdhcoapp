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

const log4js = require('log4js');
const nullAppender = require('./null-appender.js');

let	logAppender = {
    type: 'file',
    filename: '/tmp/coapp.logs'
  };

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
};

module.exports = logger;
