const path = require('path');
const fs = require('fs');

const get = (mimicConfig, name, fallbackValue) => {
  const { application } = mimicConfig;

  const filePath = path.join(__dirname, '..', '..', 'static', application, name);
  let result;

  const fileExists = fs.existsSync(filePath);

  mimicConfig.flow.reporter.mimicFile(application, filePath, fileExists);

  if (fileExists) 
  {result = fs.readFileSync(filePath, 'utf8');}

  if (!result && fallbackValue)
  {result = fallbackValue;}

  if (!result) 
  {throw new Error(`File ${filePath} does not exist`);}

  return result;
}; 

module.exports.get = get;