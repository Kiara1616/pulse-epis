"use client";
import Link from "next/link";
import {
  Award,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { AnalyticsOverview } from "@/shared/api/types";
import { MetricCard, SectionHeading, SurfaceCard } from "@/shared/ui/DashboardPrimitives";
import { indicatorLink, rankedGaps } from "./priorities";

export function IndicatorCards({ data }: { data: AnalyticsOverview }) {
  const cards = [
    {
      label: "Estudiantes activos",
      value: data.kpis.active_students,
      icon: UsersRound,
      definition:
        "Matrícula activa en el periodo y alcance consultados.",
    },
    {
      label: "Estudiantes certificados",
      value: data.kpis.certified_students,
      icon: ShieldCheck,
      definition:
        "Estudiantes con una credencial aprobada y vigente.",
    },
    {
      label: "Cobertura",
      value: `${data.kpis.coverage_percent}%`,
      icon: TrendingUp,
      definition:
        "Proporción de estudiantes activos con certificación vigente.",
    },
    {
      label: "Certificaciones aprobadas",
      value: data.kpis.approved_certifications,
      icon: Award,
      definition:
        "Credenciales distintas aprobadas y vigentes en la fecha seleccionada.",
    },
  ];
  return (
    <section
      aria-label="Indicadores institucionales"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => <MetricCard key={card.label} label={card.label} value={card.value} icon={card.icon} description={card.definition} />)}
    </section>
  );
}
export function InstitutionalPriorities({ data }: { data: AnalyticsOverview }) {
  const gaps = rankedGaps(data);
  const studentsWithoutCredential = Math.max(
    0,
    data.kpis.active_students - data.kpis.certified_students,
  );
  return (
    <SurfaceCard className="p-5 sm:p-6" labelledBy="institutional-priorities-heading">
      <SectionHeading id="institutional-priorities-heading" title="Señales para el seguimiento" />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="card-title">Cobertura de certificaciones</h3>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">
            {data.kpis.active_students === 0
              ? "Sin matrícula activa"
              : `${studentsWithoutCredential} de ${data.kpis.active_students}`}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {data.kpis.active_students === 0
              ? "Revisa los filtros y el padrón."
              : "estudiantes sin certificación aprobada y vigente registrada"}
          </p>
          <Link
            href={
              data.kpis.active_students
                ? indicatorLink("/brechas", data)
                : "/admin/estudiantes"
            }
            className="mt-3 inline-block text-sm font-semibold text-blue-700"
          >
            {data.kpis.active_students
              ? "Analizar habilidades"
              : "Revisar padrón"}{" "}
            →
          </Link>
        </article>
        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="card-title">Credenciales próximas a vencer</h3>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">
            {data.kpis.expiring_soon}
          </p>
          <p className="mt-1 text-sm text-slate-600">en los próximos 90 días desde la fecha de los datos</p>
          <Link
            href={indicatorLink("/tecnologias", data)}
            className="mt-3 inline-block text-sm font-semibold text-blue-700"
          >
            Ver tecnologías →
          </Link>
          <Link
            href="/estudiantes"
            className="ml-4 mt-3 inline-block text-sm font-semibold text-blue-700"
          >
            Ver fichas →
          </Link>
        </article>
      </div>
      <h3 className="card-title mt-6">Habilidades con menor cobertura</h3>
      {gaps.length ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {gaps.map((gap) => (
            <li
              key={gap.skill}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-semibold text-slate-800">{gap.skill}</p>
                <p className="mt-1 text-sm tabular-nums text-slate-500">
                  {gap.coverage_percent}% de cobertura · {gap.gap_students}{" "}
                  estudiantes sin evidencia aprobada
                </p>
              </div>
              <Link
                href={indicatorLink("/brechas", data)}
                className="text-sm font-semibold text-blue-600"
              >
                Ver brecha →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No hay habilidades con brechas registradas para estos filtros.
        </p>
      )}
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        La cobertura refleja certificaciones registradas; no mide conocimientos ni demanda laboral.
      </p>
    </SurfaceCard>
  );
}
