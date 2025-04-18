#!/usr/bin/env node

/**
 * Lab34 Flows CLI Tool
 * 
 * A command-line interface for running flow definitions from YAML files.
 * 
 * Usage:
 *   node cli.js --file <path-to-yaml-file> --env <environment> [--debug] [--help]
 * 
 * Options:
 *   --file     Path to the YAML flow definition file (required)
 *   --env      Environment to run the flow in (required)
 *   --debug    Print debug information including environment variables
 *   --help     Show this help message
 * 
 * Example:
 *   node cli.js --file flows/my-flow.yaml --env production
 */

'use strict';

// Disable HTTP/2 to avoid potential issues
process.env.NODE_NO_HTTP2 = '1';

// Core dependencies
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// Local dependencies
const packageJson = require('../package.json');
const cli = require('./helpers/cli');
const preparation = require('./helpers/preparation');
const reporter = require('./helpers/reporter');

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
  node cli.js --file <path-to-yaml-file> --env <environment> [--debug] [--help]

Options:
  --file     Path to the YAML flow definition file (required)
  --env      Environment to run the flow in (required)
  --debug    Print debug information including environment variables
  --help     Show this help message

Example:
  node cli.js --file flows/my-flow.yaml --env production
  `);
  process.exit(0);
}

/**
 * Print debug information
 */
function printDebugInfo() {
  console.log('\n=== DEBUG INFORMATION ===');
  console.log('\nEnvironment Variables:');

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

  Object.keys(process.env).sort().forEach(key => {
    console.log(`${key}=${process.env[key]}`);
  });
  
  console.log('\nNode.js Variables:');
  console.log(`__dirname: ${__dirname}`);
  console.log(`__filename: ${__filename}`);
  console.log(`process.cwd(): ${process.cwd()}`);
  console.log(`process.argv: ${JSON.stringify(process.argv, null, 2)}`);
  console.log('\n=========================\n');
}

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArguments() {
  const args = {
    file: null,
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
 * Main function to execute the CLI
 */
async function main() {
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

  // Validate file path
  validateFilePath(args.file);

  // Validate environment
  if (!args.env) {
    exitWithError('No environment specified. Use --env <environment>');
  }

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
}

// Execute the main function
main().catch(error => {
  exitWithError(`Unhandled error: ${error.message}`);
});
