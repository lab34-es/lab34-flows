#!/usr/bin/env node
/**
 * Copy non-TypeScript build assets into dist/.
 *
 * src/defaults holds the example applications and flows that are seeded into
 * the user's context directory on first run. They are templates executed in
 * *that* directory -- where `require('lab34-flows')` resolves to the installed
 * package -- not modules of this package, so they stay plain JavaScript and are
 * excluded from the TypeScript program. helpers/bootstrap resolves them at
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
