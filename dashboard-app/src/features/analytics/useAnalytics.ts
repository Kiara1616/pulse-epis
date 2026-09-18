"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/shared/api/client";
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
  const [periods, setPeriods] = useState<AnalyticsPeriod[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>(emptyFilters);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingPeriods(true);
      void apiFetch<AnalyticsPeriod[]>("/indicators/periods")
        .then((availablePeriods) => {
          if (cancelled) return;
          setPeriods(availablePeriods);
          setFilters((current) => ({
            ...current,
            period_code: current.period_code || availablePeriods[0]?.code || "",
          }));
        })
        .catch((loadError) => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los periodos.");
        })
        .finally(() => {
          if (!cancelled) setLoadingPeriods(false);
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [reloadToken]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.period_code) params.set("period_code", filters.period_code);
    if (filters.cutoff_date) params.set("cutoff_date", filters.cutoff_date);
    if (filters.cohort) params.set("cohort", filters.cohort);
    if (filters.cycle) params.set("cycle", filters.cycle);
    if (filters.issuer) params.set("issuer", filters.issuer);
    if (filters.level) params.set("level", filters.level);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    if (!filters.period_code) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingOverview(true);
      setError(null);
      void apiFetch<AnalyticsOverview>(`/indicators/overview?${query}`)
        .then((overview) => {
          if (!cancelled) setData(overview);
        })
        .catch((loadError) => {
          if (!cancelled) {
            setData(null);
            setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el snapshot.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingOverview(false);
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [filters.period_code, query, reloadToken]);

  const setFilter = useCallback(<K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setReloadToken((current) => current + 1);
  }, []);

  return {
    periods,
    filters,
    setFilter,
    data,
    loading: loadingPeriods || loadingOverview,
    error,
    retry,
  };
}
