#!/usr/bin/env node
process.env.NODE_NO_HTTP2 = '1';

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const package = require('../package.json');
const cli = require('./helpers/cli');
const preparation = require('./helpers/preparation');
const reporter = require('./helpers/reporter');

// file must be provided, be yaml and exist
const filePath = process.argv[process.argv.indexOf('--file') + 1];
const hasFile = !!filePath
const fileIsYaml = ['yaml', 'yml'].some(ext => filePath.endsWith(`.${ext}`));
const fileExists = fs.existsSync(filePath);

if (!hasFile) {
  console.log(`${fileFlag} is not a valid file`);
  process.exit(1);
}

if (!fileExists) {
  console.log(`File ${filePath} does not exist`);
  process.exit(1);
}

if (!fileIsYaml) {
  console.log('File must be a .yaml file');
  process.exit(1);
}

// Must have passed a --env value in the cli command
const hasEnvFlag = process.argv.indexOf('--env') > -1;
const environment = hasEnvFlag && process.argv[process.argv.indexOf('--env') + 1];
if (!environment) {
  console.log('No environment provided');
  process.exit(1);
}

let asJson = {};

try {
  const content = fs.readFileSync(filePath, 'utf8');
  asJson = YAML.parse(content);
} catch (e) {
  console.log('Error parsing yaml file');
  console.log(e);
  process.exit(1);
}

const opts = {
  environment,
  reporter: reporter.get({cli: true}),
  cli: true
}

;(async () => {
  await preparation.run();

  cli.logo(package.version);
  cli.wisdom();

  const runnerVersion = asJson.version || '1';

  if (process.env.IS_NODEMON) {
    setTimeout(() => {
      require(`./helpers/runner/v${runnerVersion}`).run(asJson, opts);
    }, 1000);
  }
  else {
    require(`./helpers/runner/v${runnerVersion}`).run(asJson, opts);
  }
})();
