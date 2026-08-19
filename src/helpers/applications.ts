import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
// temp.track(); // Automatically track and clean up temp files at exit

import * as paths from './paths';
import * as appDocs from './appDocs';
import * as appLoader from './appLoader';

const applications: Record<string, any> = {};

export { applications };

const description = (description) => {
  return description;
};

export { description };

// Helper function to convert array-style handlers to functions that can describe themselves
//
// The array holds the validation middlewares and, as its last item, the
// function to execute. Documentation is not part of it: methods are
// documented with a JSDoc block above them (see helpers/appDocs.js). A
// leading string is still accepted as a description, for applications
// written before documentation moved to JSDoc.
const handler = (handlerArray, functionName) => {
  const hasInlineDescription = typeof handlerArray[0] === 'string';

  // The actual function that will be called
  const handler = function (ctx, parameters, flow) {
    if (ctx === 'describe') {
      const description = hasInlineDescription ? handlerArray[0] : null;
      const validation: Record<string, any> = { };

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

    // Normal execution: run every item except the last one (the execution
    // function) and the optional leading description
    for (let i = hasInlineDescription ? 1 : 0; i < handlerArray.length - 1; i++) {
      if (typeof handlerArray[i] === 'function') {
        handlerArray[i](ctx, parameters, flow);
      }
    }

    // Execute the main handler (last item in array)
    return handlerArray[handlerArray.length - 1](ctx, parameters, flow);
  };

  return handler;
};

export { handler };

const loadAll = () => {
  // Always reload: application code can be edited from the UI (Source view)
  // and the next run must pick up the changes without restarting the server
  return parseApplications()
    .then(apps => {
      return apps.reduce((acc, app) => {
        const indexPath = appLoader.resolveEntry(app.path);
        if (!indexPath) {
          return acc;
        }
        applications[app.name] = appLoader.load(indexPath);
        return acc;
      }, {});
    });
};

export { loadAll };

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

export { allPossibleEnvironments };

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

export const updateEnvFile = (envPath, key, value) => {
  return new Promise<void>((resolve, reject) => {
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

export { summary };

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

    const appIndex = appLoader.resolveEntry(appPath);

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
    let methods: any[] = [];
    const errors: Record<string, any>[] = [];
    let indexSource: string | null = null;

    if (appIndex) {
      indexSource = fs.readFileSync(appIndex, 'utf8');

      try {
        // appLoader transpiles TypeScript, resolves the application's import
        // of this package, and reloads from disk so edits made in the UI
        // (Source view) are picked up without restarting the server
        const lib = appLoader.load(appIndex);

        // Ask every exported method to describe itself. An application is
        // free to export something that is not a method -- a constant, a
        // helper -- so anything that does not answer is left out rather than
        // failing the whole application.
        methods = Object.keys(lib)
          .filter(name => typeof lib[name] === 'function')
          .map(name => {
            try {
              return lib[name]('describe');
            }
            catch {
              return null;
            }
          })
          .filter(method => method && method.name);
      }
      catch (ex) {
        console.error('Error loading application', applicationName, ex);
        errors.push({
          message: ex.message,
          stack: ex.stack
        });
      }
    }

    // Load the application README, if any
    let readme: string | null = null;
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

    // Documentation lives in the JSDoc blocks of index.ts: the block at the
    // top of the file describes the application, and the block above each
    // exported method documents its input, output, memory usage and an
    // example step.
    const parsedDocs = appDocs.parse(indexSource);
    const docsMethods = parsedDocs.methods;

    // docs.json is no longer read: warn instead of silently ignoring it
    if (fs.existsSync(path.join(appPath, 'docs.json'))) {
      errors.push({
        message: 'docs.json is no longer used. Document the application and its ' +
          'methods with JSDoc blocks in index.ts, then delete docs.json.'
      });
    }

    // Merge the self-described methods (from index.ts) with their JSDoc.
    // The JSDoc description wins over the one a handler may still declare
    // inline. Documented methods that could not be loaded are included too,
    // flagged as not implemented.
    const methodsByName = new Map<string, Record<string, any>>();

    methods.filter(Boolean).forEach(method => {
      methodsByName.set(method.name, { ...method, implemented: true });
    });

    Object.keys(docsMethods).forEach(name => {
      const existing = methodsByName.get(name) || { name, implemented: false };
      const methodDocs = docsMethods[name];
      methodsByName.set(name, {
        ...existing,
        description: methodDocs.description || existing.description || null,
        docs: methodDocs
      });
    });

    return {
      name: applicationName,
      slug: applicationName,
      path: appPath,
      description: parsedDocs.description,
      readme,
      envFiles: envFilesWithPaths,
      methods: Array.from(methodsByName.values()),
      errors
    };
  }));

  return result;
};

