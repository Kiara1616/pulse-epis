import { test, expect } from "@playwright/test";
import {
  certificationFixtures,
  prototypeFixtures,
  analyticsFixture,
  validationFixtures,
  fixtureAsOf,
  studentStateFixtures,
} from "../src/shared/contracts/fixtures";
import {
  studentSummary,
  validationCards,
  adminIndicators,
} from "../src/shared/contracts/adapters";
import {
  createApiDataSource,
  createFixtureDataSource,
} from "../src/shared/contracts/sources";
import { ApiError } from "../src/shared/api/client";
import {
  certificationLabels,
  certificationStatuses,
} from "../src/shared/contracts/types";

test("summary covers every API status without counting expired as approved", () => {
  const summary = studentSummary(certificationFixtures(), fixtureAsOf);
  expect(summary).toMatchObject({
    total: 7,
    approved: 1,
    pending: 3,
    observed: 1,
    rejected: 1,
    expired: 1,
    unknown: 0,
  });
  expect(summary.correctionIds).toEqual(["DEMO-credential-3"]);
  expect(
    summary.credentials.find((item) => item.status === "RESUBMITTED")
      ?.canCorrect,
  ).toBe(true);
  for (const status of certificationStatuses)
    expect(certificationLabels[status]).toBeTruthy();
});
test("server correction denial and unknown statuses never grant an action", () => {
  const base = certificationFixtures()[3];
  const data = studentSummary(
    [
      { ...base, correction_allowed: false },
      {
        ...base,
        id: "DEMO-future",
        status: "FUTURE",
        correction_allowed: true,
      },
    ],
    fixtureAsOf,
  );
  expect(data.correctionIds).toEqual([]);
  expect(data.credentials[1]).toMatchObject({
    status: "UNKNOWN",
    rawStatus: "FUTURE",
    canCorrect: false,
  });
  expect(data.unknown).toBe(1);
});
test("expiration remains the server effective status, not inferred from a UI date", () => {
  const item = { ...certificationFixtures()[2], expires_on: "2020-01-01" };
  expect(studentSummary([item], "2026-10-01").approved).toBe(1);
  expect(studentSummary([], "2026-10-01")).toMatchObject({
    total: 0,
    correctionIds: [],
  });
});
test("fixture factories return independent records and cover proposed lifecycle", () => {
  const one = prototypeFixtures();
  one.courses[0].requirements.push("mutation");
  one.routes[0].steps[0].evidenceRecorded = false;
  const two = prototypeFixtures();
  expect(two.courses[0].requirements).not.toContain("mutation");
  expect(two.routes[0].steps[0].evidenceRecorded).toBe(true);
  expect(new Set(two.courses.map((i) => i.status))).toEqual(
    new Set(["DETECTED", "IN_REVIEW", "PUBLISHED", "DISCARDED", "RETIRED"]),
  );
  expect(
    two.opportunities.every((i) =>
      two.courses.some((c) => c.id === i.courseId),
    ),
  ).toBe(true);
  expect(
    two.participations.every((i) =>
      two.workshops.some((w) => w.id === i.workshopId),
    ),
  ).toBe(true);
  expect(
    two.courses.every(
      (i) => new URL(i.sourceUrl).hostname === "example.invalid",
    ),
  ).toBe(true);
});
test("queue adapter preserves review data and input", () => {
  const items = validationFixtures();
  const before = JSON.stringify(items);
  const cards = validationCards(items);
  expect(cards[0]).toMatchObject({
    studentKey: "DEMO-student-key",
    evidenceCount: 0,
    status: "PENDING",
  });
  expect(cards[1].evidenceCount).toBe(1);
  expect(JSON.stringify(items)).toBe(before);
});
test("admin adapter preserves cutoff, dataset and independent counts", () => {
  const api = analyticsFixture();
  const result = adminIndicators(api);
  expect(result).toMatchObject({
    dataset: "demo",
    cutoff: fixtureAsOf,
    kpis: {
      active_students: 10,
      certified_students: 3,
      approved_certifications: 4,
    },
  });
  result.kpis.active_students = 100;
  result.gaps[0].gap_students = 100;
  expect(api.kpis.active_students).toBe(10);
  expect(api.skill_gaps[0].gap_students).toBe(7);
  expect(adminIndicators({ ...api, dataset: undefined }).dataset).toBe(
    "unspecified",
  );
});
test("fixture source identifies synthetic data and never calls fetch", async () => {
  const old = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("No network in fixtures");
  };
  try {
    const source = createFixtureDataSource();
    for (const data of [
      await source.student(fixtureAsOf),
      await source.validator(fixtureAsOf),
      await source.admin(new URLSearchParams()),
      await source.prototype(),
    ])
      expect(data).toMatchObject({ source: "SYNTHETIC", asOf: fixtureAsOf });
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = old;
  }
});
test("API source forwards cookies and reads current existing endpoints", async () => {
  const old = globalThis.fetch;
  const calls: Array<{
    url: string;
    credentials: RequestCredentials | undefined;
  }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, credentials: init?.credentials });
    return new Response(
      JSON.stringify(
        url.includes("/certifications")
          ? certificationFixtures()
          : url.includes("/validations")
            ? validationFixtures()
            : analyticsFixture(),
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const source = createApiDataSource();
    expect((await source.student(fixtureAsOf)).source).toBe("API");
    expect((await source.validator(fixtureAsOf)).data).toHaveLength(4);
    expect(
      (await source.admin(new URLSearchParams({ period_code: "2026-II" })))
        .asOf,
    ).toBe(fixtureAsOf);
    expect(calls.map((c) => c.credentials)).toEqual([
      "include",
      "include",
      "include",
    ]);
    expect(calls[2].url).toContain("period_code=2026-II");
  } finally {
    globalThis.fetch = old;
  }
});
test("API failure remains a failure, with no fixture fallback", async () => {
  const old = globalThis.fetch;
  try {
    for (const status of [401, 403, 503]) {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({ error: { code: "DENIED", message: "Denied" } }),
          { status, headers: { "Content-Type": "application/json" } },
        );
      await expect(
        createApiDataSource().student(fixtureAsOf),
      ).rejects.toBeInstanceOf(ApiError);
    }
  } finally {
    globalThis.fetch = old;
  }
});

test("prototype load scenarios distinguish empty, error and synthetic ready", () => {
  const states = studentStateFixtures();
  expect(states.loading.status).toBe("loading");
  expect(states.error.status).toBe("error");
  expect(states.empty.status).toBe("empty");
  if (states.ready.status !== "ready")
    throw new Error("Expected ready fixture");
  expect(states.ready.result.source).toBe("SYNTHETIC");
});
