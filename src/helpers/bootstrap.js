const fs = require('fs');
const path = require('path');

const paths = require('./paths');

const DEFAULTS_DIR = path.join(__dirname, '..', 'defaults');

/**
 * True when the context directory has never been used as a workspace: it has
 * no `applications/` and no `flows/` folder yet. A folder that already holds
 * either one belongs to the user, so nothing is seeded into it.
 *
 * @param {string} applicationsDir
 * @param {string} flowsDir
 * @returns {boolean}
 */
const isFreshWorkspace = (applicationsDir, flowsDir) =>
  !fs.existsSync(applicationsDir) && !fs.existsSync(flowsDir);

/**
 * Seed the context directory (the current working directory by default, or the
 * --context directory) with the bundled example applications and flows.
 *
 * Seeding only happens on a fresh workspace, so starting the tool inside an
 * existing project never drops example files into it. Once seeded, a marker
 * keeps the examples from coming back after the user deletes them.
 */
const ensureDefaults = async () => {
  try {
    const applicationsDir = await paths.contextDir(['applications']);
    const flowsDir = await paths.contextDir(['flows']);
    const markerPath = await paths.contextDir(['.examples-seeded']);

    const fresh = isFreshWorkspace(applicationsDir, flowsDir);

    // The runtime expects both folders to exist even when nothing is seeded
    fs.mkdirSync(applicationsDir, { recursive: true });
    fs.mkdirSync(flowsDir, { recursive: true });

    if (!fresh || fs.existsSync(markerPath)) {
      return;
    }

    console.log(`Setting up a new Flows workspace in ${await paths.contextDir([])}`);

    // Example applications: copy each app folder if missing
    const defaultAppsDir = path.join(DEFAULTS_DIR, 'applications');
    if (fs.existsSync(defaultAppsDir)) {
      for (const appName of fs.readdirSync(defaultAppsDir)) {
        const source = path.join(defaultAppsDir, appName);
        if (!fs.statSync(source).isDirectory()) { continue; }

        const destination = path.join(applicationsDir, appName);
        if (fs.existsSync(destination)) { continue; }

        fs.cpSync(source, destination, { recursive: true });
        console.log(`Seeded example application: ${appName}`);
      }
    }

    // Example flows: copy each file if missing (keeping folder structure)
    const defaultFlowsDir = path.join(DEFAULTS_DIR, 'flows');
    if (fs.existsSync(defaultFlowsDir)) {
      const copyFlows = (dir, relative = '') => {
        for (const item of fs.readdirSync(dir)) {
          const source = path.join(dir, item);
          const itemRelative = path.join(relative, item);

          if (fs.statSync(source).isDirectory()) {
            copyFlows(source, itemRelative);
            continue;
          }

          const destination = path.join(flowsDir, itemRelative);
          if (fs.existsSync(destination)) { continue; }

          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.copyFileSync(source, destination);
          console.log(`Seeded example flow: ${itemRelative}`);
        }
      };

      copyFlows(defaultFlowsDir);
    }

    fs.writeFileSync(markerPath, JSON.stringify({ seededAt: new Date().toISOString() }, null, 2));
  }
  catch (ex) {
    // Seeding must never prevent the tool from starting
    console.error('Could not seed default examples:', ex.message);
  }
};

module.exports = {
  ensureDefaults
};
