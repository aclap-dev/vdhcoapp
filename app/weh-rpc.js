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

class RPC {

	constructor() {
		this.replyId = 0;
		this.replies = {};
		this.listeners = {};
		this.hook = this.nullHook;
		this.debugLevel = 0;
		this.useTarget = false;
		this.logger = console;
	}

	setPost(post) {
		this.post = post;
	}

	setUseTarget(useTarget) {
		this.useTarget = useTarget;
	}

	setLogger(logger) {
		this.logger = logger;
	}

	setDebugLevel(debugLevel) {
		this.debugLevel = debugLevel;
	}

	setHook(hook) {
		var timestamp0 = Date.now();
		function Now() {
			if(typeof window!="undefined" && typeof window.performance!="undefined")
				return window.performance.now();
			else
				return Date.now() - timestamp0;
		}
		if(hook)
			this.hook = (message) => {
				message.timestamp = Now();
				hook(message);
			}
		else
			this.hook = this.nullHook;
	}

	nullHook() {}

	call() {
		var self = this;
		var _post, receiver, method, args;
		var _arguments = Array.prototype.slice.call(arguments);
		if(typeof _arguments[0]=="function")
			_post = _arguments.shift();
		if (self.useTarget)
			[receiver, method, ...args] = _arguments;
		else
			[method, ...args] = _arguments;
		var promise = new Promise(function (resolve, reject) {
			var rid = ++self.replyId;
			if (self.debugLevel >= 2)
				self.logger.info("rpc #" + rid, "call =>", method, args);
			self.hook({
				type: "call",
				callee: receiver,
				rid,
				method,
				args
			});
			self.replies[rid] = {
				resolve: resolve,
				reject: reject,
				peer: receiver
			}
			if(self.useTarget)
				self.post(receiver,{
					type: "weh#rpc",
					_request: rid,
					_method: method,
					_args: [...args]
				});
			else
				self.post({
					type: "weh#rpc",
					_request: rid,
					_method: method,
					_args: [...args]
				});
		});
		return promise;
	}

	receive(message,send,peer) {
		var self = this;
		if (message._request)
			Promise.resolve()
				.then(() => {
					var method = self.listeners[message._method];
					if (typeof method == "function") {
						if (self.debugLevel >= 2)
							self.logger.info("rpc #" + message._request, "serve <= ", message._method, message._args);
						self.hook({
							type: "call",
							caller: peer,
							rid: message._request,
							method: message._method,
							args: message._args
						});
						return Promise.resolve(method.apply(null, message._args))
							.then((result)=>{
								self.hook({
									type: "reply",
									caller: peer,
									rid: message._request,
									result: result
								});
								return result;
							})
							.catch((error)=>{
								self.hook({
									type: "reply",
									caller: peer,
									rid: message._request,
									error: error.message
								});
								throw error;
							})
					} else
						throw new Error("Method " + message._method + " is not a function");
				})
				.then((result) => {
					if (self.debugLevel >= 2)
						self.logger.info("rpc #" + message._request, "serve => ", result);
					send({
						type: "weh#rpc",
						_reply: message._request,
						_result: result
					});
				})
				.catch((error) => {
					if (self.debugLevel >= 1)
						self.logger.info("rpc #" + message._request, "serve => !", error.message);
					send({
						type: "weh#rpc",
						_reply: message._request,
						_error: error.message
					});
				});
		else if (message._reply) {
			var reply = self.replies[message._reply];
			delete self.replies[message._reply];
			if (!reply)
				self.logger.error("Missing reply handler");
			else if (message._error) {
				if (self.debugLevel >= 1)
					self.logger.info("rpc #" + message._reply, "call <= !", message._error);
				self.hook({
					type: "reply",
					callee: reply.peer,
					rid: message._reply,
					error: message._error
				});
				reply.reject(new Error(message._error));
			} else {
				if (self.debugLevel >= 2)
					self.logger.info("rpc #" + message._reply, "call <= ", message._result);
				self.hook({
					type: "reply",
					callee: reply.peer,
					rid: message._reply,
					result: message._result
				});
				reply.resolve(message._result);
			}
		}
	}

	listen(listener) {
		Object.assign(this.listeners,listener);
	}

}

module.exports = new RPC();



