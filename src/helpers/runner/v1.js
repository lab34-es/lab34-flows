const colors = require('colors');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

const path = require('path');
const fs = require('fs');

const mimicing = require('../mimicing');
const apps = require('../applications'); 
const replacer = require('../replacer');
const tester = require('./tester');
const paths = require('../paths');
const reporterHelper = require('../reporter');

let steps = []
let applications = apps.applications;

let mimicdApplications = {};
let appsCtx = {};

let running = false;

const buildSteps = (steps) => {
  // Add "id" property to each step with "applciation.method" as the value
  steps = steps.map((step, index) => {
    if (typeof step === 'string') return { method: step, id: `${step}`, };
    if (step.slug) return { ...step, id: step.slug };

    const stepIdParts = [
      step.application,
      step.method,
      step.waitForTime ? 'waitForTime' : '',
      step.waitForTime ? step.waitForTime.time || '?' : ''
    ];

    return { ...step, id: stepIdParts.filter(Boolean).join('-') };
  });

  // ids must be unique. If one is not unique, add a number to it
  const ids = steps.map(step => step.id);
  const uniqueIds = [...new Set(ids)];
  
  if (ids.length !== uniqueIds.length) {
    steps = steps.map((step, index) => {
      if (ids.filter(id => id === step.id).length === 1) return step;
      return { ...step, id: `${step.id}-${index}` };
    });
  }

  // Just for better visuals in the UI...
  // Move id to the first position of the object
  steps = steps.map(step => {
    const { id, ...rest } = step;
    return { id, ...rest };
  });

  return steps;
}

const buildData = (data, steps, index) => {
  // Convert each step into a property in a json object
  const stepData = steps.reduce((acc, step) => {
    acc[step.id] = step;
    return acc;
  }, {});

  data = replacer.json(JSON.stringify(data), { steps: stepData });

  return data;
}

const executeStep = async (flow, step, attemptNumber = 0) => {
  const { application, method, parameters } = step;

  const stepIndex = flow.steps.findIndex(s => s.id === step.id);

  const params = buildData(parameters, flow.steps, stepIndex);

  // ATTENTION! we might retry the step!!! Meaning that the line above 
  // (buildData) must NOT be executed multiple times. Otherwise, we'll
  // endup replacing handlebars markers multiple times.
  //
  // Example: is test have {{ randomBarcode247 }}, it will endup
  // using a different barcode on every retry. This is not what we want!
  // Instead, once the data is built, we must ensure it's kept in the flow,
  // so the next execution attempts it uses the same data.

  flow.steps[stepIndex].parameters = params;

  let [headers, status, body] = await applications[application][method](
    {
      ...appsCtx[application],
      reporter: flow.reporter
    },
    params,
  );

  // Is the response empty?
  if (!headers && !status && !body) {
    // Ooops!!! Maybe... we've to retry?
    const { retry } = step;

    // Yes, we've to retry.
    if (retry) {
      flow.steps[stepIndex].execution.attempt = attemptNumber + 1;
      flow.reporter.stepUpdate(step.id);

      // Let's retry then.
      // How many times? What's the delay?
      const { times, delay } = retry;

      // Let's retry as many times as we've to
      if (attemptNumber < times) {
        // Let's wait for the delay
        if (delay) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Let's retry
        return executeStep(flow, step, attemptNumber + 1);
      }
      else {
        throw new Error('max retries reached');
      }
    }
  }

  return [headers, status, body]
}

