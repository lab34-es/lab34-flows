const isWsl = require('is-wsl');
const os = require('os');
const path = require('path');
const shell = require('./shell');
const fs = require('fs');
const argv = require('yargs-parser')(process.argv.slice(2));

// Cache the Windows home directory when inside WSL
let winDir;

/**
 * Get the Windows home directory when inside WSL
 * @returns {Promise<string>} The Windows home directory
 */
const getWslWinHomeDir = async () => {
  if (winDir) {return winDir;}
  const windowsHomeRaw = await shell.run('cmd.exe /c "<nul set /p=%UserProfile%" 2>/dev/null', true);
  winDir = await shell.run(`wslpath "${windowsHomeRaw}"`, true);
  return winDir;
};

module.exports.contextDir = async (pathParts) => {
  const baseDir = isWsl ? await getWslWinHomeDir() : os.homedir();
  let context = argv.context;

  let finalPathParts = [];

  // Check if context argument is defined
  if (context) {
    const isAbsolute = path.isAbsolute(context);
    
    if (!isAbsolute) {
      // If context is not absolute, resolve it relative to the current working directory
      context = path.resolve(process.cwd(), context);
    }

    // Ensure the context directory exists
    if (!fs.existsSync(context)) {
      console.error(`Context directory does not exist: ${context}`);
      process.exit(1);
    }
    
    // Use the context as base and add pathParts
    finalPathParts = [context].concat(pathParts || []);
  } else {
    // Use default: home folder + "lab34-flows" + pathParts
    finalPathParts = [baseDir, 'lab34-flows'].concat(pathParts || []);
  }

  const finalPath = path.join.apply(null, finalPathParts);
  return finalPath;
};

module.exports.createFolder = async (folderPath) => {
  // create if not exists
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

module.exports.findFiles = (dir, depth = 0, maxDepth = 4, results = [], formats) => {
  if (depth > maxDepth) {return results;}

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        this.findFiles(fullPath, depth + 1, maxDepth, results);
      } else if (item.isFile()) {
        if (!formats) {
          results.push(fullPath);
          return; 
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
};
