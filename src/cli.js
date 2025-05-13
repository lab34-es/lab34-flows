#!/usr/bin/env node

/**
 * Lab34 Flows CLI Tool
 * 
 * A command-line interface for running flow definitions from YAML files.
 * 
 * Usage:
 *   node cli.js --file <path-to-yaml-file> --env <environment> [--debug] [--help]
 *   node cli.js --capabilities
 *   node cli.js --ai "<prompt>"
 * 
 * Options:
 *   --file         Path to the YAML flow definition file (required if not using --ai)
 *   --ai           Generate a flow from a prompt using AI (required if not using --file)
 *   --capabilities List all available capabilities from the contents of ~/flows
 *   --env          Environment to run the flow in (required for --file, optional for --ai)
 *   --debug        Print debug information including environment variables
 *   --help         Show this help message
 * 
 * Examples:
 *   node cli.js --file flows/my-flow.yaml --env production
 *   node cli.js --ai "Test login functionality with valid credentials"
 */

'use strict';

// Disable HTTP/2 to avoid potential issues
process.env.NODE_NO_HTTP2 = '1';

// Core dependencies
const fs = require('fs');
const YAML = require('yaml');

// Local dependencies
const packageJson = require('../package.json');
const cli = require('./helpers/cli');
const preparation = require('./helpers/preparation');
const reporter = require('./helpers/reporter');
const flows = require('./helpers/flows');

/**
 * Print error message and exit with error code
 * @param {string} message - Error message to display
 * @param {number} [exitCode=1] - Process exit code
 */
