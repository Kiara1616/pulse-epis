"use client";
import {
  Award,
  Clock3,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { AnalyticsOverview } from "@/shared/api/types";
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
          title={card.definition}
          aria-label={`${card.label}: ${card.value}. ${card.definition}`}
          className="surface-card p-4"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <card.icon size={20} />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-600">{card.label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            {card.value}
          </p>
        </article>
      ))}
    </section>
  );
}
