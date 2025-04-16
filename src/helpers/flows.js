const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const paths = require('./paths');
const apps = require('./applications');
const configHelper = require('./config');

const ollama = require('ollama');

const ALLOWED_FILE_FORMATS = ['yaml', 'yml'];

module.exports.createAI = async (body) => {
  const {
    prompt 
  } = body;

  if (!prompt) {
    return Promise.reject('Invalid request');
  }

  const messageParts = [
    'You are an experienced E2E tester, and you are tasked to build a list of steps to E2E test an scenario.',
    'The scenario is the following:',
    prompt,
    'Please provide the steps you would take to test this scenario.',

    'The output must be a YAML - ONLY - file with the following structure:',
    '```yaml',
    'title: <Scenario Title>',
    'description: <Scenario Description>',
    'steps: # List of steps to perform',
    '  - application: <application involved in the step>',
    '    method: <action to perform>',
    '    description: <description of the step>',
    '    parameters: <parameters to pass to the method>',
    '',
    '```',

    `ONLY USE THE APPLICATIONS STRICLY NECESSARY. Do not include applications that are not needed for the scenario.`,
    'If you are not sure about an applicaiton, DO NOT include it.',

    'You MUST respect the format of the parameters. Strings must be enclosed in double quotes, numbers must be plain numbers, and booleans must be true or false.',
    'Avoid repeating steps.',

    'Below, the list of applications you can interact with, and their methods:',
    '------------------',
    await apps.yamlSummary(),
    '------------------',
    'Do not reply with explanations, just the YAML.',
    'Remember: ONLY YAML is accepted as response.',
    'Do not enclose the YAML in code blocks.',
  ];

  // Send message parts to the AI
  const finalPrompt = messageParts.join('\n');

  // Load AI config
  const aiConfig = await configHelper.load('ai');

  const oo = new ollama.Ollama({
    host: aiConfig.ollama.host,
  });

  // const tools = [{
  //   type: 'function',
  //   function: {
  //     name: 'get_current_date',
  //     description: 'Get the current date in the format YYYY-MM-DD',
  //   }
  // }]

  // Interate with the AI and attend tool function calling
  let response = await oo.chat({
    model: aiConfig.ollama.model || 'llama3',
    messages: [{ role: 'user', content: finalPrompt }],
    // tools: tools,
    stream: false
  });

  // Handle tool function calls if needed
  while (response.message.tool_calls && response.message.tool_calls.length > 0) {
    const toolCalls = response.message.tool_calls;
    const toolResults = [];

    // for (const toolCall of toolCalls) {
    //   if (toolCall.function.name === 'get_current_date') {
    //     const today = new Date();
    //     const date = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    //     toolResults.push({
    //       tool_call_id: toolCall.id,
    //       role: 'tool',
    //       content: date
    //     });
    //   }
    // }

    // Add the AI's message and tool results to the conversation
    const updatedMessages = [
      { role: 'user', content: finalPrompt },
      response.message,
      // ...toolResults
    ];

    // Get the final response from the AI
    response = await oo.chat({
      model: aiConfig.ollama.model || 'llama3',
      messages: updatedMessages,
      stream: false
    });
  }

  return {
    flow: response.message.content
  }
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