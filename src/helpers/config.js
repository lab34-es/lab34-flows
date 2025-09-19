const fs = require('fs');
const paths = require('./paths');

const load = async (name) => {
  const configFilePath = await paths.contextDir(['config', `${name}.json`]);

  if (!fs.existsSync(configFilePath)) {
    return {};
  }

  const configData = fs.readFileSync(configFilePath, 'utf8');
  const config = JSON.parse(configData);

  return config;
};

module.exports.load = load;