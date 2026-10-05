import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockingFindings } from './audit_frontend.mjs';

const url = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const audit = { vulnerabilities: {
  braces: { severity: 'high', nodes: ['node_modules/braces'], via: [{ url, name: 'braces' }] },
  micromatch: { severity: 'high', nodes: ['node_modules/micromatch'], via: ['braces'] },
} };
const lock = { packages: { 'node_modules/braces': { dev: true }, 'node_modules/micromatch': { dev: true } } };
const exceptions = { [url]: { package: 'braces', expires: '2026-11-04' } };

test('known tooling advisory is accepted only before expiration', () => {
  assert.deepEqual(blockingFindings(audit, lock, exceptions, '2026-10-04'), []);
  assert.deepEqual(blockingFindings(audit, lock, exceptions, '2026-11-05'), ['braces', 'micromatch']);
});
test('the same advisory remains blocking when shipped in production', () => {
  const runtime = structuredClone(lock);
  runtime.packages['node_modules/braces'].dev = false;
  assert.deepEqual(blockingFindings(audit, runtime, exceptions, '2026-10-04'), ['braces', 'micromatch']);
});
test('new advisories and missing lockfile provenance remain blocking', () => {
  const unknown = structuredClone(audit);
  unknown.vulnerabilities.braces.via.push({ url: 'https://github.com/advisories/NEW', name: 'braces' });
  assert.deepEqual(blockingFindings(unknown, lock, exceptions, '2026-10-04'), ['braces', 'micromatch']);
  assert.deepEqual(blockingFindings(audit, { packages: {} }, exceptions, '2026-10-04'), ['braces', 'micromatch']);
});
test('audit errors cannot become a successful result', () => {
  assert.throws(() => blockingFindings({}, lock, exceptions), /valid vulnerability report/);
});
