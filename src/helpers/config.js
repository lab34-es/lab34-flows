const fs = require('fs');
const path = require('path');
const paths = require('./paths');

let configFilePath

const load = async (name) => {
  const configFilePath = await paths.fromHome(['config', `${name}.json`]);

  if (!fs.existsSync(configFilePath)) {
    return {};
  }

  const configData = fs.readFileSync(configFilePath, 'utf8');
  const config = JSON.parse(configData);
  return config;
}

module.exports.load = load;

const save = async (name, data) => {
  const configFilePath = await paths.fromHome(['config', `${name}.json`]);

  // Force create the config directory
  const configDir = path.dirname(configFilePath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configFilePath, JSON.stringify(data, null, 2));
}

module.exports.save = save;