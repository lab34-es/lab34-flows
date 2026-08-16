#!/usr/bin/env node

const paths = require('./helpers/paths');
const applications = require('./helpers/applications');

/**
 * Lab34 Flows CLI Tool
 * 
 * A command-line interface for running flow definitions from YAML files.
 * 
 * Usage:
 *   node cli.js --file <path-to-flow-file> --env <environment> [--debug] [--help]
 *   node cli.js --capabilities
 *   node cli.js --server
 *
 * Options:
 *   --file         Path to the flow definition file (.md or .yaml)
 *   --context      Context directory (defaults to the current working directory)
 *   --capabilities List all available capabilities found in the context directory
 *   --env          Environment to run the flow in (required for --file)
 *   --server       Start the web server with built frontend and API
 *   --debug        Print debug information including environment variables
 *   --help         Show this help message
 *
 * Flow generation with AI lives in the web UI (--server), where the provider,
 * model and API keys are configured.
 *
 * Examples:
 *   node cli.js --file flows/my-flow.md --env production
 *   node cli.js --server
 */

'use strict';

// Disable HTTP/2 to avoid potential issues
process.env.NODE_NO_HTTP2 = '1';

// Core dependencies
const fs = require('fs');
const YAML = require('yaml');
const argv = require('yargs-parser')(process.argv.slice(2));

// Local dependencies
const packageJson = require('../package.json');
const cli = require('./helpers/cli');
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
  flows                                     Open the web UI on the current folder
  flows --file <path-to-flow-file> --env <environment> [--debug] [--help]
  flows --server [--context=<context>]

Options:
  --file          Path to the flow definition file (.md markdown flow or .yaml)
  --capabilities  List all available capabilities found in the context directory
  --server        Start the web server with built frontend and API (default action)
  --env           Environment to run the flow in (required for --file)
  --context       Context directory (defaults to the current working directory)
  --debug         Print debug information including environment variables
  --help          Show this help message

The context directory is where "applications", "flows" and "config" live. It
defaults to the folder you run the command from, so a project keeps its own
flows next to its code. Run "flows" in an empty folder and the bundled example
applications and flows are created there to get you started.

Generating flows with AI is done from the web UI: the provider, model and API
keys are configured there, under Settings.

Examples:
  cd my-project && flows
  flows --file flows/my-flow.md --env production
  flows --context my/context/folder --capabilities
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
 * Parse command line arguments using yargs-parser
 * @returns {Object} Parsed arguments
 */
function parseArguments() {
  return {
    file: argv.file || null,
    ai: argv.ai || null, // Removed: kept only to show a helpful error
    capabilities: argv.capabilities || false,
    server: argv.server || false,
    env: argv.env || null,
    context: argv.context || null,
    debug: argv.debug || false,
    help: argv.help || false,
    v: argv.v || false
  };
}

/**
 * Validate the YAML file path
 * @param {string} filePath - Path to the YAML file
 * @returns {boolean} True if valid, otherwise exits with error
 */
async function validateFilePath(filePath) {
  if (!filePath) {
    exitWithError('No file specified. Use --file <path-to-yaml-file>');
  }

  // An absolute path is taken as-is; a relative one is resolved inside the
  // context directory, so "--file flows/x.md" works from the project folder
  const fullFilePath = require('path').isAbsolute(filePath)
    ? filePath
    : await paths.contextDir(filePath);

  if (!fs.existsSync(fullFilePath)) {
    exitWithError(`File not found: ${fullFilePath}`);
  }

  const isSupported = ['yaml', 'yml', 'md', 'markdown'].some(ext => fullFilePath.toLowerCase().endsWith(`.${ext}`));
  if (!isSupported) {
    exitWithError('File must be a .md, .markdown, .yaml or .yml file');
  }

  return fullFilePath;
}

/**
 * Parse a flow file (markdown or YAML)
 * @param {string} filePath - Path to the flow file
 * @returns {Object} Parsed flow definition
 */
async function parseFlowFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const isMarkdown = ['md', 'markdown'].some(ext => filePath.toLowerCase().endsWith(`.${ext}`));
    if (isMarkdown) {
      const markdownFlows = require('./helpers/markdownFlows');
      return markdownFlows.toFlow(content);
    }
    return YAML.parse(content);
  } catch (error) {
    exitWithError(`Error parsing flow file: ${error.message}`);
  }
}

/**
 * Run the flow with the specified options
 * @param {Object} flowConfig - Flow configuration from YAML
 * @param {Object} options - Runtime options
 */
async function runFlow(flowConfig, options) {
  try {
    await applications.loadAll();

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
    console.trace(error);
    exitWithError(`Error running flow: ${error.message}`);
  }
}

/**
 * Start the web server with built frontend and API
 */
async function startServer() {
  const path = require('path');
  const packageRoot = path.join(__dirname, '..');
  const distPath = path.join(packageRoot, 'frontend', 'dist', 'index.html');

  // Published packages ship a prebuilt frontend. Only a source checkout can
  // (and needs to) build it on the fly.
  if (!fs.existsSync(distPath)) {
    const canBuild = fs.existsSync(path.join(packageRoot, 'frontend', 'package.json'));
    if (!canBuild) {
      exitWithError('Frontend assets are missing from this installation. Reinstall @lab34/flows.');
    }

    console.log('Building frontend...');
    const { spawn } = require('child_process');
    const buildProcess = spawn('npm', ['run', 'build:frontend'], {
      stdio: 'inherit',
      cwd: packageRoot,
      shell: process.platform === 'win32'
    });

    await new Promise((resolve) => {
      buildProcess.on('close', (code) => {
        if (code !== 0) {
          exitWithError('Failed to build frontend');
        }
        console.log('Frontend built successfully.');
        resolve();
      });
    });
  }

  // Start the API server which will serve the built frontend
  const api = require('./api');
  await api.start();
}

/**
 * Main function to execute the CLI
 */
async function main() {
  // Parse command line arguments
  const args = parseArguments();

  // Show version if requested
  if (args.v) {
    console.log(packageJson.version);
    process.exit(0);
  }

  // Show help if requested
  if (args.help) {
    showHelp();
    return;
  }

  // Show debug information if requested
  if (args.debug) {
    printDebugInfo();
  }

  // Check if we're using the server or a file
  if (args.ai) {
    exitWithError(
      'Generating flows with AI is no longer available from the CLI. ' +
      'Start the UI with "lab34-flows --server" and use the "Create using AI" ' +
      'option when creating a flow.'
    );
  } else if (args.capabilities) {
    // List capabilities
    await require('./helpers/bootstrap').ensureDefaults();
    await flows.listCapabilities();
    process.exit(0);
  } else if (args.server) {
    // Start the web server
    await startServer();
  } else if (args.file) {
    // For file mode, environment is required
    if (!args.env) {
      exitWithError('No environment specified. Use --env <environment>');
    }
    
    // Validate file path
    const flowFilePath = await validateFilePath(args.file);
    // Parse the flow file (markdown or YAML)
    const flowConfig = await parseFlowFile(flowFilePath);

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
    // No explicit action: open the UI on the current folder, which is what
    // running plain `flows` in a project directory is meant to do
    await startServer();
  }
}

// Execute the main function
main().catch(error => {
  exitWithError(`Unhandled error: ${error.message}`);
});
