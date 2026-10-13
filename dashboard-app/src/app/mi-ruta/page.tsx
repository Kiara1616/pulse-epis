"use client";

import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Cloud,
  Code2,
  Compass,
  Database,
  Info,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { RoleGate } from "@/features/access/RoleGate";
import {
  buildDemoStudentPath,
  pathInterests,
  pathObjectives,
  type PathInterestId,
  type PathObjectiveId,
  type PathStep,
} from "@/features/studentPath/demo";

const interestIcons = {
  cloud: Cloud,
  data: Database,
  software: Code2,
  security: ShieldCheck,
};

function StudentPathContent() {
  const [primaryInterest, setPrimaryInterest] = useState<PathInterestId>("cloud");
  const [additionalInterests, setAdditionalInterests] = useState<PathInterestId[]>([
    "data",
  ]);
  const [objective, setObjective] = useState<PathObjectiveId>("internship");
  const path = buildDemoStudentPath(
    primaryInterest,
    additionalInterests,
    objective,
  );
  const nextStep = path.steps.find((step) => step.state === "NEXT")!;
  const progressPercent = Math.round(
    (path.progress.supported / path.progress.total) * 100,
  );

  function selectPrimaryInterest(nextInterest: PathInterestId) {
    setPrimaryInterest(nextInterest);
    setAdditionalInterests((current) =>
      [primaryInterest, ...current]
        .filter((interest) => interest !== nextInterest)
        .slice(0, 2),
    );
  }

  function toggleAdditionalInterest(interest: PathInterestId) {
    setAdditionalInterests((current) => {
      if (current.includes(interest)) {
        return current.filter((item) => item !== interest);
      }
      if (current.length >= 2) return current;
      return [...current, interest];
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
            Tu desarrollo profesional
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Mi ruta
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Elige las áreas que te interesan y un objetivo. Explora una ruta de
            formación con requisitos y próximos pasos de ejemplo.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800">
          <Sparkles size={15} aria-hidden="true" />
          Prototipo demostrativo
        </span>
      </header>

      <aside
        role="note"
        className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"
      >
        <Info size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" />
        <p className="leading-6">
          Esta vista usa ejemplos sintéticos. El avance y las evidencias que ves
          no provienen de tu perfil ni representan una evaluación de tus
          conocimientos. La información está preparada para conectarse con datos
          reales más adelante.
        </p>
      </aside>

      <section
        aria-labelledby="path-preferences-heading"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <Compass size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="path-preferences-heading" className="font-bold text-slate-950">
              Personaliza el ejemplo de tu ruta
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Puedes elegir un área principal y hasta dos áreas complementarias.
              Los cambios actualizan la vista al instante.
            </p>
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold text-slate-900">
            ¿Qué área te interesa más?
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pathInterests.map((interest) => {
              const Icon = interestIcons[interest.id];
              const checked = primaryInterest === interest.id;
              return (
                <label
                  key={interest.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                    checked
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="primary-interest"
                    value={interest.id}
                    checked={checked}
                    onChange={() => selectPrimaryInterest(interest.id)}
                  />
                  <span
                    className={`rounded-lg p-2 ${
                      checked ? "bg-white text-blue-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {interest.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold text-slate-900">
            ¿Qué otras áreas te gustaría explorar?
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {pathInterests
              .filter((interest) => interest.id !== primaryInterest)
              .map((interest) => {
                const checked = additionalInterests.includes(interest.id);
                const disabled = !checked && additionalInterests.length >= 2;
                return (
                  <label
                    key={interest.id}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                      checked
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 text-slate-700 hover:border-blue-300"
                    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input
                      className="accent-blue-700"
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleAdditionalInterest(interest.id)}
                    />
                    {interest.label}
                  </label>
                );
              })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold text-slate-900">
            ¿Cuál es tu objetivo de ejemplo?
          </legend>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {pathObjectives.map((option) => {
              const checked = objective === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                    checked
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    className="accent-blue-700"
                    type="radio"
                    name="path-objective"
                    value={option.id}
                    checked={checked}
                    onChange={() => setObjective(option.id)}
                  />
                  <span className="text-sm font-semibold text-slate-900">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section
        aria-labelledby="student-path-heading"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="bg-[#102c52] px-5 py-6 text-white sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-200">
                Ruta sugerida · ejemplo
              </p>
              <h2 id="student-path-heading" className="mt-2 text-2xl font-bold">
                {path.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                {path.summary} Objetivo: {path.objective.toLowerCase()}.
              </p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm">
              <span className="block text-xs text-blue-100">Meta de referencia</span>
              <span className="mt-1 block font-semibold">{path.target}</span>
            </div>
          </div>

          <div className="mt-6 max-w-xl">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Avance demostrativo</span>
              <span>
                {path.progress.supported} de {path.progress.total} requisitos con
                evidencia de ejemplo
              </span>
            </div>
            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/20"
              role="progressbar"
              aria-label="Avance demostrativo de la ruta"
              aria-valuemin={0}
              aria-valuemax={path.progress.total}
              aria-valuenow={path.progress.supported}
            >
              <div
                className="h-full rounded-full bg-cyan-300 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-blue-100">
              Áreas consideradas:
            </span>
            {path.focusAreas.map((area) => (
              <span
                key={area}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold"
              >
                {area}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.3fr_0.7fr] sm:p-7">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={19} className="text-blue-700" aria-hidden="true" />
              <h3 className="font-bold text-slate-950">Pasos de la ruta</h3>
            </div>
            <ol id="ruta-pasos" className="mt-4 space-y-3">
              {path.steps.map((step, index) => (
                <PathStepCard key={step.id} step={step} index={index} />
              ))}
            </ol>
          </div>

          <aside className="h-fit rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2 text-amber-900">
              <Target size={19} aria-hidden="true" />
              <h3 className="font-bold">Tu próximo paso</h3>
            </div>
            <p className="mt-3 text-lg font-bold text-slate-950">{nextStep.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {nextStep.detail}
            </p>
            <a
              href="#requisitos-ruta"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
            >
              Revisar requisitos
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <p className="mt-3 text-xs text-slate-600">
              Duración estimada de referencia: {nextStep.duration.toLowerCase()}.
            </p>
          </aside>
        </div>
      </section>

      <section
        id="requisitos-ruta"
        aria-labelledby="requirements-heading"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <CheckCircle2 size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 id="requirements-heading" className="font-bold text-slate-950">
              Requisitos y evidencias
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Referencias de ejemplo para la meta «{path.target}».
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {path.requirements.map((requirement) => (
            <article
              key={requirement.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <h3 className="font-semibold text-slate-900">
                {requirement.title}
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                {requirement.detail}
              </p>
              {requirement.evidenceExample ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {requirement.evidenceExample}
                </p>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  <Info size={14} aria-hidden="true" />
                  Sin evidencia de ejemplo
                </p>
              )}
            </article>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <Lightbulb size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
          <p className="leading-6">
            Una brecha solo señala que no hay una evidencia registrada para ese
            requisito en este perfil de ejemplo. No significa que te falte el
            conocimiento o la habilidad.
          </p>
        </div>
      </section>

      <p className="text-center text-xs text-slate-500">
        Contenido demostrativo con fixtures sintéticos · No se consultan datos personales ni servicios de la API.
      </p>
    </div>
  );
}

function PathStepCard({ step, index }: { step: PathStep; index: number }) {
  const isExampleEvidence = step.state === "DEMO_EVIDENCE";
  const isNext = step.state === "NEXT";
  const Icon = isExampleEvidence ? CheckCircle2 : isNext ? Target : Clock3;
  const stateLabel = isExampleEvidence
    ? "Evidencia de ejemplo"
    : isNext
      ? "Siguiente paso"
      : step.duration;

  return (
    <li
      className={`flex gap-3 rounded-xl border p-4 ${
        isNext
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
          isExampleEvidence
            ? "bg-emerald-100 text-emerald-800"
            : isNext
              ? "bg-blue-700 text-white"
              : "bg-slate-100 text-slate-600"
        }`}
        aria-hidden="true"
      >
        {isExampleEvidence ? <CheckCircle2 size={18} /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-950">{step.title}</h4>
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              isExampleEvidence
                ? "text-emerald-800"
                : isNext
                  ? "text-blue-800"
                  : "text-slate-500"
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            {stateLabel}
          </span>
        </div>
        <p className="mt-1 text-sm leading-5 text-slate-600">{step.detail}</p>
      </div>
    </li>
  );
}

export default function StudentPathPage() {
  return (
    <RoleGate allow={["STUDENT"]}>
      <StudentPathContent />
    </RoleGate>
  );
}
