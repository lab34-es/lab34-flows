const fs = require('fs');
const path = require('path');

const paths = require('./paths');

const DEFAULTS_DIR = path.join(__dirname, '..', 'defaults');

/**
 * Seed the user's context directory (~/lab34-flows by default, or the
 * --context directory) with the bundled example applications and flows.
 *
 * Copies are conservative: an example is only copied when its destination
 * does not exist yet, so user modifications and deletions of individual
 * files inside an already-copied example are preserved.
 */
const ensureDefaults = async () => {
  try {
    // Make sure the base folders exist
    const applicationsDir = await paths.contextDir(['applications']);
    const flowsDir = await paths.contextDir(['flows']);
    fs.mkdirSync(applicationsDir, { recursive: true });
    fs.mkdirSync(flowsDir, { recursive: true });

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
  }
  catch (ex) {
    // Seeding must never prevent the tool from starting
    console.error('Could not seed default examples:', ex.message);
  }
};

module.exports = {
  ensureDefaults
};
