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
    let timestamp0 = Date.now();

    function Now() {
      if (typeof window != "undefined" && typeof window.performance != "undefined") {
        return window.performance.now();
      } else {
        return Date.now() - timestamp0;
      }
    }

    if (hook) {
      this.hook = (message) => {
        message.timestamp = Now();
        hook(message);
      };
    } else {
      this.hook = this.nullHook;
    }
  }

  nullHook() {}

  call() {
    let self = this;
    let _post; let receiver; let method; let args;
    let _arguments = Array.prototype.slice.call(arguments);
    if (typeof _arguments[0] == "function") {
      _post = _arguments.shift();
    }
    if (self.useTarget) {
      [receiver, method, ...args] = _arguments;
    } else {
      [method, ...args] = _arguments;
    }
    let promise = new Promise(function (resolve, reject) {
      let rid = ++self.replyId;
      if (self.debugLevel >= 2) {
        self.logger.info("rpc #" + rid, "call =>", method, args);
      }
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
      };
      if (self.useTarget) {
        self.post(receiver, {
          type: "weh#rpc",
          _request: rid,
          _method: method,
          _args: [...args]
        });
      } else {
        self.post({
          type: "weh#rpc",
          _request: rid,
          _method: method,
          _args: [...args]
        });
      }
    });
    return promise;
  }

  receive(message, send, peer) {
    let self = this;
    if (message._request) {
      Promise.resolve()
        .then(() => {
          let method = self.listeners[message._method];
          if (typeof method == "function") {
            if (self.debugLevel >= 2) {
              self.logger.info("rpc #" + message._request, "serve <= ", message._method, message._args);
            }
            self.hook({
              type: "call",
              caller: peer,
              rid: message._request,
              method: message._method,
              args: message._args
            });
            return Promise.resolve(method.apply(null, message._args))
              .then((result) => {
                self.hook({
                  type: "reply",
                  caller: peer,
                  rid: message._request,
                  result: result
                });
                return result;
              })
              .catch((error) => {
                self.hook({
                  type: "reply",
                  caller: peer,
                  rid: message._request,
                  error: error.message
                });
                throw error;
              });
          } else {
            throw new Error("Method " + message._method + " is not a function");
          }
        })
        .then((result) => {
          if (self.debugLevel >= 2) {
            self.logger.info("rpc #" + message._request, "serve => ", result);
          }
          send({
            type: "weh#rpc",
            _reply: message._request,
            _result: result
          });
        })
        .catch((error) => {
          if (self.debugLevel >= 1) {
            self.logger.info("rpc #" + message._request, "serve => !", error.message);
          }
          send({
            type: "weh#rpc",
            _reply: message._request,
            _error: error.message
          });
        });
    } else if (message._reply) {
      let reply = self.replies[message._reply];
      delete self.replies[message._reply];
      if (!reply) {
        self.logger.error("Missing reply handler");
      } else if (message._error) {
        if (self.debugLevel >= 1) {
          self.logger.info("rpc #" + message._reply, "call <= !", message._error);
        }
        self.hook({
          type: "reply",
          callee: reply.peer,
          rid: message._reply,
          error: message._error
        });
        reply.reject(new Error(message._error));
      } else {
        if (self.debugLevel >= 2) {
          self.logger.info("rpc #" + message._reply, "call <= ", message._result);
        }
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
    Object.assign(this.listeners, listener);
  }

}

export default () => new RPC();
