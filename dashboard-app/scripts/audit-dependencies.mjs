import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ALLOWED_ADVISORY = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const EXPECTED_BRACES_VERSION = "3.0.3";
const EXCEPTION_EXPIRES = "2026-11-05";
const npmCommand = "npm";

export function evaluateAudit(
  report,
  lockfile,
  today = new Date().toISOString().slice(0, 10),
) {
  if (!report?.vulnerabilities || typeof report.vulnerabilities !== "object") {
    throw new Error("npm audit no devolvió un informe de vulnerabilidades válido.");
  }

  const vulnerabilities = report.vulnerabilities;
  const advisoryCache = new Map();

  function advisoryUrls(packageName, visiting = new Set()) {
    if (advisoryCache.has(packageName)) return advisoryCache.get(packageName);
    if (visiting.has(packageName)) return new Set();

    const entry = vulnerabilities[packageName];
    if (!entry) return new Set();

    const nextVisiting = new Set(visiting);
    nextVisiting.add(packageName);
    const urls = new Set();

    for (const via of entry.via ?? []) {
      if (via && typeof via === "object" && typeof via.url === "string") {
        urls.add(via.url);
      } else if (typeof via === "string") {
        for (const url of advisoryUrls(via, nextVisiting)) urls.add(url);
      }
    }

    advisoryCache.set(packageName, urls);
    return urls;
  }

  function isDevOnly(entry) {
    const nodes = Array.isArray(entry.nodes) ? entry.nodes : [];
    return (
      nodes.length > 0 &&
      nodes.every((node) => lockfile.packages?.[node]?.dev === true)
    );
  }

  function affectedBracesNodes(packageName, visiting = new Set()) {
    if (visiting.has(packageName)) return new Set();

    const entry = vulnerabilities[packageName];
    if (!entry) return new Set();

    const nextVisiting = new Set(visiting);
    nextVisiting.add(packageName);
    const nodes = new Set();

    if (packageName === "braces" && advisoryUrls(packageName).has(ALLOWED_ADVISORY)) {
      for (const node of entry.nodes ?? []) nodes.add(node);
    }

    for (const via of entry.via ?? []) {
      if (typeof via === "string") {
        if (advisoryUrls(via).has(ALLOWED_ADVISORY)) {
          for (const node of affectedBracesNodes(via, nextVisiting)) nodes.add(node);
        }
      } else if (
        via &&
        typeof via === "object" &&
        via.name === "braces" &&
        via.url === ALLOWED_ADVISORY
      ) {
        for (const node of affectedBracesNodes("braces", nextVisiting)) nodes.add(node);
      }
    }

    return nodes;
  }

  function bracesChainIsDevOnly(packageName) {
    const nodes = affectedBracesNodes(packageName);
    return (
      nodes.size > 0 &&
      [...nodes].every((node) => lockfile.packages?.[node]?.dev === true)
    );
  }

  function bracesVersionsAreExpected(packageName) {
    const nodes = affectedBracesNodes(packageName);
    return (
      nodes.size > 0 &&
      [...nodes].every(
        (node) => lockfile.packages?.[node]?.version === EXPECTED_BRACES_VERSION,
      )
    );
  }

  const allowlisted = [];
  const unapproved = [];

  for (const [packageName, entry] of Object.entries(vulnerabilities)) {
    if (!["high", "critical"].includes(entry.severity)) continue;

    const urls = advisoryUrls(packageName);
    const isTemporaryException =
      entry.severity === "high" &&
      urls.size === 1 &&
      urls.has(ALLOWED_ADVISORY) &&
      isDevOnly(entry) &&
      bracesChainIsDevOnly(packageName) &&
      bracesVersionsAreExpected(packageName) &&
      today <= EXCEPTION_EXPIRES;

    if (isTemporaryException) {
      allowlisted.push(packageName);
    } else {
      unapproved.push({
        packageName,
        severity: entry.severity,
        urls: [...urls],
        nodes: entry.nodes ?? [],
      });
    }
  }

  return { allowlisted, unapproved };
}

function auditDependencies() {
  const audit = spawnSync(npmCommand, ["audit", "--audit-level=high", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (audit.error) {
    console.error(`No se pudo ejecutar npm audit: ${audit.error.message}`);
    process.exit(1);
  }

  const rawReport = (audit.stdout ?? "").trim();
  if (!rawReport) {
    console.error("npm audit no devolvió un informe JSON.");
    if (audit.stderr) console.error(audit.stderr.trim());
    process.exit(audit.status ?? 1);
  }

  let report;
  try {
    report = JSON.parse(rawReport);
  } catch (error) {
    console.error(`No se pudo interpretar la salida de npm audit: ${error.message}`);
    process.exit(1);
  }

  const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const { allowlisted, unapproved } = evaluateAudit(report, lockfile);

  if (unapproved.length > 0 || (audit.status !== 0 && allowlisted.length === 0)) {
    console.error("npm audit encontró vulnerabilidades altas o críticas no aprobadas.");
    for (const item of unapproved) {
      console.error(`- ${item.packageName} (${item.severity})`);
      if (item.urls.length > 0) console.error(`  advisories: ${item.urls.join(", ")}`);
      if (item.nodes.length > 0) console.error(`  nodes: ${item.nodes.join(", ")}`);
    }
    if (audit.stderr) console.error(audit.stderr.trim());
    process.exit(1);
  }

  if (allowlisted.length > 0) {
    console.warn(
      `npm audit: se mantiene una excepción temporal y explícita para ${ALLOWED_ADVISORY}.`,
    );
    console.warn(
      `Afecta únicamente dependencias de desarrollo y braces@${EXPECTED_BRACES_VERSION}; ` +
        `debe eliminarse antes del ${EXCEPTION_EXPIRES} o cuando upstream publique una versión corregida.`,
    );
  } else {
    console.log("npm audit: sin vulnerabilidades altas o críticas.");
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  auditDependencies();
}
