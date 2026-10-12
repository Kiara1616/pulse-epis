import { apiFetch } from "../api/client";
import type { AnalyticsOverview, Certification } from "../api/types";
import type {
  DataResult,
  ValidationQueueItem,
  PrototypeData,
  StudentSummary,
  ValidationCard,
  AdminIndicators,
} from "./types";
import { studentSummary, validationCards, adminIndicators } from "./adapters";
import {
  certificationFixtures,
  validationFixtures,
  analyticsFixture,
  prototypeFixtures,
  fixtureAsOf,
} from "./fixtures";

export type ExistingDataSource = {
  student(asOf: string): Promise<DataResult<StudentSummary>>;
  validator(asOf: string): Promise<DataResult<ValidationCard[]>>;
  admin(query: URLSearchParams): Promise<DataResult<AdminIndicators>>;
};
export function createApiDataSource(): ExistingDataSource {
  return {
    async student(asOf) {
      return {
        source: "API",
        asOf,
        data: studentSummary(
          await apiFetch<Certification[]>("/certifications"),
          asOf,
        ),
      };
    },
    async validator(asOf) {
      return {
        source: "API",
        asOf,
        data: validationCards(
          await apiFetch<ValidationQueueItem[]>("/validations"),
        ),
      };
    },
    async admin(query) {
      const data = adminIndicators(
        await apiFetch<AnalyticsOverview>(
          `/indicators/overview?${query.toString()}`,
        ),
      );
      return { source: "API", asOf: data.cutoff, data };
    },
  };
}
/** Explicit dependency injection for prototypes/tests; never selected by network errors or role controls. */
export function createFixtureDataSource(): ExistingDataSource & {
  prototype(): Promise<DataResult<PrototypeData>>;
} {
  return {
    async student() {
      return {
        source: "SYNTHETIC",
        asOf: fixtureAsOf,
        data: studentSummary(certificationFixtures(), fixtureAsOf),
      };
    },
    async validator() {
      return {
        source: "SYNTHETIC",
        asOf: fixtureAsOf,
        data: validationCards(validationFixtures()),
      };
    },
    async admin() {
      return {
        source: "SYNTHETIC",
        asOf: fixtureAsOf,
        data: adminIndicators(analyticsFixture()),
      };
    },
    async prototype() {
      return {
        source: "SYNTHETIC",
        asOf: fixtureAsOf,
        data: prototypeFixtures(),
      };
    },
  };
}
