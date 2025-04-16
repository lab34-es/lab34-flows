const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const paths = require('./paths');

const ALLOWED_FILE_FORMATS = ['yaml', 'yml'];

/**
 * Given the location of a yaml file, return its content
 * @param {*} path 
 * @returns 
 */
const getContent = (flowPath) => {
  const fileName = path.basename(flowPath);
  
  let contents;

  try {
    contents = YAML.parse(fs.readFileSync(flowPath, 'utf8'));

    if (!contents.title) {
      // title = remove (ALLOWED_FILE_FORMATS) from the file name using regex
      contents.title = fileName.replace(new RegExp(`\\.(${ALLOWED_FILE_FORMATS.join('|')})$`, 'i'), '');
      contents.title = contents.title.replace(/_/g, ' ');
      // switch to camel case all words
      contents.title = contents.title.replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  catch (ex) {
    contents = null;
  }

  return contents;
}

const listUserFlows = async () => {
  const userFlows = await paths.fromHome('flows');
  
  return paths.findFiles(userFlows, 0, 4, [], ALLOWED_FILE_FORMATS)
    .map(flowPath => {
      const content = getContent(flowPath);
      const basename = path.basename(flowPath);
      return {
        name: basename,
        isOk: !!content,
        path: flowPath,
        title: content ? content.title : basename,
        description: content ? content.description : '',
      }
    });
}

module.exports.user = () => {
  return listUserFlows();
}

module.exports.getUserFlow = (flowPath) => {
  if (!fs.existsSync(flowPath)) {
    return Promise.reject('Flow not found');
  }

  const content = getContent(flowPath)
  return Promise.resolve({
    ...content,
    path: flowPath,
    plainText: fs.readFileSync(flowPath, 'utf8')
  })
};

/**
 * Method called from API 
 * 
 * @param {*} body 
 * @returns 
 */
module.exports.start = async (body, opts) => {
  const {
    value,
    environment,
  } = body;

  const {
    io // socketio instance
  } = opts;

  const required = ['value', 'environment'];

  if (!required.every(key => body[key])) {
    return Promise.reject('Invalid request');
  }

  const flowAsJson = YAML.parse(value);

  const runner = require(`./runner/v${flowAsJson.version || '1'}`);

  return runner.run(flowAsJson, {
    environment,
    reporter: {
      cli: false,
      server: io
    },
  });
}