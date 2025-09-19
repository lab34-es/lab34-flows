const path = require('path');
const fs = require('fs');
const YAML = require('yaml');

const { chromium, firefox, webkit, devices } = require('playwright');

const replacer = require('./replacer');

const ALLOWED_METHODS = [
  'goto',
  'click',
  'type',
  'waitForSelector',
  'assert',
  'route',
  'screenshot',
  'waitForInput',
  'waitForTimeout',
  'scrape',
  'hover',
  'press',
  'fill',
  'selectOption',
  'check',
  'uncheck',
  'dblclick',
  'focus',
  'dragAndDrop',
  'evaluate',
  'keyboard',
  'mouse'
];

const BROWSER_TYPES = {
  chromium,
  firefox,
  webkit
};

const error = (ctx, yamlFile, error) => {
  const message = `Error in ${yamlFile}: ${error}`;
  console.error(message);
  process.exit(9);
}

/**
 * @param {*} result 
 * @param {string} output - The format to have the output in (defaults to string)
 * - number
 * - string
 * - date
 * - boolean
 * @param {string} regexp - The regex to apply to the result
 * @returns 
 */
const formatScrapeResult = async (elements, output, regexp) => {
  // Apply default output
  if (!output) output = 'string';

  const expectsArrayAsOutput = output.includes('[]');
  if (expectsArrayAsOutput) {
    return 'not supported yet';
  }

  let firstElement = Array.isArray(elements) ? elements[0] : elements;
  firstElement = await firstElement.textContent();

  if (regexp) {
    const regex = new RegExp(regexp);
    const match = firstElement.match(regex);
    if (match) {
      firstElement = match[0];
    } else {
      return null;
    }
  }

  let result;

  if (output === 'number') result = Number(firstElement.replace(/[^0-9.]/g, ''));
  if (output === 'string') result = firstElement.trim();
  if (output === 'date') result = new Date(firstElement).toISOString();
  if (output === 'boolean') result = ['true', 'yes', '1', 'si'].includes(firstElement.toLowerCase());
  return Promise.resolve(result || firstElement);
}

/**
 * Given a list of steps, return a list of steps with unique ids
 * 
 * @param {*} steps 
 * @returns 
 */
const buildSteps = (steps) => {
  // Add "id" property to each step with "applciation.method" as the value
  steps = steps.map((step, index) => {
    if (typeof step === 'string') return { id: `${step}`, method: step };
    if (step.slug) return { ...step, id: step.slug };

    const stepIdParts = [
      step.method,
    ];

    return {
      id: stepIdParts.filter(Boolean).join('-'),
      ...step
    };
  });

  // ids must be unique. If one is not unique, add a number to it
  const ids = steps.map(step => step.id);
  const uniqueIds = [...new Set(ids)];
  if (ids.length !== uniqueIds.length) {
    steps = steps.map((step, index) => {
      if (ids.filter(id => id === step.id).length === 1) return step;
      return { id: `${step.id}-${index}`, ...step, };
    });
  }
  return steps;
}

const buildData = (data, vars, index) => {
  const {
    steps,
    ...rest
  } = vars;

  // Convert each step into a property in a json object
  const stepData = steps.reduce((acc, step) => {
    acc[step.id] = step;
    return acc;
  }, {});

  data = replacer.json(JSON.stringify(data), Object.assign({}, rest, {steps: stepData}));

  return data;
}