const processor = async (flow, opts) => {
  try {
    const { environment } = opts;

    steps = flow.steps;
    let index = 0;
    // validate environment is valid
    const allEnvironments = await apps.allPossibleEnvironments();
    if (!allEnvironments.includes(environment)) {
      flow.execution.status = 'error';
      flow.execution.error = {
        name: 'InvalidEnvironment',
        message: `Invalid environment: ${environment}. Must be one of ${allEnvironments.join(', ')}`,
        code: 2
      };
      flow.reporter.execution();
      throw flow.execution.error;
    }
    
    // Prepare environment
    const uniqueApplications = [...new Set(steps.map(step => step.application).filter(Boolean))];

    // Load environment variables for each application
    for (let application of uniqueApplications) {
      try {
        if (application === 'tester') continue;

        const applicationPath = await paths.fromHome(['applications', application]);
        const envFile = await paths.fromHome(['applications', application, 'env', `${environment}.env`]);

        // Stop if the file does not exist
        if (application !== 'tester' && !fs.existsSync(envFile)) {
          flow.execution.status = 'error';
          flow.execution.error = {
            name: 'MissingEnvironmentFile',
            message: `Missing environment file for ${application} at ${envFile}`,
            code: 3
          }
          flow.reporter.execution();
          throw flow.execution.error;
        }

        appsCtx[application] = {
          name: application,
          path: applicationPath,
          env: dotenv.parse(fs.readFileSync(envFile))
        }
      } catch (err) {
        flow.execution.status = 'error';
        flow.execution.error = {
          name: 'EnvironmentSetupError',
          message: `Error setting up environment for ${application}: ${err.message}`,
          code: 6,
          originalError: err
        };
        flow.reporter.execution();
        throw flow.execution.error;
      }
    }


    if (!mimicing.validate(steps)) {
      flow.execution.status = 'error';
      flow.execution.error = {
        name: 'InvalidMimic',
        message: `Invalid mimic configuration`,
        code: 5
      };
      flow.reporter.execution();
      throw flow.execution.error;
    }

    mimicdApplications = await mimicing.load(steps);

    await tester.getReady(flow);

    // Add an "id" to each step
    flow.steps = buildSteps(steps);

    // Send the diagram to the client, so the flow can be visualized
    flow.reporter.diagram();

    for (let step of flow.steps) {
      console.log('')

      try {
        // Execute the method and log the result. Pass each property in step.data as a separate argument.
        let { application, method, parameters, mimic, test, testlatentApplications, id } = step;
        if (!parameters) parameters = {};

        // Prepare holder for execution information
        flow.steps[index].execution = {
          times: {}
        };
        flow.steps[index].execution.status = 'running';
        flow.steps[index].execution.times.start = Date.now();

        flow.reporter.stepStart(id);
        flow.reporter.stepUpdate(id);

        // Wait for all mimic'd applications to start
        await mimicing.startStep(mimicdApplications, step, flow);

        const methodExists = applications[application] && applications[application][method];

        if (!methodExists) {
          throw new Error(`Method not found: ${method} in ${application}`);
        }

        const [headers, status, body] = await executeStep(flow, step)
        
        flow.steps[index].execution.times.end = Date.now();
        flow.steps[index].execution.times.duration = (new Date() - flow.execution.times.start) / 1000;
        flow.reporter.stepUpdate(id);

        flow.steps[index].response = { headers, status, body };
        flow.reporter.response({ headers, status, body }, {
          timing: flow.steps[index].execution.duration
        });

        if (test || testlatentApplications) {
          const testReport = await tester.test(flow, test, { headers, status, body });

          flow.steps[index].testReport = testReport;
          flow.reporter.test(testReport);

          if (testReport.hasErrors) {
            flow.steps[index].execution.status = 'failed';
            flow.steps[index].execution.error = {
              name: 'TestFailed',
              message: `Test failed for step ${step.id}`,
              stepId: step.id,
              code: 4
            };
            flow.reporter.stepUpdate(id);
            throw flow.steps[index].execution.error;
          }
          else {
            flow.steps[index].execution.status = 'passed';
          }
        }
        else {
          flow.steps[index].execution.status = 'passed';
        }
        flow.reporter.stepUpdate(id);

        index++;
      } catch (stepError) {
        console.error(stepError);
        flow.steps[index].execution.status = 'error';
        
        flow.steps[index].execution.error = {
          name: stepError.name || 'StepExecutionError',
          message: `Error executing step ${step.id}: ${stepError.message}`,
          code: stepError.code || 7,
          stepId: step.id
        };
        flow.reporter.stepUpdate(step.id);
        throw flow.steps[index].execution.error;
      }
    }

    flow.execution.status = 'passed';
    flow.execution.times.end = Date.now();
    flow.execution.times.duration = flow.execution.times.end - flow.execution.times.start;
    flow.reporter.execution();

    return flow.steps;
  } catch (error) {
    console.error(error);
    // Ensure the flow execution status is set to error
    if (flow.execution) {
      flow.execution.status = 'error';
      if (!flow.execution.error) {
        flow.execution.error = {
          name: error.name || 'ProcessorError',
          message: error.message,
          code: error.code || 1,
          originalError: error
        };
      }
    }
    
    // Report the error if we have a reporter
    if (flow.reporter && typeof flow.reporter.execution === 'function') {
      flow.reporter.execution();
    }

    // Re-throw the error to be handled by the caller
    if (opts.cli) {
      process.exit(1);
    }
  }
};

/**
 * Run the flow
 * @param {*} flow 
 * @param {Object} opts 
 * @param {String} opts.environment
 * @param {Boolean} opts.cli
 */
const run = async (flow, opts) => {
  const executionId = uuidv4();

  const { cli } = opts

  // Now that we've all details, prepare the reporter appropiately
  const { server } = opts.reporter;
  flow.reporter = reporterHelper.get({flow, cli, server});

  // Initialize basis of execution information
  flow.execution = {
    id: executionId,
    status: 'running',
    times: {
      start: Date.now(),
    },
  };

  // Report it
  flow.reporter.execution();

  // API request must reply with basic execution information
  if (!cli) {
    try {
      processor(flow, opts);
    }
    catch (ex) {
     
    }
    return { execution: flow.execution }
  }
  // Invokations based on CLI must wait for processor to complete
  else {
    return processor(flow, opts);
  }
}

module.exports = {
  steps,
  run: async (flow, opts) => {
    if (running) {
      console.error('Already running');
      return;
    }
    running = true;
    try {
      return run(flow, opts)
    }
    catch (ex) {
      throw ex;
    }
    finally {
      running = false;
    }
  }
}