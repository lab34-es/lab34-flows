/**
 * Public entry point for `require('@lab34/flows')`.
 *
 * Re-exports the helpers that make up the programmable surface of the tool,
 * plus express itself so consumers can mount the mimic servers without taking
 * their own dependency on a possibly-different express version.
 */
import express from 'express';

import * as applications from './helpers/applications';
import * as flows from './helpers/flows';
import * as httpClient from './helpers/httpClient';
import * as httpServer from './helpers/httpServer';
import * as mimicFiles from './helpers/mimicFiles';
import * as pgClient from './helpers/pgClient';
import * as playwright from './helpers/playwright';
import * as replacer from './helpers/replacer';
import * as validate from './helpers/validate';

export {
  applications,
  express,
  flows,
  httpClient,
  httpServer,
  mimicFiles,
  pgClient,
  playwright,
  replacer,
  validate
};
