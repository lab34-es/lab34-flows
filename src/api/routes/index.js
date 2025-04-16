const express = require('express');

const flows = require('./flows');
const applications = require('./applications');
const system = require('./system');
const config = require('./config');

module.exports = (app) => {
  app.use('/flows', flows);
  app.use('/applications', applications);
  app.use('/system', system);
  app.use('/config', config);  // Add the new config routes
};