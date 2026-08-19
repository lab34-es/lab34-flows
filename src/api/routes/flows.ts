import express from 'express';
const router = express.Router();

import * as flows from '../../helpers/flows';

const sendError = (res, error, status = 400) => {
  const message = (error && error.message) || String(error);
  const code = error && error.code === 'EEXISTS' ? 409 : status;
  res.status(code).send({ error: message });
};

router.get('/', (req, res) => {
  flows.list()
    .then(list => res.send(list))
    .catch(error => sendError(res, error, 500));
});

// Nested folders + flow files, for the sidebar tree
router.get('/tree', (req, res) => {
  flows.tree()
    .then(tree => res.send(tree))
    .catch(error => sendError(res, error, 500));
});

// Parse raw flow content (markdown or YAML) into segments/steps
router.post('/parse', (req, res) => {
  try {
    res.send(flows.parseValue(req.body.value || '', req.body.format || null));
  }
  catch (error) {
    sendError(res, error);
  }
});

// Generate a new Markdown flow from a prompt. { prompt }
router.post('/create/ai', (req, res) => {
  flows.createAI(req.body)
    .then(flow => res.send(flow))
    .catch(error => sendError(res, error));
});

// Rewrite an existing flow following an instruction. { prompt, content }
router.post('/edit/ai', (req, res) => {
  flows.editAI(req.body)
    .then(flow => res.send(flow))
    .catch(error => sendError(res, error));
});

router.post('/start', (req, res) => {
  flows.start(req.body, {
    io: req.app.get('io')
  })
    .then(flow => {
      res.send({ execution: flow.execution });
    })
    .catch(error => sendError(res, error));
});

router.get('/user', (req, res) => {
  const path = req.query.path;
  flows.getUserFlow(path)
    .then(flow => res.send(flow))
    .catch(error => res.status(404).send({ error: error.message || error }));
});

// Create a folder inside the flows directory
router.post('/folder', (req, res) => {
  flows.createFolder(req.body.path)
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Create or save a flow file. { path, content, overwrite }
router.post('/file', (req, res) => {
  flows.saveFile({
    relativePath: req.body.path,
    content: req.body.content,
    overwrite: Boolean(req.body.overwrite)
  })
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Rewrite the frontmatter of a markdown flow. { path, properties }
router.put('/properties', (req, res) => {
  flows.saveProperties({
    relativePath: req.body.path,
    properties: req.body.properties
  })
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Rename or move a flow file or folder. { from, to }
router.post('/rename', (req, res) => {
  flows.rename(req.body.from, req.body.to)
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Delete a flow file or folder. { path }
router.delete('/file', (req, res) => {
  flows.remove(req.body.path || req.query.path)
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

export default router;
