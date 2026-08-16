const express = require('express');
const fs = require('fs');
const router = express.Router();

const apps = require('../../helpers/applications');

const sendError = (res, error, status = 400) => {
  const message = (error && error.message) || String(error);
  const code = /not found/i.test(message) ? 404 : status;
  res.status(code).send({ error: message });
};

router.get('/', (req, res) => {
  apps.parseApplications()
    .then(list => {
      res.send(list);
    });
});

// Editable source files of an application (Source view in the UI)
router.get('/:application/files', (req, res) => {
  apps.listAppFiles(req.params.application)
    .then(files => res.send(files))
    .catch(error => sendError(res, error));
});

// Read one editable file. ?path=README.md | index.js | env/x.env
router.get('/:application/files/content', (req, res) => {
  apps.readAppFile(req.params.application, req.query.path)
    .then(file => res.send(file))
    .catch(error => sendError(res, error));
});

// Create or update one editable file. { path, content }
router.put('/:application/files/content', (req, res) => {
  apps.writeAppFile(req.params.application, req.body.path, req.body.content)
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

router.get('/:application', (req, res) => {
  const application = req.params.application;

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      res.send(app);
    });
});

router.get('/:application/envs', (req, res) => {
  const application = req.params.application;

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      res.send(app.envFiles);
    });
});

router.get('/:application/envs/:env', (req, res) => {
  const application = req.params.application;
  const env = req.params.env;

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      const envFile = app.envFiles.find(envFile => envFile.name === env);
      res.send(envFile);
    });
});

// Update a specific environment variable in an env file
router.put('/:application/envs/:env/:key', (req, res) => {
  const { application, env, key } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Value is required' });
  }

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      if (!app) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const envFile = app.envFiles.find(envFile => envFile.name === env);
      if (!envFile) {
        return res.status(404).json({ error: 'Environment file not found' });
      }

      return apps.updateEnvFile(envFile.path, key, value);
    })
    .then(() => {
      res.json({ 
        success: true, 
        message: `Updated ${key} in ${application}/${env}` 
      });
    });
});

// Get the raw content of an env file for editing
router.get('/:application/envs/:env/raw', (req, res) => {
  const { application, env } = req.params;

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      if (!app) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const envFile = app.envFiles.find(envFile => envFile.name === env);
      if (!envFile) {
        return res.status(404).json({ error: 'Environment file not found' });
      }

      const content = fs.readFileSync(envFile.path, 'utf8');
      
      res.json({
        filename: `${env}.env`,
        path: envFile.path,
        content: content
      });
    });
});

// Update the entire content of an env file
router.put('/:application/envs/:env/raw', (req, res) => {
  const { application, env } = req.params;
  const { content } = req.body;

  if (content === undefined) {
    return res.status(400).json({ error: 'Content is required' });
  }

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      if (!app) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const envFile = app.envFiles.find(envFile => envFile.name === env);
      if (!envFile) {
        return res.status(404).json({ error: 'Environment file not found' });
      }
      
      // Write new content
      fs.writeFileSync(envFile.path, content, 'utf8');
      
      res.json({ 
        success: true, 
        message: `Updated ${application}/${env}.env`
      });
    });
});

module.exports = router;
