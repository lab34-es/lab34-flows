#!/usr/bin/env node
/**
 * Turn the coverage summary jest writes into an SVG badge for the README.
 *
 * The number shown is the statement coverage of src/ as measured by the run
 * that produced coverage/coverage-summary.json, so the badge cannot drift from
 * what CI actually enforces: the same run fails when any metric drops below
 * the threshold in jest.config.js.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const THRESHOLD = 80;

const root = path.join(__dirname, '..');
const summaryPath = path.join(root, 'coverage', 'coverage-summary.json');
const outputPath = path.join(root, '.github', 'badges', 'coverage.svg');

if (!fs.existsSync(summaryPath)) {
  console.error(`coverage-badge: ${summaryPath} not found. Run "npm run test:coverage" first.`);
  process.exit(1);
}

const total = JSON.parse(fs.readFileSync(summaryPath, 'utf8')).total;
const pct = Math.round(total.statements.pct * 10) / 10;

// Shields' own palette, so the badge sits naturally next to other ones.
const colour = pct >= 90 ? '#4c1' : pct >= THRESHOLD ? '#97ca00' : pct >= 60 ? '#dfb317' : '#e05d44';

const label = 'coverage';
const value = `${pct}%`;

// 6px per character plus padding is close enough to Verdana 11 for these
// short strings, and keeps the badge dependency-free.
const labelWidth = label.length * 6.5 + 12;
const valueWidth = value.length * 6.5 + 12;
const width = labelWidth + valueWidth;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${colour}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelWidth * 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelWidth - 12) * 10}">${label}</text>
    <text x="${labelWidth * 5}" y="140" transform="scale(.1)" textLength="${(labelWidth - 12) * 10}">${label}</text>
    <text aria-hidden="true" x="${(labelWidth + valueWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(valueWidth - 12) * 10}">${value}</text>
    <text x="${(labelWidth + valueWidth / 2) * 10}" y="140" transform="scale(.1)" textLength="${(valueWidth - 12) * 10}">${value}</text>
  </g>
</svg>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, svg, 'utf8');

console.log(`coverage-badge: ${value} statements -> ${path.relative(root, outputPath)}`);

if (pct < THRESHOLD) {
  console.error(`coverage-badge: ${value} is below the ${THRESHOLD}% threshold`);
  process.exitCode = 1;
}