export { parseApplications };

/**
 * Files an application is expected to have. They are always listed by the
 * Source view — with an `exists` flag — so the UI can offer creating the
 * missing ones: the README, and the code that also carries the documentation
 * (as JSDoc).
 */
const CANONICAL_APP_FILES = ['README.md', 'index.ts'];

/**
 * A canonical file is already there when a variant of it is: an application
 * still written in JavaScript has an `index.js`, and the Source view must not
 * offer to create an `index.ts` next to it.
 */
const CANONICAL_ALTERNATIVES = { 'index.ts': ['index.js'] };

/**
 * Folders never shown nor written to from the Source view: they are either
 * managed by other tools or big enough to make the explorer useless.
 */
const IGNORED_APP_SEGMENTS = ['node_modules', '.git'];

const toPosix = (value) => (value || '').split('\\').join('/');

/**
 * Resolve a file inside an application folder, rejecting anything that would
 * escape the application directory or touch an ignored folder.
 * @param {string} applicationName
 * @param {string} relativePath - e.g. "README.md", "lib/http.js", "env/local.env"
 * @returns {Promise<{appPath: string, absolute: string, relative: string}>}
 */
const resolveAppFile = async (applicationName, relativePath) => {
  const appPath = await paths.contextDir(['applications', applicationName]);

  if (!fs.existsSync(appPath) || !fs.statSync(appPath).isDirectory()) {
    throw new Error('Application not found');
  }

  const normalized = toPosix(relativePath).replace(/^\/+/, '').trim();

  if (!normalized) {
    throw new Error('File path is required');
  }

  const segments = normalized.split('/').filter(segment => segment && segment !== '.');
  if (segments.some(segment => IGNORED_APP_SEGMENTS.includes(segment.toLowerCase()))) {
    throw new Error(`Not an editable application file: ${normalized}`);
  }

  const absolute = path.resolve(appPath, normalized);
  if (!absolute.startsWith(appPath + path.sep)) {
    throw new Error('Invalid path: outside of the application directory');
  }

  return { appPath, absolute, relative: toPosix(path.relative(appPath, absolute)) };
};

/** Collect every file under `dir`, depth-first, as posix relative paths. */
const walkAppFiles = (dir, relativePath, collected) => {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  }
  catch {
    return collected;
  }

  for (const entry of entries) {
    if (IGNORED_APP_SEGMENTS.includes(entry.toLowerCase())) { continue; }

    const full = path.join(dir, entry);
    const itemRelative = relativePath ? `${relativePath}/${entry}` : entry;

    let stat;
    try {
      stat = fs.statSync(full);
    }
    catch {
      // Broken symlink or unreadable entry: skip it instead of failing
      continue;
    }

    if (stat.isDirectory()) {
      walkAppFiles(full, itemRelative, collected);
      continue;
    }

    collected.push({ path: itemRelative, exists: true });
  }

  return collected;
};

/**
 * List the files of an application. Every file on disk is listed, plus the
 * canonical ones (README.md, index.ts) when they are missing, so the UI can
 * offer creating them.
 * @param {string} applicationName
 * @returns {Promise<Array<{path: string, exists: boolean}>>}
 */
