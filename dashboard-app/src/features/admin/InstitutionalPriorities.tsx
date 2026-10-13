"use client";
import Link from "next/link";
import {
  Award,
  Clock3,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { AnalyticsOverview } from "@/shared/api/types";
import { indicatorLink, rankedGaps } from "./priorities";
export function IndicatorCards({ data }: { data: AnalyticsOverview }) {
  const cards = [
    {
      label: "Estudiantes activos",
      value: data.kpis.active_students,
      icon: UsersRound,
      definition:
        "Estudiantes distintos con matrícula activa en el corte y alcance consultados.",
    },
    {
      label: "Estudiantes certificados",
      value: data.kpis.certified_students,
      icon: ShieldCheck,
      definition:
        "Estudiantes activos con al menos una certificación aprobada y vigente al corte.",
    },
    {
      label: "Cobertura",
      value: `${data.kpis.coverage_percent}%`,
      icon: TrendingUp,
      definition:
        "Estudiantes certificados / estudiantes activos × 100. Sin activos, la API devuelve 0%.",
    },
    {
      label: "Certificaciones aprobadas",
      value: data.kpis.approved_certifications,
      icon: Award,
      definition:
        "Credenciales distintas aprobadas y vigentes; varias habilidades no duplican una credencial.",
    },
    {
      label: "Próximas a vencer",
      value: data.kpis.expiring_soon,
      icon: Clock3,
      definition:
        "Credenciales aprobadas que vencen entre el corte y los siguientes 90 días.",
    },
  ];
  return (
    <section
      aria-label="Indicadores institucionales"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600">
            <card.icon size={20} />
          </div>
          <p className="mt-5 text-sm text-slate-500">{card.label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {card.value}
          </p>
          <p className="mt-3 text-xs text-slate-500">{card.definition}</p>
          <details className="mt-3 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold">
              Fuente y corte
            </summary>
            <p className="mt-2">
              {data.dataset === "demo"
                ? "Datos de referencia · indicadores agregados"
                : data.dataset === "registered"
                  ? "Datos registrados"
                  : "Fuente no especificada"}{" "}
              · {data.filters.period_code} · {data.filters.cutoff_date}
            </p>
            <p className="mt-1 break-words">GET /api/v1/indicators/overview</p>
          </details>
        </article>
      ))}
    </section>
  );
}
export function InstitutionalPriorities({ data }: { data: AnalyticsOverview }) {
  const gaps = rankedGaps(data);
  return (
    <section
      aria-label="Prioridades institucionales"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-bold text-slate-900">
        Prioridades del corte
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Periodo {data.filters.period_code} · corte {data.filters.cutoff_date}.
        Los enlaces conservan los filtros disponibles.
      </p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-950">
            Cobertura de evidencia
          </h3>
          <p className="mt-2 text-sm text-blue-900">
            {data.kpis.active_students === 0
              ? "No hay estudiantes activos en este alcance. Revisa filtros y padrón antes de interpretar la cobertura."
              : `${data.kpis.active_students - data.kpis.certified_students} de ${data.kpis.active_students} estudiantes activos no tienen certificación aprobada vigente registrada.`}
          </p>
          <p className="mt-2 text-xs text-blue-800">
            La ausencia de evidencia no demuestra falta de conocimientos ni
            rezago académico.
          </p>
          <Link
            href={
              data.kpis.active_students
                ? indicatorLink("/brechas", data)
                : "/admin/estudiantes"
            }
            className="mt-3 inline-block text-sm font-bold text-blue-700"
          >
            {data.kpis.active_students
              ? "Analizar cobertura por habilidad"
              : "Revisar padrón"}{" "}
            →
          </Link>
        </article>
        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">
            Vigencia de credenciales
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {data.kpis.expiring_soon
              ? `${data.kpis.expiring_soon} credenciales vencerán en los próximos 90 días desde el corte. Revisa las tecnologías afectadas y consulta las fichas autorizadas.`
              : "No hay credenciales próximas a vencer en este alcance del corte."}
          </p>
          <Link
            href={indicatorLink("/tecnologias", data)}
            className="mt-3 inline-block text-sm font-bold text-blue-700"
          >
            Consultar tecnologías →
          </Link>
          <Link
            href="/estudiantes"
            className="ml-4 mt-3 inline-block text-sm font-bold text-blue-700"
          >
            Consultar fichas →
          </Link>
        </article>
      </div>
      <h3 className="mt-6 font-semibold text-slate-900">
        Habilidades con menor cobertura registrada
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Ordenadas por cobertura ascendente; se muestran hasta tres. No es un
        ranking de demanda laboral.
      </p>
      {gaps.length ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {gaps.map((gap) => (
            <li
              key={gap.skill}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-semibold text-slate-800">{gap.skill}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Cobertura {gap.coverage_percent}% · {gap.gap_students}{" "}
                  estudiantes sin evidencia aprobada asociada
                </p>
              </div>
              <Link
                href={indicatorLink("/brechas", data)}
                className="text-sm font-semibold text-blue-600"
              >
                Consultar brechas →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No hay brechas por habilidad reportadas con estudiantes sin evidencia.
          Esto no acredita dominio completo.
        </p>
      )}
    </section>
  );
}