function exitWithError(message, exitCode = 1) {
  console.error(`ERROR: ${message}`);
  process.exit(exitCode);
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
Lab34 Flows CLI Tool v${packageJson.version}

Usage:
  lab34-flows --file <path-to-yaml-file> --env <environment> [--debug] [--help]
  lab34-flows --ai "<prompt>"

Options:
  --file          Path to the YAML flow definition file (required if not using --ai)
  --capabilities  List all available capabilities from the contents of ~/flows
  --ai            Generate a flow from a prompt using AI (required if not using --file)
  --env           Environment to run the flow in (required for --file, optional for --ai)
  --debug         Print debug information including environment variables
  --help          Show this help message

Examples:
  lab34-flows --file flows/my-flow.yaml --env production
  lab34-flows --capabilities
  lab34-flows --ai "Test login functionality with valid credentials"
  `);
  process.exit(0);
}

/**
 * Print debug information
 */
function printDebugInfo() {
  console.log('\n=== DEBUG INFORMATION ===');
  console.log('\nPackage Information:');

  // Print package info

  console.log(`Package Name: ${packageJson.name}`);
  console.log(`Package Version: ${packageJson.version}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Architecture: ${process.arch}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Process Title: ${process.title}`);
  console.log(`Process Uptime: ${process.uptime()} seconds`);
  console.log(`Current User: ${process.env.USER || process.env.USERNAME}`);
  console.log(`Current Directory: ${process.cwd()}`);

  console.log('');
  console.log('');
  console.log('');

  console.log('\nEnvironment Variables:');

  Object.keys(process.env).sort().forEach(key => {
    console.log(`${key}=${process.env[key]}`);
  });

  console.log('');
  console.log('');
  console.log('');
  
  console.log('\nNode.js Variables:');
  console.log(`__dirname: ${__dirname}`);
  console.log(`__filename: ${__filename}`);
  console.log(`process.cwd(): ${process.cwd()}`);
  console.log(`process.argv: ${JSON.stringify(process.argv, null, 2)}`);
}

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArguments() {
  const args = {
    file: null,
    ai: null,
    capabilities: null,
    env: null,
    debug: false,
    help: false
  };

  // Check for help flag
  if (process.argv.includes('--help')) {
    args.help = true;
    return args;
  }

  // Check for debug flag
  if (process.argv.includes('--debug')) {
    args.debug = true;
  }

  // Get file path
  const fileIndex = process.argv.indexOf('--file');
  if (fileIndex > -1 && fileIndex + 1 < process.argv.length) {
    args.file = process.argv[fileIndex + 1];
  }

  // Get AI prompt
  const aiIndex = process.argv.indexOf('--ai');
  if (aiIndex > -1 && aiIndex + 1 < process.argv.length) {
    args.ai = process.argv[aiIndex + 1];
  }

  // Get capabilities flag
  if (process.argv.includes('--capabilities')) {
    args.capabilities = true;
  }

  // Get environment
  const envIndex = process.argv.indexOf('--env');
  if (envIndex > -1 && envIndex + 1 < process.argv.length) {
    args.env = process.argv[envIndex + 1];
  }

  return args;
}

/**
 * Validate the YAML file path
 * @param {string} filePath - Path to the YAML file
 * @returns {boolean} True if valid, otherwise exits with error
 */
function validateFilePath(filePath) {
  if (!filePath) {
    exitWithError('No file specified. Use --file <path-to-yaml-file>');
  }

  if (!fs.existsSync(filePath)) {
    exitWithError(`File not found: ${filePath}`);
  }

  const isYaml = ['yaml', 'yml'].some(ext => filePath.toLowerCase().endsWith(`.${ext}`));
  if (!isYaml) {
    exitWithError('File must be a .yaml or .yml file');
  }

  return true;
}

/**
 * Parse YAML file content
 * @param {string} filePath - Path to the YAML file
 * @returns {Object} Parsed YAML content
 */
function parseYamlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return YAML.parse(content);
  } catch (error) {
    exitWithError(`Error parsing YAML file: ${error.message}`);
  }
}

/**
 * Run the flow with the specified options
 * @param {Object} flowConfig - Flow configuration from YAML
 * @param {Object} options - Runtime options
 */
async function runFlow(flowConfig, options) {
  try {
    await preparation.run();

    cli.logo(packageJson.version);
    cli.wisdom();

    const runnerVersion = flowConfig.version || '1';
    const runner = require(`./helpers/runner/v${runnerVersion}`);

    if (process.env.IS_NODEMON) {
      setTimeout(() => {
        runner.run(flowConfig, options);
      }, 1000);
    } else {
      runner.run(flowConfig, options);
    }
  } catch (error) {
    exitWithError(`Error running flow: ${error.message}`);
  }
}

/**
 * Generate a flow using AI
 * @param {string} prompt - The prompt to generate a flow from
 * @returns {Promise<Object>} - The generated flow configuration
 */
async function generateFlowWithAI(prompt) {
  console.log('Generating flow from prompt using AI...');

  try {
    const result = await flows.createAI({ prompt });
    if (!result || !result.flow) {
      exitWithError('Failed to generate flow from AI');
    }
    
    console.log('Flow generated successfully!');
    
    try {
      // Create random file name
      const fileName = `flow-${Math.random().toString(36).substring(2, 15)}.yaml`;
      const filePath = `./${fileName}`;
      // Write the flow to a file
      fs.writeFileSync(filePath, result.flow, 'utf8');
      return filePath
    } catch (yamlError) {
      console.error('Error parsing YAML from AI response:', yamlError.message);
      console.error('Raw AI response:', result.flow);
      exitWithError('Failed to parse the AI-generated YAML. Please try again with a different prompt.');
    }
  } catch (error) {
    exitWithError(`Error generating flow with AI: ${error.message}`);
  }
}

const ai = async flow => {
}

/**
 * Main function to execute the CLI
 */
async function main() {
  // NODE_PATH must be set
  if (!process.env.NODE_PATH) {
    exitWithError('NODE_PATH environment variable is not set. Please set it to the path of your node_modules directory.');
  }

  // Parse command line arguments
  const args = parseArguments();

  // Show help if requested
  if (args.help) {
    showHelp();
    return;
  }

  // Show debug information if requested
  if (args.debug) {
    printDebugInfo();
  }

  // Check if we're using AI or a file
  if (args.ai) {
    const flowPath = await generateFlowWithAI(args.ai);
    console.log(`Flow generated and saved to ${flowPath}`);
    process.exit(0);
  } else if (args.capabilities) {
    // List capabilities
    await flows.listCapabilities();
    process.exit(0);
  } else if (args.file) {
    // For file mode, environment is required
    if (!args.env) {
      exitWithError('No environment specified. Use --env <environment>');
    }
    
    // Validate file path
    validateFilePath(args.file);
    
    // Parse YAML file
    const flowConfig = parseYamlFile(args.file);

    // Set up options
    const options = {
      environment: args.env,
      reporter: reporter.get({ cli: true }),
      cli: true,
      debug: args.debug
    };

    // Run the flow
    await runFlow(flowConfig, options);
  } else {
    exitWithError('No flow source specified. Use either --file <path-to-yaml-file> or --ai "<prompt>"');
  }
}

// Execute the main function
main().catch(error => {
  exitWithError(`Unhandled error: ${error.message}`);
});
