// Lets user workspace code (application index.js, mimic.js, ...) do
// require('lab34-flows') and receive the running package - regardless of
// whether the tool runs from a global npm install or a source checkout,
// and without requiring NODE_PATH to be configured.
const Module = require('module');
const path = require('path');

const packageRoot = path.resolve(__dirname, '..', '..');
const ALIAS = 'lab34-flows';

let installed = false;

const install = () => {
  if (installed) { return; }
  installed = true;

  const originalResolve = Module._resolveFilename;

  Module._resolveFilename = function (request, ...args) {
    if (request === ALIAS) {
      return originalResolve.call(this, packageRoot, ...args);
    }

    if (typeof request === 'string' && request.startsWith(`${ALIAS}/`)) {
      const subPath = request.slice(ALIAS.length + 1);
      return originalResolve.call(this, path.join(packageRoot, subPath), ...args);
    }

    return originalResolve.call(this, request, ...args);
  };
};

module.exports.install = install;
module.exports.packageRoot = packageRoot;