export const listAppFiles = async (applicationName) => {
  const appPath = await paths.contextDir(['applications', applicationName]);

  if (!fs.existsSync(appPath) || !fs.statSync(appPath).isDirectory()) {
    throw new Error('Application not found');
  }

  const files = walkAppFiles(appPath, '', [])
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }));

  // Canonical files that do not exist yet, first, so they are easy to spot
  const has = (name) => files.some(file => file.path.toLowerCase() === name.toLowerCase());

  const missing = CANONICAL_APP_FILES
    .filter(name => !has(name) && !(CANONICAL_ALTERNATIVES[name] || []).some(has))
    .map(name => ({ path: name, exists: false }));

  return [...missing, ...files];
};

/**
 * Create a new file in an application. Fails when the path is already taken,
 * so the UI never silently replaces an existing file.
 * @param {string} applicationName
 * @param {string} relativePath
 * @param {string} content
 */
export const createAppFile = async (applicationName, relativePath, content) => {
  const { absolute, relative } = await resolveAppFile(applicationName, relativePath);

  if (fs.existsSync(absolute)) {
    const error: NodeJS.ErrnoException = new Error('A file or folder with that name already exists');
    error.code = 'EEXISTS';
    throw error;
  }

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content ?? '', 'utf8');

  return { path: relative };
};

/**
 * Rename (or move, when the new path has folders) a file or folder of an
 * application.
 * @param {string} applicationName
 * @param {string} fromPath
 * @param {string} toPath
 */
export const renameAppFile = async (applicationName, fromPath, toPath) => {
  const from = await resolveAppFile(applicationName, fromPath);
  const to = await resolveAppFile(applicationName, toPath);

  if (!fs.existsSync(from.absolute)) {
    throw new Error(`File not found: ${from.relative}`);
  }

  if (from.absolute === to.absolute) {
    return { path: to.relative, previousPath: from.relative };
  }

  // Renaming only the casing (readme.md → README.md) is a no-op collision on
  // case-insensitive file systems, so only guard against a different file
  if (fs.existsSync(to.absolute) && from.absolute.toLowerCase() !== to.absolute.toLowerCase()) {
    const error: NodeJS.ErrnoException = new Error('A file or folder with that name already exists');
    error.code = 'EEXISTS';
    throw error;
  }

  if (to.absolute.startsWith(from.absolute + path.sep)) {
    throw new Error('Cannot move a folder inside itself');
  }

  fs.mkdirSync(path.dirname(to.absolute), { recursive: true });
  fs.renameSync(from.absolute, to.absolute);

  return { path: to.relative, previousPath: from.relative };
};

/**
 * Delete a file or folder of an application.
 * @param {string} applicationName
 * @param {string} relativePath
 */
export const deleteAppFile = async (applicationName, relativePath) => {
  const { absolute, relative } = await resolveAppFile(applicationName, relativePath);

  // lstat instead of existsSync so broken symlinks can still be deleted
  try {
    fs.lstatSync(absolute);
  }
  catch {
    throw new Error(`File not found: ${relative}`);
  }

  fs.rmSync(absolute, { recursive: true, force: true });

  return { path: relative };
};

/**
 * An application is a folder inside the applications directory, and flows
 * name it as it is named there: anything that is not a plain folder name --
 * a path, a hidden folder -- is refused.
 * @param {string} name
 * @returns {string} The trimmed, usable name
 */
const applicationNameOf = (name) => {
  const trimmed = (name || '').trim();

  if (!trimmed) {
    throw new Error('Application name is required');
  }

  if (/[/\\]/.test(trimmed) || trimmed === '.' || trimmed === '..' || trimmed.startsWith('.')) {
    throw new Error('Invalid application name');
  }

  return trimmed;
};

