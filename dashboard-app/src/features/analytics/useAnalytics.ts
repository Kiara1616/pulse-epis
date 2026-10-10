"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/shared/api/client";
import { useAuth } from "@/features/access/AuthProvider";
import type { AnalyticsFilters, AnalyticsOverview, AnalyticsPeriod } from "@/shared/api/types";

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
  const [dataset, setDataset] = useState<"registered" | "demo">(() => {
    if (authProvider !== "local") return "registered";
    if (typeof window !== "undefined" && window.sessionStorage.getItem("pulse-analytics-source") === "registered") return "registered";
    return "demo";
  });
  const [periods, setPeriods] = useState<AnalyticsPeriod[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>(emptyFilters);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [options, setOptions] = useState({issuers: [] as AnalyticsOverview["by_issuer"], levels: [] as AnalyticsOverview["by_level"], cohorts: [] as AnalyticsOverview["by_cohort"], cycles: [] as AnalyticsOverview["by_cycle"]});
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingPeriods(true);
      void apiFetch<AnalyticsPeriod[]>(`/indicators/periods${dataset === "demo" ? "?dataset=demo" : ""}`)
        .then((availablePeriods) => {
          if (cancelled) return;
          setPeriods(availablePeriods);
          const first = availablePeriods.find((p) => p.latest_cutoff_date) ?? availablePeriods[0];
          setFilters((current) => current.period_code ? current : ({...emptyFilters, period_code: first?.code ?? "", cutoff_date: first?.latest_cutoff_date ?? ""}));
        })
        .catch((loadError) => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los periodos.");
        })
        .finally(() => {
          if (!cancelled) setLoadingPeriods(false);
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [reloadToken, dataset]);

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
            if (!filters.issuer && !filters.cohort && !filters.cycle) setOptions({issuers: overview.by_issuer, levels: [], cohorts: overview.by_cohort, cycles: overview.by_cycle});
          }
        })
        .catch((loadError) => {
          if (!cancelled) {
            setData(null);
            setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los indicadores.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingOverview(false);
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [filters.period_code, filters.cohort, filters.cycle, filters.issuer, query, reloadToken]);

  const setFilter = useCallback(<K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
    setFilters((current) => key === "period_code" ? {...emptyFilters, period_code: String(value), cutoff_date: periods.find((p) => p.code === value)?.latest_cutoff_date ?? ""} : { ...current, [key]: value });
  }, [periods]);

  const retry = useCallback(() => {
    setError(null);
    setReloadToken((current) => current + 1);
  }, []);

  return {
    periods,
    options,
    dataset,
    local: authProvider === "local",
    setDataset: (value: "registered" | "demo") => { window.sessionStorage.setItem("pulse-analytics-source", value); setData(null); setFilters(emptyFilters); setDataset(value); },
    filters,
    setFilter,
    data,
    loading: loadingPeriods || loadingOverview,
    error,
    retry,
  };
}
