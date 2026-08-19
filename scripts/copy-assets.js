#!/usr/bin/env node
/**
 * Copy non-TypeScript build assets into dist/.
 *
 * src/defaults holds the example applications and flows that are seeded into
 * the user's context directory on first run. They are templates executed in
 * *that* directory, not modules of this package: their TypeScript is
 * transpiled at run time by helpers/appLoader, which is also what resolves
 * their `@lab34/flows` import. They are therefore copied verbatim and stay out
 * of the TypeScript program. helpers/bootstrap resolves them at
 * `__dirname/../defaults`, which is dist/defaults once compiled.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const assets = [['src/defaults', 'dist/defaults']];

for (const [from, to] of assets) {
  const source = path.join(root, from);
  const destination = path.join(root, to);

  if (!fs.existsSync(source)) {
    console.error(`copy-assets: missing source ${from}`);
    process.exitCode = 1;
    continue;
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
  console.log(`copy-assets: ${from} -> ${to}`);
}
