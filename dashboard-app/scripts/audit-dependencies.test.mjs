import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateAudit } from "./audit-dependencies.mjs";

const advisoryUrl = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const rootBraces = "node_modules/braces";
const nestedBraces = "node_modules/other/node_modules/braces";

const audit = {
  vulnerabilities: {
    braces: {
      severity: "high",
      nodes: [rootBraces, nestedBraces],
      via: [{ url: advisoryUrl, name: "braces" }],
    },
    micromatch: {
      severity: "high",
      nodes: ["node_modules/micromatch"],
      via: ["braces"],
    },
  },
};

const lockfile = {
  packages: {
    [rootBraces]: { dev: true, version: "3.0.3" },
    [nestedBraces]: { dev: true, version: "3.0.3" },
    "node_modules/micromatch": { dev: true, version: "4.0.8" },
  },
};

test("the authorized development-only chain remains allowed", () => {
  const result = evaluateAudit(audit, lockfile, "2026-10-04");
  assert.deepEqual(result.unapproved, []);
  assert.deepEqual(result.allowlisted, ["braces", "micromatch"]);
});

test("a nested braces copy with another version is blocked", () => {
  const changed = structuredClone(lockfile);
  changed.packages[nestedBraces].version = "3.0.2";
  const result = evaluateAudit(audit, changed, "2026-10-04");
  assert.deepEqual(
    result.unapproved.map(({ packageName }) => packageName),
    ["braces", "micromatch"],
  );
});

test("the same advisory remains blocking when shipped in production", () => {
  const runtime = structuredClone(lockfile);
  runtime.packages[rootBraces].dev = false;
  const result = evaluateAudit(audit, runtime, "2026-10-04");
  assert.deepEqual(
    result.unapproved.map(({ packageName }) => packageName),
    ["braces", "micromatch"],
  );
});

test("new advisories and missing lockfile provenance remain blocking", () => {
  const unknown = structuredClone(audit);
  unknown.vulnerabilities.braces.via.push({
    url: "https://github.com/advisories/NEW",
    name: "braces",
  });
  assert.deepEqual(
    evaluateAudit(unknown, lockfile, "2026-10-04").unapproved.map(
      ({ packageName }) => packageName,
    ),
    ["braces", "micromatch"],
  );
  assert.deepEqual(
    evaluateAudit(audit, { packages: {} }, "2026-10-04").unapproved.map(
      ({ packageName }) => packageName,
    ),
    ["braces", "micromatch"],
  );
});

test("expiration, critical severity, and invalid reports remain blocking", () => {
  assert.deepEqual(
    evaluateAudit(audit, lockfile, "2026-11-06").unapproved.map(
      ({ packageName }) => packageName,
    ),
    ["braces", "micromatch"],
  );
  const critical = structuredClone(audit);
  critical.vulnerabilities.braces.severity = "critical";
  assert.deepEqual(
    evaluateAudit(critical, lockfile, "2026-10-04").unapproved.map(
      ({ packageName }) => packageName,
    ),
    ["braces"],
  );
  assert.throws(
    () => evaluateAudit({}, lockfile),
    /informe de vulnerabilidades válido/,
  );
});

test("known development-only glob advisories are temporary and explicit", () => {
  const report = {
    vulnerabilities: {
      picomatch: {
        severity: "high",
        nodes: ["node_modules/picomatch"],
        via: [{
          url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
          name: "picomatch",
        }],
      },
    },
  };
  const lockfile = {
    packages: {
      "node_modules/picomatch": { dev: true, version: "4.0.7" },
    },
  };

  assert.deepEqual(
    evaluateAudit(report, lockfile, "2026-11-17"),
    { allowlisted: ["picomatch"], unapproved: [] },
  );
  assert.deepEqual(
    evaluateAudit(report, { packages: { "node_modules/picomatch": { dev: false, version: "4.0.7" } } }, "2026-11-17").unapproved.map(
      ({ packageName }) => packageName,
    ),
    ["picomatch"],
  );
  assert.deepEqual(
    evaluateAudit(report, lockfile, "2027-01-01").unapproved.map(
      ({ packageName }) => packageName,
    ),
    ["picomatch"],
  );
});
