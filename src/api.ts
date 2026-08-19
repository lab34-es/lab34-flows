// Used in development environment, since the API is launched by electron

import * as api from './api/index';
import yargsParser from 'yargs-parser';

const argv = yargsParser(process.argv.slice(2));

const start = async () => {
  const options = {
    context: argv.context || null
  };
  await api.start(options);
};

export { start };

export const stop = async () => {
  await api.stop();
};

// Check if we'r running in the main process or just the script from cli

if (require.main === module) {
  start();
}
