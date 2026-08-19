import fs from 'fs';
import path from 'path';
import * as paths from './paths';

const load = async (name) => {
  const configFilePath = await paths.contextDir(['config', `${name}.json`]);

  if (!fs.existsSync(configFilePath)) {
    return {};
  }

  const configData = fs.readFileSync(configFilePath, 'utf8');
  const config = JSON.parse(configData);

  return config;
};

/**
 * Persist a configuration file inside the context "config" folder.
 * @param {string} name - File name, without the ".json" extension
 * @param {Object} data - Contents to write
 * @returns {Promise<Object>} The saved data
 */
const save = async (name, data) => {
  const configFilePath = await paths.contextDir(['config', `${name}.json`]);

  fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
  fs.writeFileSync(configFilePath, JSON.stringify(data ?? {}, null, 2), 'utf8');

  return data;
};

export { load };
export { save };