module.exports.run = (ctx, yamlFile, stepParams) => {
  const yamlPath = path.join(ctx.path, yamlFile);
  const yaml = fs.readFileSync(yamlPath, 'utf8');

  const flow = YAML.parse(yaml);
  let { device, keepOpen, steps, browserType = 'chromium', launchOptions = {} } = flow;

  steps = buildSteps(steps);

  // Validate device
  if (!device) device = 'iPhone 11 Pro';
  if (!devices[device]) {
    error(ctx, yamlFile, `Invalid device: ${device}`);
  }

  // Validate browser type
  if (!BROWSER_TYPES[browserType]) {
    error(ctx, yamlFile, `Invalid browser type: ${browserType}. Supported types are: ${Object.keys(BROWSER_TYPES).join(', ')}`);
  }

  // Validate methods
  const methodNames = steps.map(step => step.method);
  const invalidMethods = methodNames.filter(method => !ALLOWED_METHODS.includes(method));
  if (invalidMethods.length) {
    error(ctx, yamlFile, `Invalid methods: ${invalidMethods.join(', ')}`);
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Setup with enhanced launch options
      const defaultLaunchOptions = {
        headless: false,
        args: [],
        ignoreHTTPSErrors: true,
        timeout: 30000,
        ...launchOptions
      };

      const browser = await BROWSER_TYPES[browserType].launch(defaultLaunchOptions);

      const constextOptions = {
        ...devices[device],
        viewport: devices[device].viewport,
        locale: 'en-US',
        timezoneId: 'Europe/Brussels',
        permissions: [],
        // geolocation: null,
        ...flow.contextOptions
      };

      const context = await browser.newContext(constextOptions);
      
      const page = await context.newPage();

      // Enhanced error handling and logging
      page.on('console', msg => console.log('Browser console:', msg.text()));
      page.on('pageerror', err => console.error('Browser page error:', err));

      // The actual interesting bit
      await context.route('**.jpg', route => route.abort());

      let currentStep = 0;

      for (let step of steps) {
        // Replace step values
        steps[currentStep] = buildData(steps[currentStep], {
          ctx,
          steps,
          parameters: stepParams,
          ...step.parameters || {}
        }, currentStep);

        const { method, parameters } = steps[currentStep];

        ctx.reporter.playwrightStep(ctx, method, parameters);
        
        switch (method) {
          case 'goto':
            await page.goto(parameters.url, { 
              waitUntil: parameters.waitUntil || 'networkidle',
              timeout: parameters.timeout || 30000 
            });
            break;
          case 'click':
            await page.click(parameters.selector, { 
              button: parameters.button || 'left',
              clickCount: parameters.clickCount || 1,
              delay: parameters.delay,
              timeout: parameters.timeout
            });
            break;
          case 'type':
            await page.type(parameters.selector, parameters.text, {
              delay: parameters.delay,
              timeout: parameters.timeout
            });
            break;
          case 'fill':
            await page.fill(parameters.selector, parameters.value, {
              timeout: parameters.timeout
            });
            break;
          case 'press':
            await page.press(parameters.selector, parameters.key, {
              delay: parameters.delay,
              timeout: parameters.timeout
            });
            break;
          case 'hover':
            await page.hover(parameters.selector, {
              position: parameters.position,
              timeout: parameters.timeout
            });
            break;
          case 'dragAndDrop':
            await page.dragAndDrop(parameters.source, parameters.target, {
              force: parameters.force,
              timeout: parameters.timeout
            });
            break;
          case 'selectOption':
            await page.selectOption(parameters.selector, parameters.values, {
              timeout: parameters.timeout
            });
            break;
          case 'check':
            await page.check(parameters.selector, {
              position: parameters.position,
              timeout: parameters.timeout
            });
            break;
          case 'uncheck':
            await page.uncheck(parameters.selector, {
              position: parameters.position,
              timeout: parameters.timeout
            });
            break;
          case 'evaluate':
            await page.evaluate(parameters.pageFunction, parameters.arg);
            break;
          case 'keyboard':
            await page.keyboard[parameters.action](...(parameters.args || []));
            break;
          case 'mouse':
            await page.mouse[parameters.action](...(parameters.args || []));
            break;
          case 'waitForTimeout':
            await page.waitForTimeout(parameters.time);
            break;
          case 'waitForSelector':
            await page.waitForSelector(parameters.selector);
            break;
          case 'assertTitle':
            assert(await page.title() === parameters.title);
            break;
          case 'screenshot':
            await page.screenshot({ path: parameters.path });
            break;
          case 'waitForInput':
            process.stdout.write(`      Enter an input and press enter to continue: `.yellow.bold);
            await new Promise(resolve => process.stdin.once('data', (key) => {
              const input = key.toString().trim().replace('\n', '');
              steps[currentStep].result = { input };
              resolve();
            }));
            break;
          case 'scrape':
            const results = {};
            for (const key in parameters) {
              const { selector, output, regex } = parameters[key];
              const elements = await page.$$(selector);
              results[key] = await formatScrapeResult(elements, output, regex);
            }
            steps[currentStep].result = results;
            break;
          default:
            break;
        }

        currentStep++;
      }

      // Teardown
      if (!keepOpen) {
        await context.close();
        await browser.close();
      }
      const allScrappedData = steps
        .filter(step => step.method === 'scrape')
        .map(step => step.result)
        .reduce((acc, result) => Object.assign(acc, result), {});

      resolve([null, null, allScrappedData]);

    } catch (error) {
      reject(error);
    }
  });
}
