/** Audit all dependencies; narrowly permit documented, expiring tooling advisories. */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function blockingFindings(audit, lock, exceptions, today = new Date().toISOString().slice(0, 10)) {
  if (!audit.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
    throw new Error('npm did not return a valid vulnerability report');
  }
  const findings = [];
  function allowed(name, visited = new Set()) {
    if (visited.has(name)) return false;
    const vulnerability = audit.vulnerabilities[name];
    if (!vulnerability || !vulnerability.nodes?.length || !vulnerability.via?.length) return false;
    if (vulnerability.nodes.some(node => lock.packages?.[node]?.dev !== true)) return false;
    const next = new Set([...visited, name]);
    return vulnerability.via.every(via => {
      if (typeof via === 'string') return allowed(via, next);
      const exception = exceptions[via.url];
      return exception?.package === via.name && today <= exception.expires;
    });
  }
  for (const [name, vulnerability] of Object.entries(audit.vulnerabilities)) {
    if (['high', 'critical'].includes(vulnerability.severity) && !allowed(name)) findings.push(name);
  }
  return findings;
}

function auditDependencies() {
  const cwd = fileURLToPath(new URL('../dashboard-app', import.meta.url));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const report = spawnSync(npm, ['audit', '--json'], { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  if (report.error) throw report.error;
  const audit = JSON.parse(report.stdout);
  if (audit.error) throw new Error(audit.error.summary || 'npm audit failed');
  const lock = JSON.parse(readFileSync(new URL('../dashboard-app/package-lock.json', import.meta.url), 'utf8'));
  const exceptions = JSON.parse(readFileSync(new URL('../security/npm-audit-exceptions.json', import.meta.url), 'utf8'));
  const blocking = blockingFindings(audit, lock, exceptions);
  if (blocking.length) throw new Error(`Blocking high/critical vulnerabilities: ${blocking.join(', ')}`);
  const accepted = Object.entries(audit.vulnerabilities).filter(([, v]) => ['high', 'critical'].includes(v.severity)).map(([name]) => name);
  console.log('No blocking high/critical vulnerabilities.');
  if (accepted.length) console.log(`Temporary development-only exception: ${accepted.join(', ')}. See security/npm-audit-exceptions.json; expires 2026-11-04.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { auditDependencies(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
