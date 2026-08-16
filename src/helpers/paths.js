const path = require('path');
const fs = require('fs');
const argv = require('yargs-parser')(process.argv.slice(2));

/**
 * Resolve the context directory: the folder holding `applications/`, `flows/`
 * and `config/`.
 *
 * Resolution order:
 *   1. `--context <dir>` argument (absolute, or relative to the cwd)
 *   2. `LAB34_FLOWS_CONTEXT` environment variable
 *   3. the current working directory
 *
 * The tool never writes outside the context directory, so running `flows` in a
 * project folder keeps everything next to that project.
 *
 * @returns {string} The absolute context directory
 */
const resolveContextRoot = () => {
  const context = argv.context || process.env.LAB34_FLOWS_CONTEXT;

  if (!context) {
    return process.cwd();
  }

  const resolved = path.isAbsolute(context)
    ? context
    : path.resolve(process.cwd(), context);

  // An explicit context must exist: silently creating a mistyped path would
  // hide the user's typo behind an empty workspace
  if (!fs.existsSync(resolved)) {
    console.error(`Context directory does not exist: ${resolved}`);
    process.exit(1);
  }

  return resolved;
};

module.exports.contextRoot = resolveContextRoot;

module.exports.contextDir = async (pathParts) => {
  const finalPathParts = [resolveContextRoot()].concat(pathParts || []);
  return path.join.apply(null, finalPathParts);
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
