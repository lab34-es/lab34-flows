// Used in development environment, since the API is launched by electron

const api = require('./api/index');
const preparation = require('./helpers/preparation');

const start = async () => {
  await preparation.run();
  await api.start();
}

module.exports.start = start;

module.exports.stop = async () => {
  await api.stop();
}

// Check if we'r running in the main process or just the script from cli

if (require.main === module) {
  start();
}
