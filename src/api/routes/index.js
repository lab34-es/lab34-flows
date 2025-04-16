const express = require('express');

const flows = require('./flows');
const applications = require('./applications');
const system = require('./system');

module.exports = (app) => {
  app.use('/flows', flows);
  app.use('/applications', applications);
  app.use('/system', system);
};