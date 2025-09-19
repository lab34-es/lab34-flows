const express = require('express');

const flows = require('./flows');
const applications = require('./applications');
const environment = require('./environment');

module.exports = (app) => {
  app.use('/api/flows', flows);
  app.use('/api/applications', applications);
  app.use('/api/environment', environment);
};
