const path = require('path');
const fs = require('fs');
const paths = require('./paths');
const apps = require('./applications');

/**
 * The following ensures the user will have a folder on his/her computer
 * for each application where the .env variables can be maintained, so this
 * are never part of the tooling' repository.
 * 
 * It ensures that, even if the user has updates the .env files on his/her 
 * computer, they will have the lastest version of the .env files the tool
 * actual uses, without overwriting the user's changes.
 */
const run = async () => {
  const applications = await apps.parseApplications();

  // For the .env files, we must understand which ones already exist, so we can 
  // update them, and not overwrite them.
  let existingFiles = [];

  // Create .env files if they don't exist!
  await Promise.all(applications.map(app => {
    return Promise.all(app.envFiles.map(envFile => {
      if (!fs.existsSync(envFile.path)) {
        fs.copyFileSync(envFile.source, envFile.path);
      }
      else {
        existingFiles.push({
          source: envFile.source,
          target: envFile.path
        })
      }
    }));
  }));

  // Now that we know which files exsits, we can append to them the new 
  // variables, without overwriting the ones the user already has.

  await Promise.all(existingFiles.map(file => {
    const source = fs.readFileSync(file.source, 'utf8');
    const target = fs.readFileSync(file.target, 'utf8');
    const sourceLines = source.split('\n');
    const targetLines = target.split('\n');

    const listOfEnvVarsInSource = sourceLines.map(line => {
      return line.split('=')[0];
    });

    const listOfEnvVarsInTarget = targetLines.map(line => {
      return line.split('=')[0];
    });

    const envVarsToBeAdded = listOfEnvVarsInSource.filter(envVar => {
      return !listOfEnvVarsInTarget.includes(envVar);
    });

    envVarsToBeAdded.forEach(envVar => {
      const line = sourceLines.find(line => {
        return line.startsWith(envVar);
      });
      
      targetLines.push(line);
    });

    // Add lines to the target file (do not overwrite the file, just add lines)
    fs.writeFileSync(file.target, targetLines.join('\n'));
  }));

  return apps.loadAll();
}

module.exports.run = run