const express = require('express');

const flows = require('./flows');
const applications = require('./applications');

module.exports = (app) => {
  app.use('/flows', flows);
  app.use('/applications', applications);
};