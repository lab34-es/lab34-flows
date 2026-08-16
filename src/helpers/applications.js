const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const YAML = require('yaml');
const os = require('os');
const temp = require('temp');
// temp.track(); // Automatically track and clean up temp files at exit

const paths = require('./paths');

const applications = {};

module.exports.applications = applications;

const description = (description) => {
  return description;
};

module.exports.description = description;

// Helper function to convert array-style handlers to functions that can describe themselves
const handler = (handlerArray, functionName) => {
  // The actual function that will be called
  const handler = function (ctx, parameters, flow) {
    if (ctx === 'describe') {
      // Extract description and validations
      const description = handlerArray[0];
      const validation = { };
      
      // Find validation schemas
      handlerArray.forEach(item => {
        if (typeof item === 'function') {
          if (item.schemaType === 'body' && item.schema) {
            validation.body = item.schema;
          } else if (item.schemaType === 'query' && item.schema) {
            validation.query = item.schema;
          }
        }
      });
      
      return {
        name: functionName,
        description,
        parameters: validation
      };
    }
    
    // Normal execution: run through all items in the array expect last and first
    // (which are description and execution function)
    for (let i = 1; i < handlerArray.length - 1; i++) {
      if (typeof handlerArray[i] === 'function') {
        handlerArray[i](ctx, parameters, flow);
      }
    }
    
    // Execute the main handler (last item in array)
    return handlerArray[handlerArray.length - 1](ctx, parameters, flow);
  };
  
  return handler;
};

module.exports.handler = handler;

const loadAll = () => {
  if (Object.keys(applications).length) {
    return Promise.resolve(applications);
  }

  return parseApplications()
    .then(apps => {
      return apps.reduce((acc, app) => {
        const indexPath = path.join(app.path, 'index.js');
        const hasIndex = fs.existsSync(indexPath);
        if (!hasIndex) {
          return acc;
        }
        applications[app.name] = require(indexPath);
        return acc;
      }, {});
    });
};

module.exports.loadAll = loadAll;

/**
 * Return list of paths of *.env files present in the given path. 
 * @param {string} pathToSearch
 * @returns {
*  string[]
* }
*/
const listEnvFiles = pathToSearch => {
  const envDir = path.join(pathToSearch, 'env');

  if (!fs.existsSync(envDir)) {
    return [];
  }

  return fs.readdirSync(envDir)
    .filter(file => fs.statSync(path.join(envDir, file)).isFile() && file.endsWith('.env'))
    .map(file => path.join(envDir, file));
};

/**
 * Gets a unique list of all possible environments based on the .env files
 * present of all applications
 * @returns {Promise<string[]>} - Promise that resolves to a sorted array of unique environment names
 */
const allPossibleEnvironments = () => {
  return parseApplications()
    .then(apps => {
      const envs = apps.map(app => app.envFiles.map(env => env.name));
      return [...new Set(envs.flat())];
    })
    .then(envs => envs.filter(env => env && env.trim() !== '').sort());
};

module.exports.allPossibleEnvironments = allPossibleEnvironments;

/**
 * Given a value, return a masked value.
 * @param {*} value 
 * @returns 
 */
const maskValue = value => {
  const valueLength = value.length;
  if (!valueLength) {
    return value;
  }

  // Replace all characters with * expect last 4
  if (valueLength > 4) {
    return value.slice(0, -4).replace(/./g, '*') + value.slice(-4);
  }

  // Replace all characters with *
  return (value||'').toString().replace(/./g, '*');
};

const loadEnvFile = envPath => {
  const secretLike = [
    'secret',
    'token',
    'credential',
    'x-api-key',
    'x_api_key',
    'password',
    'authorization'
  ];

  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  return Object.keys(envConfig).map(key => {
    const feelsSecret = secretLike.includes(key.toLowerCase());

    // Yesssss, we are sending the secret to the UI. But this is a local-only
    // tool!
    return {
      key,
      isSecret: feelsSecret,
      value: feelsSecret ? maskValue(envConfig[key]) : envConfig[key]
    };
  });
};

