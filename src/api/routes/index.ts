import flows from './flows';
import applications from './applications';
import environment from './environment';
import settings from './settings';
import jira from './jira';
import views from './views';

export default (app) => {
  app.use('/api/flows', flows);
  app.use('/api/views', views);
  app.use('/api/applications', applications);
  app.use('/api/environment', environment);
  app.use('/api/settings', settings);
  app.use('/api/jira', jira);
};
