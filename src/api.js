// Used in development environment, since the API is launched by electron

const api = require('./api/index');
const argv = require('yargs-parser')(process.argv.slice(2));

const start = async () => {
  const options = {
    context: argv.context || null
  };
  await api.start(options);
}

module.exports.start = start;

module.exports.stop = async () => {
  await api.stop();
}

// Check if we'r running in the main process or just the script from cli

if (require.main === module) {
  start();
}
