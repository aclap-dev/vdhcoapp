const vm = require('vm');
const rpc = require('./weh-rpc');

rpc.listen({
  "vm.run": async (code) => {
    const sandbox = {};
    const script = new vm.Script(code);
    const result = script.runInNewContext(sandbox);
    return result;
  },
});
