const flows = require('./flows');
const applications = require('./applications');
const environment = require('./environment');
const settings = require('./settings');
const jira = require('./jira');
const views = require('./views');

module.exports = (app) => {
  app.use('/api/flows', flows);
  app.use('/api/views', views);
  app.use('/api/applications', applications);
  app.use('/api/environment', environment);
  app.use('/api/settings', settings);
  app.use('/api/jira', jira);
};
