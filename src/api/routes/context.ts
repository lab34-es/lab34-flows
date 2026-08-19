import express from 'express';
const router = express.Router();

import * as context from '../../helpers/context';

const sendError = (res, error, status = 400) => {
  const message = (error && error.message) || String(error);
  res.status(status).send({ error: message });
};

// The context directory and, when it is one, its git repository:
// { path, name, custom, git: { branch, upstream, ahead, behind, remote, changes } }
router.get('/', (req, res) => {
  context.info()
    .then(info => res.send(info))
    .catch(error => sendError(res, error, 500));
});

// Bring the context directory up to date with its remote
router.post('/git/pull', (req, res) => {
  context.pull()
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Commit what changed in the context directory. { message, paths? }
router.post('/git/commit', (req, res) => {
  context.commit({ message: req.body.message, paths: req.body.paths })
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Publish the commits of the current branch
router.post('/git/push', (req, res) => {
  context.push()
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

export default router;
