const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const paths = require('./paths');
const apps = require('./applications');
const configHelper = require('./config');

const { GoogleGenerativeAI } = require('@google/generative-ai');

const ALLOWED_FILE_FORMATS = ['yaml', 'yml'];

module.exports.createAI = async (body) => {
  const {
    prompt 
  } = body;

  if (!prompt) {
    return Promise.reject('Invalid request');
  }

  const papps = await apps.parseApplications();
  const appsDefinition = papps.map(app => {
    return {
      name: app.name,
      methods: app.methods
    };
  });

  const messageParts = [
    'You are an experienced E2E tester, and you are tasked to build a list of steps to E2E test an scenario.',
    'The scenario is the following:',
    prompt,
    'Please provide the steps you would take to test this scenario.',

    'The output must be a YAML file with the following structure (without any code block markers):',
    'title: <Scenario Title>',
    'description: <Scenario Description>',
    'steps: # List of steps to perform',
    '  - application: <application involved in the step>',
    '    method: <action to perform>',
    '    description: <description of the step>',
    '    parameters: <parameters to pass to the method>',
    '',

    'ONLY USE THE APPLICATIONS STRICLY NECESSARY. Do not include applications that are not needed for the scenario.',
    'If you are not sure about an applicaiton, DO NOT include it.',

    'You MUST respect the format of the parameters. Strings must be enclosed in double quotes, numbers must be plain numbers, and booleans must be true or false.',
    'Avoid repeating steps.',

    'Below, the list of applications you can interact with, and their methods:',
    '------------------',
    JSON.stringify(appsDefinition),
    '------------------',
    'IMPORTANT:',
    '1. Do not reply with explanations, just the YAML.',
    '2. Do not include any markdown code block markers like ```yaml or ``` in your response.',
    '3. Your response should start directly with "title:" and contain only valid YAML.',
    '4. Remember: ONLY YAML is accepted as response.'
  ];

  // Send message parts to the AI
  const finalPrompt = messageParts.join('\n');

  // Load AI config
  const aiConfig = await configHelper.load('ai');

  // Initialize the Gemini API with the API key
  const genAI = new GoogleGenerativeAI(aiConfig.gemini.apiKey);

  // Get the Gemini model
  const model = genAI.getGenerativeModel({
    model: aiConfig.gemini.model || 'gemini-pro'
  });

  // Create a chat session
  const chat = model.startChat({
    generationConfig: {
      temperature: aiConfig.gemini.temperature || 0.7,
      topP: aiConfig.gemini.topP || 0.95,
      topK: aiConfig.gemini.topK || 40
    }
  });

  // Send the prompt to Gemini
  const result = await chat.sendMessage(finalPrompt);
  const response = await result.response;

  let responseText = response.text();
  responseText = responseText.replace(/```yaml/g, '').replace(/```/g, '').trim();

  return {
    flow: responseText
  };
};

module.exports.listCapabilities = async () => {
  return apps.summary();
};

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
};

module.exports.getUserFlow = (flowPath) => {
  if (!fs.existsSync(flowPath)) {
    return Promise.reject('Flow not found');
  }

  const content = getContent(flowPath);
  return Promise.resolve({
    ...content,
    path: flowPath,
    plainText: fs.readFileSync(flowPath, 'utf8')
  });
};

/**
 * List all available flows from the flows directory
 * @returns {Promise<Array>} Array of flow objects
 */
module.exports.list = async () => {
  const flowsDir = await paths.contextDir(['flows']);

  if (!fs.existsSync(flowsDir)) {
    return [];
  }

  const flows = [];
  
  const scanDirectory = (dir, relativePath = '') => {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        scanDirectory(fullPath, path.join(relativePath, item));
      } else if (stat.isFile()) {
        // Check if it's a flow file
        const ext = path.extname(item).toLowerCase().substring(1);
        if (ALLOWED_FILE_FORMATS.includes(ext)) {
          const content = getContent(fullPath);
          if (content) {
            flows.push({
              ...content,
              path: fullPath,
              relativePath: path.join(relativePath, item),
              name: content.title || item.replace(new RegExp(`\\.(${ALLOWED_FILE_FORMATS.join('|')})$`, 'i'), ''),
              category: relativePath || 'root'
            });
          }
        }
      }
    }
  };
  
  scanDirectory(flowsDir);
  
  return flows;
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
    environment
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
    }
  });
};
