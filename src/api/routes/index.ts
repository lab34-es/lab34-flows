import flows from './flows';
import applications from './applications';
import environment from './environment';
import settings from './settings';
import jira from './jira';
import views from './views';
import testRuns from './testRuns';
import contextRoutes from './context';

export default (app) => {
  // express 5 leaves req.body undefined when a request carries no body, where
  // express 4 defaulted it to {}. Several routes accept their argument from
  // either the body or the query string (DELETE /api/flows/file among them),
  // and would otherwise throw a TypeError -- a 500 -- on the query-string form.
  app.use('/api', (req, _res, next) => {
    if (req.body === undefined) { req.body = {}; }
    next();
  });

  app.use('/api/flows', flows);
  app.use('/api/views', views);
  app.use('/api/test-runs', testRuns);
  app.use('/api/applications', applications);
  app.use('/api/environment', environment);
  app.use('/api/settings', settings);
  app.use('/api/jira', jira);
  app.use('/api/context', contextRoutes);
};
