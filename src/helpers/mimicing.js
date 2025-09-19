const path = require('path');
const fs = require('fs');

const paths = require('./paths');

/**
 * given a list of steps, search if all mimic'd applications have a mimic file
 * @param {*} steps 
 * @returns 
 */
module.exports.validate = async (steps) => {
  // Ensure mimic'd applications are available to run. Values are from:
  // steps$.mimic.map(m => m.application)

  const uniqueMimicedApplications = [...new Set(steps.map(step => (step.mimic||[]).map(m => m.application)).flat())];
  
  // Validate that the applications' mimic files are available - using Promise.all for parallel execution
  try {
    const mimicFilePaths = await Promise.all(
      uniqueMimicedApplications.map(application => 
        paths.contextDir(['applications', application, 'mimic.js'])
      )
    );
    
    // Check if all files exist
    for (let i = 0; i < mimicFilePaths.length; i++) {
      const mimicFilePath = mimicFilePaths[i];
      if (!fs.existsSync(mimicFilePath)) {
        console.error(`Mimic file ${mimicFilePath} does not exist`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error validating mimic files: ${error.message}`);
    return false;
  }
};

module.exports.load = async (steps) => {
  const result = {};

  // Ensure mimic'd applications are available to run. Values are from:
  // steps$.mimic.map(m => m.application)
  const uniqueMimicedApplications = [...new Set(steps.map(step => (step.mimic||[]).map(m => m.application)).flat())];

  try {
    // Get all mimic file paths in parallel
    const mimicFilePaths = await Promise.all(
      uniqueMimicedApplications.map(application => 
        paths.contextDir(['applications', application, 'mimic.js'])
      )
    );

    // Process each file path and load the required modules
    for (let i = 0; i < uniqueMimicedApplications.length; i++) {
      const application = uniqueMimicedApplications[i];
      const mimicFilePath = mimicFilePaths[i];
      
      if (!fs.existsSync(mimicFilePath)) {
        console.error(`Mimic file ${mimicFilePath} does not exist`);
        process.exit(1);
      }
      else {
        result[application] = require(mimicFilePath);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error loading mimic files: ${error.message}`);
    process.exit(1);
  }
};

module.exports.startStep = (mimicdApplications, step, flow) => {
  const { mimic } = step;

  if (mimic?.length) {
    flow.reporter.mimicStart();
  }

  // Start the mimic'd applications, using promises
  return Promise.all((mimic || []).map(m => {
    flow.reporter.mimicStart(m);
    return mimicdApplications[m.application].start({
      flow,
      ...m
    });
  }));

  // return (mimic || []).forEach(m => {
  //   report.mimicStart(m)
  //   mimicdApplications[m.application].start(m);
  // });
};

module.exports.stopStep = (mimicdApplications, step) => {
  const { mimic } = step;

  return Promise.all((mimic || []).map(m => {
    return mimicdApplications[m.application].stop(m);
  }));
};