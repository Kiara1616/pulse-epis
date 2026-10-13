"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/shared/api/client";
import { useAuth } from "@/features/access/AuthProvider";
import type {
  AnalyticsFilters,
  AnalyticsOverview,
  AnalyticsPeriod,
} from "@/shared/api/types";

const emptyFilters: AnalyticsFilters = {
  period_code: "",
  cutoff_date: "",
  cohort: "",
  cycle: "",
  issuer: "",
  level: "",
};

export function useAnalytics() {
  const { authProvider } = useAuth();
  const [dataset, setDataset] = useState<"registered" | "demo">("registered");
  const [referenceAvailable, setReferenceAvailable] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const initialQueryRead = useRef(false);
  const [periods, setPeriods] = useState<AnalyticsPeriod[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>(emptyFilters);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [options, setOptions] = useState({
    issuers: [] as AnalyticsOverview["by_issuer"],
    levels: [] as AnalyticsOverview["by_level"],
    cohorts: [] as AnalyticsOverview["by_cohort"],
    cycles: [] as AnalyticsOverview["by_cycle"],
  });
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{
      reference_available: boolean;
      default_dataset: "registered" | "demo";
    }>("/indicators/config")
      .then((configuration) => {
        if (cancelled) return;
        setReferenceAvailable(configuration.reference_available);
        const queryDataset = new URLSearchParams(window.location.search).get(
          "dataset",
        );
        const savedDataset = window.sessionStorage.getItem(
          "pulse-analytics-source",
        );
        const validDataset = (value: string | null): value is "registered" | "demo" =>
          value === "registered" ||
          (value === "demo" && configuration.reference_available);
        const selected = [queryDataset, savedDataset].find(validDataset);
        setDataset(selected ?? configuration.default_dataset);
      })
      .catch(() => {
        if (!cancelled) {
          const localReference = authProvider === "local";
          setReferenceAvailable(localReference);
          setDataset(localReference ? "demo" : "registered");
        }
      })
      .finally(() => {
        if (!cancelled) setSourceReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authProvider]);

  useEffect(() => {
    if (!sourceReady) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingPeriods(true);
      void apiFetch<AnalyticsPeriod[]>(
        `/indicators/periods${dataset === "demo" ? "?dataset=demo" : ""}`,
      )
        .then((availablePeriods) => {
          if (cancelled) return;
          setPeriods(availablePeriods);
          const first =
            availablePeriods.find((p) => p.latest_cutoff_date) ??
            availablePeriods[0];
          const linked = initialQueryRead.current
            ? new URLSearchParams()
            : new URLSearchParams(window.location.search);
          initialQueryRead.current = true;
          setFilters((current) => {
            if (current.period_code) return current;
            const period =
              availablePeriods.find(
                (p) => p.code === linked.get("period_code"),
              ) ?? first;
            const selected = {
              ...emptyFilters,
              period_code: period?.code ?? "",
              cutoff_date: period?.latest_cutoff_date ?? "",
            };
            if (period?.code === linked.get("period_code")) {
              for (const key of [
                "cutoff_date",
                "cohort",
                "cycle",
                "issuer",
                "level",
              ] as const) {
                const value = linked.get(key);
                if (value) selected[key] = value;
              }
            }
            return selected;
          });
        })
        .catch((loadError) => {
          if (!cancelled)
            setError(
              loadError instanceof Error
                ? loadError.message
                : "No se pudieron cargar los periodos.",
            );
        })
        .finally(() => {
          if (!cancelled) setLoadingPeriods(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reloadToken, dataset, sourceReady]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (dataset === "demo") params.set("dataset", "demo");
    if (filters.period_code) params.set("period_code", filters.period_code);
    if (filters.cutoff_date) params.set("cutoff_date", filters.cutoff_date);
    if (filters.cohort) params.set("cohort", filters.cohort);
    if (filters.cycle) params.set("cycle", filters.cycle);
    if (filters.issuer) params.set("issuer", filters.issuer);
    if (filters.level) params.set("level", filters.level);
    return params.toString();
  }, [filters, dataset]);

  const optionsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (dataset === "demo") params.set("dataset", "demo");
    if (filters.period_code) params.set("period_code", filters.period_code);
    if (filters.cutoff_date) params.set("cutoff_date", filters.cutoff_date);
    return params.toString();
  }, [dataset, filters.period_code, filters.cutoff_date]);

  useEffect(() => {
    if (!filters.period_code) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingOptions(true);
      setOptionsError(null);
      setOptions({ issuers: [], levels: [], cohorts: [], cycles: [] });
      void apiFetch<AnalyticsOverview>(`/indicators/overview?${optionsQuery}`)
        .then((overview) => {
          if (!cancelled)
            setOptions({
              issuers: overview.by_issuer,
              levels: overview.by_level,
              cohorts: overview.by_cohort,
              cycles: overview.by_cycle,
            });
        })
        .catch((loadError) => {
          if (!cancelled)
            setOptionsError(
              loadError instanceof Error
                ? loadError.message
                : "No se pudieron cargar las opciones de filtros.",
            );
        })
        .finally(() => {
          if (!cancelled) setLoadingOptions(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters.period_code, optionsQuery, reloadToken]);

  useEffect(() => {
    if (!filters.period_code) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingOverview(true);
      setError(null);
      setData(null);
      void apiFetch<AnalyticsOverview>(`/indicators/overview?${query}`)
        .then((overview) => {
          if (!cancelled) {
            setData(overview);
          }
        })
        .catch((loadError) => {
          if (!cancelled) {
            setData(null);
            setError(
              loadError instanceof Error
                ? loadError.message
                : "No se pudieron cargar los indicadores.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingOverview(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    filters.period_code,
    filters.cohort,
    filters.cycle,
    filters.issuer,
    query,
    reloadToken,
  ]);

  const setFilter = useCallback(
    <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
      setFilters((current) =>
        key === "period_code"
          ? {
              ...emptyFilters,
              period_code: String(value),
              cutoff_date:
                periods.find((p) => p.code === value)?.latest_cutoff_date ?? "",
            }
          : { ...current, [key]: value },
      );
    },
    [periods],
  );

  const retry = useCallback(() => {
    setError(null);
    setReloadToken((current) => current + 1);
  }, []);

  return {
    periods,
    options,
    dataset,
    local: authProvider === "local",
    referenceAvailable,
    sourceReady,
    setDataset: (value: "registered" | "demo") => {
      if (value === "demo" && !referenceAvailable) return;
      window.sessionStorage.setItem("pulse-analytics-source", value);
      setData(null);
      setFilters(emptyFilters);
      setDataset(value);
    },
    filters,
    setFilter,
    data,
    loading: !sourceReady || loadingPeriods || loadingOverview || loadingOptions,
    error: error ?? optionsError,
    retry,
  };
}
