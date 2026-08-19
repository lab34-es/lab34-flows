import express from 'express';
import fs from 'fs';
const router = express.Router();

import * as apps from '../../helpers/applications';

const sendError = (res, error, status = 400) => {
  const message = (error && error.message) || String(error);
  let code = status;
  if (error && error.code === 'EEXISTS') { code = 409; }
  else if (/not found/i.test(message)) { code = 404; }
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

// Read one editable file. ?path=README.md | index.ts | env/x.env
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

// Create a new file, failing when the path is taken. { path, content }
router.post('/:application/files', (req, res) => {
  apps.createAppFile(req.params.application, req.body.path, req.body.content)
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Rename or move a file or folder. { from, to }
router.post('/:application/files/rename', (req, res) => {
  apps.renameAppFile(req.params.application, req.body.from, req.body.to)
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Delete a file or folder. ?path=lib/http.js
router.delete('/:application/files/content', (req, res) => {
  apps.deleteAppFile(req.params.application, req.query.path || req.body.path)
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Rename an application, i.e. its folder. { name }
router.put('/:application/rename', (req, res) => {
  apps.renameApplication(req.params.application, req.body.name)
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
      if (!app) {
        return res.status(404).json({ error: 'Application not found' });
      }
      res.send(app.envFiles);
    });
});

router.get('/:application/envs/:env', (req, res) => {
  const application = req.params.application;
  const env = req.params.env;

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      if (!app) {
        return res.status(404).json({ error: 'Application not found' });
      }
      const envFile = app.envFiles.find(envFile => envFile.name === env);
      res.send(envFile);
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

// Update a specific environment variable in an env file
router.put('/:application/envs/:env/:key', async (req, res) => {
  const { application, env, key } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Value is required' });
  }

  try {
    const list = await apps.parseApplications();

    const app = list.find(app => app.slug === application);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const envFile = app.envFiles.find(envFile => envFile.name === env);
    if (!envFile) {
      return res.status(404).json({ error: 'Environment file not found' });
    }

    await apps.updateEnvFile(envFile.path, key, value);

    res.json({
      success: true,
      message: `Updated ${key} in ${application}/${env}`
    });
  }
  catch (error) {
    sendError(res, error, 500);
  }
});

export default router;