module.exports.updateEnvFile = (envPath, key, value) => {
  return new Promise((resolve, reject) => {
    fs.readFile(envPath, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }
      const envConfig = dotenv.parse(data);
      envConfig[key] = value;
      const newEnv = Object.keys(envConfig).map(key => `${key}=${envConfig[key]}`).join('\n');
      fs.writeFile(envPath, newEnv, 'utf8', err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
};

const summary = () => {
  return parseApplications()
    .then(apps => {
      // Create a formatted output for console
      console.log('\n=== Applications Summary ===\n');
      
      if (apps.length === 0) {
        console.log('No applications found.');
      }
      
      apps.forEach(app => {
        console.log(`Application: ${app.name}`);
        
        if (app.methods && app.methods.length > 0) {
          console.log('  Methods:');
          app.methods.forEach(method => {
            console.log(`    - ${method.name}: ${method.description || 'No description'}`);
          });
        } else {
          console.log('  No methods found.');
        }
        
        console.log(''); // Empty line between applications
      });
    });
};

module.exports.summary = summary;

/**
 * Returns the list of applications and .env files for each
 * @param {string} source - Optional source directory to load applications from
 * @returns {Array[Object]} 
 * {
 *  application: string,
 *  path: string,
 *  envFiles: Array[Object] {
 *    name: string,  
 *    path: string
 *  }
 * }
 */
const parseApplications = async () => {
  const appsPath = await paths.contextDir(['applications']);

  if (!fs.existsSync(appsPath)) {
    return [];
  }

  const apps = fs.readdirSync(appsPath).filter(file => {
    return fs.statSync(path.join(appsPath, file)).isDirectory();
  });
  
  const result = await Promise.all(apps.map(async applicationName => {
    const appPath = path.join(appsPath, applicationName);

    const appIndex = path.join(appPath, 'index.js');

    // List env files
    const envFiles = listEnvFiles(appPath);

    const envFilesWithPaths = envFiles.map(envFile => {
      const fileName = path.basename(envFile);
      const envName = fileName.replace(/\.env$/i, '');
      return {
        name: envName,
        source: envFile,
        path: envFile,
        contents: loadEnvFile(envFile)
      };
    });

    // if index file exists load methods
    let methods = [];
    const errors = [];

    if (fs.existsSync(appIndex)) {

      // Replace in appIndex "lab34-flows" with $NODE_PATH/@lab34/flows/
      // When NODE_PATH is not set (or the global install is missing), fall
      // back to this repository itself so applications work in development
      // and when the tool runs its own bundled examples.
      const nodePath = process.env.NODE_PATH || '';
      let flowsPath = nodePath ? path.join(nodePath, '@lab34', 'flows') : '';
      if (!flowsPath || !fs.existsSync(flowsPath)) {
        flowsPath = path.resolve(__dirname, '..', '..');
      }
      const appIndexContentOriginal = fs.readFileSync(appIndex, 'utf8');
      const appIndexContentModified = appIndexContentOriginal
        .replace(/(['"`])lab34-flows(\/[^'"`]*)?\1/g, (match, quote, subpath) => {
          return `${quote}${flowsPath}${subpath || ''}${quote}`;
        });

      // Write the modified content to a temporary file
      fs.writeFileSync(appIndex, appIndexContentModified);

      try {
        const lib = require(appPath);
        methods = Object.keys(lib).map(method => {
          return lib[method]('describe');
        });
      }
      catch (ex) {
        console.error('Error loading application', applicationName, ex);
        errors.push({
          message: ex.message,
          stack: ex.stack
        });
      }
      finally {
        // Clean up the temporary file
        fs.writeFileSync(appIndex, appIndexContentOriginal);
      }
    }

    // Load the application README, if any
    let readme = null;
    const readmeFile = fs.readdirSync(appPath)
      .find(file => file.toLowerCase() === 'readme.md');
    if (readmeFile) {
      try {
        readme = fs.readFileSync(path.join(appPath, readmeFile), 'utf8');
      }
      catch (ex) {
        errors.push({ message: `Error reading README: ${ex.message}` });
      }
    }

    // Load the JSON docs (docs.json), if any. It documents each method:
    // input parameters, output, memory usage, examples...
    let docs = null;
    const docsPath = path.join(appPath, 'docs.json');
    if (fs.existsSync(docsPath)) {
      try {
        docs = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
      }
      catch (ex) {
        errors.push({ message: `Invalid docs.json: ${ex.message}` });
      }
    }

    // Merge the self-described methods (from index.js) with the JSON docs.
    // Methods present only in docs.json are included too, flagged as not
    // implemented.
    const docsMethods = (docs && docs.methods) || {};
    const methodsByName = new Map();

    methods.filter(Boolean).forEach(method => {
      methodsByName.set(method.name, { ...method, implemented: true });
    });

    Object.keys(docsMethods).forEach(name => {
      const existing = methodsByName.get(name) || { name, implemented: false };
      const methodDocs = docsMethods[name] || {};
      methodsByName.set(name, {
        ...existing,
        description: existing.description || methodDocs.description,
        docs: methodDocs
      });
    });

    return {
      name: applicationName,
      slug: applicationName,
      path: appPath,
      description: (docs && docs.description) || null,
      readme,
      docs,
      envFiles: envFilesWithPaths,
      methods: Array.from(methodsByName.values()),
      errors
    };
  }));

  return result;
};

module.exports.parseApplications = parseApplications;
