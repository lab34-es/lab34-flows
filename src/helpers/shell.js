const { exec } = require('child_process');

/**
 * Run a shell command and return the output
 * 
 * @param {*} cmd - The command to run
 * @param {*} oneLine - Whether to remove newlines from the output
 * @returns {Promise<string>} The output of the command
 */
module.exports.run = (cmd, oneLine) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject(error);
        return;
      }
      if (stderr) {
        reject(stderr);
        return;
      }
      resolve(oneLine ? stdout.replace(/[\n\r]+/g, '') : stdout);
    });
  });
};