/**
 * The files a new application starts from: a documented index.ts with example
 * methods, its README and a local environment. They live next to the example
 * applications rather than inside them, so seeding never copies the template
 * itself into the user's context directory.
 */
const APPLICATION_TEMPLATE_DIR = path.join(__dirname, '..', 'defaults', 'application-template');

/** What the template writes wherever the application's own name belongs. */
const NAME_PLACEHOLDER = /__APPLICATION_NAME__/g;

/**
 * Copy the template into a new application folder, naming it along the way.
 * Every template file is text, so each one is read, renamed and written.
 */
const copyTemplate = (source, destination, name) => {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source)) {
    const from = path.join(source, entry);
    const to = path.join(destination, entry);

    if (fs.statSync(from).isDirectory()) {
      copyTemplate(from, to, name);
      continue;
    }

    const content = fs.readFileSync(from, 'utf8').replace(NAME_PLACEHOLDER, name);
    fs.writeFileSync(to, content, 'utf8');
  }
};

/**
 * Create an application: a folder in the applications directory, holding the
 * template -- a hello-world method writing to the flow memory, one reading it
 * back, an HTTP call, and the README and environment that go with them.
 * @param {string} name - A single folder name, no slashes
 * @returns {Promise<{name: string, slug: string, path: string}>}
 */
export const createApplication = async (name) => {
  const trimmed = applicationNameOf(name);

  const appsPath = await paths.contextDir(['applications']);
  const destination = path.join(appsPath, trimmed);

  if (fs.existsSync(destination)) {
    const error: NodeJS.ErrnoException = new Error(`An application named “${trimmed}” already exists`);
    error.code = 'EEXISTS';
    throw error;
  }

  if (!fs.existsSync(APPLICATION_TEMPLATE_DIR)) {
    throw new Error('The application template is missing from this installation');
  }

  fs.mkdirSync(appsPath, { recursive: true });
  copyTemplate(APPLICATION_TEMPLATE_DIR, destination, trimmed);

  return { name: trimmed, slug: trimmed, path: destination };
};

/**
 * Rename an application, i.e. its folder inside the applications directory.
 * Flows reference applications by this name, so the UI warns about it.
 * @param {string} applicationName
 * @param {string} newName - A single folder name, no slashes
 */
export const renameApplication = async (applicationName, newName) => {
  const appsPath = await paths.contextDir(['applications']);
  const from = path.join(appsPath, applicationName);

  if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) {
    throw new Error('Application not found');
  }

  const trimmed = applicationNameOf(newName);

  const to = path.join(appsPath, trimmed);

  if (to === from) {
    return { name: trimmed, slug: trimmed, previousName: applicationName };
  }

  if (fs.existsSync(to) && from.toLowerCase() !== to.toLowerCase()) {
    const error: NodeJS.ErrnoException = new Error(`An application named “${trimmed}” already exists`);
    error.code = 'EEXISTS';
    throw error;
  }

  fs.renameSync(from, to);

  // Applications are cached by file: drop the stale entries so the next parse
  // loads the renamed one from its new location
  appLoader.purge(from);

  return { name: trimmed, slug: trimmed, previousName: applicationName };
};

/**
 * Read an editable application file. Missing canonical files return empty
 * content with exists=false so the UI can offer creating them.
 * @param {string} applicationName
 * @param {string} relativePath
 */
export const readAppFile = async (applicationName, relativePath) => {
  const { absolute, relative } = await resolveAppFile(applicationName, relativePath);

  if (!fs.existsSync(absolute)) {
    return { path: relative, exists: false, content: '' };
  }

  return { path: relative, exists: true, content: fs.readFileSync(absolute, 'utf8') };
};

/**
 * Create or update an editable application file.
 * @param {string} applicationName
 * @param {string} relativePath
 * @param {string} content
 */
export const writeAppFile = async (applicationName, relativePath, content) => {
  const { absolute, relative } = await resolveAppFile(applicationName, relativePath);

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content ?? '', 'utf8');

  return { path: relative };
};
