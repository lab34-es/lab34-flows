const isWsl = require('is-wsl');
const os = require('os');
const path = require('path');
const shell = require('./shell');
const fs = require('fs')

// Cache the Windows home directory when inside WSL
let winDir

/**
 * Get the Windows home directory when inside WSL
 * @returns {Promise<string>} The Windows home directory
 */
const getWslWinHomeDir = async () => {
  if (winDir) return winDir
  const windowsHomeRaw = await shell.run('cmd.exe /c "<nul set /p=%UserProfile%" 2>/dev/null', true)
  winDir = await shell.run(`wslpath "${windowsHomeRaw}"`, true)
  return winDir
}

/**
 * Get the path to a file or directory in the user's home directory
 * @param {string|string[]} pathParts The path parts to join
 * @returns {string} The full path
 */
module.exports.fromHome = async (pathParts) => {
  const prefix = isWsl ? [await getWslWinHomeDir()] : [os.homedir()]
  
  // Add "flows-tester" as a *prefix* to the path
  pathParts = ['flows'].concat(pathParts || []);
  return path.join.apply(null, prefix.concat(Array.isArray(pathParts) ? pathParts : [pathParts]));
}

module.exports.createFolder = async (folderPath) => {
  // create if not exists
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

module.exports.findFiles = (dir, depth = 0, maxDepth = 4, results = [], formats) => {
  if (depth > maxDepth) return results;

  try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
              this.findFiles(fullPath, depth + 1, maxDepth, results);
          } else if (item.isFile()) {
            if (!formats) {
              results.push(fullPath);
              return 
            }

            const fileName = path.basename(item.name);
            const fileFormat = (fileName.split('.').pop()||'').toLowerCase();
            if (formats.includes(fileFormat)) {
              results.push(fullPath);
            }
          }
      }
  } catch (err) {
      console.error(`Error reading directory "${dir}":`, err.message);
  }

  return results;
}