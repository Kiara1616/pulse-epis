"use client";

import { useState } from "react";
import { Award, UsersRound, Building2, TrendingUp, CalendarDays, Download, ArrowUpRight, GraduationCap } from "lucide-react";
import mockData from "@/shared/api/mock-data.json";
import { InteractiveProviderChart } from "./InteractiveProviderChart";
import { CertificationsChart } from "./CertificationsChart";

export default function Home() {
  const [period, setPeriod] = useState(mockData.availablePeriods[0]);

  // Find population stats for the selected period if available
  const popStat = mockData.populationStats.studentsBySemester.find(s => s.semester === period);
  const enrolledStudents = popStat ? popStat.enrolled : "N/D";
  
  // Total graduates in the last registered year (mock logic for the dashboard)
  const lastGraduates = mockData.populationStats.graduatesByYear[mockData.populationStats.graduatesByYear.length - 1];

  const stats = [
    { label: "Certificaciones registradas", value: mockData.kpis.totalCertifications.value, detail: `${mockData.kpis.totalCertifications.trend} vs. periodo anterior`, icon: Award },
    { label: "Estudiantes certificados", value: `${mockData.kpis.certifiedStudentsRatio.value}%`, detail: `${mockData.kpis.certifiedStudentsRatio.trend} de crecimiento`, icon: UsersRound },
    { label: "Proveedor principal", value: mockData.kpis.topVendor.value, detail: mockData.kpis.topVendor.trend, icon: Building2 },
  ];

  return <div className="space-y-6">
    <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-blue-600">Periodo académico {period}</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 mt-1">Panorama de certificaciones</h2>
        <p className="text-slate-500 mt-2 max-w-2xl">Seguimiento institucional de credenciales, proveedores y evolución del talento tecnológico EPIS.</p>
      </div>
      <div className="flex gap-2">
        <div className="relative">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 outline-none cursor-pointer"
          >
            {mockData.availablePeriods.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <CalendarDays size={16} className="absolute right-4 top-3 text-slate-400 pointer-events-none"/>
        </div>
        <button className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20">
          <Download size={16}/>Exportar
        </button>
      </div>
    </section>

    {/* KPIs de Certificaciones */}
    <section className="grid md:grid-cols-3 gap-4">
      {stats.map((stat,index)=>
        <article key={stat.label} className={`rounded-2xl p-5 border ${index===0?"bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-700/15":"bg-white border-slate-200 text-slate-950"}`}>
          <div className="flex items-start justify-between">
            <div className={`h-10 w-10 rounded-xl grid place-items-center ${index===0?"bg-white/15":"bg-blue-50 text-blue-600"}`}><stat.icon size={20}/></div>
            <ArrowUpRight size={18} className={index===0?"text-blue-100":"text-slate-400"}/>
          </div>
          <p className={`text-sm mt-6 ${index===0?"text-blue-100":"text-slate-500"}`}>{stat.label}</p>
          <p className="text-3xl font-bold tracking-tight mt-1">{stat.value}</p>
          <p className={`text-xs mt-2 ${index===0?"text-blue-100":"text-emerald-600"}`}>{stat.detail}</p>
        </article>
      )}
    </section>

    {/* KPIs Poblacionales (Datos Extraídos) */}
    <section className="grid md:grid-cols-2 gap-4">
      <article className="rounded-2xl p-5 border bg-white border-slate-200 text-slate-950 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 grid place-items-center">
          <UsersRound size={24}/>
        </div>
        <div>
          <p className="text-sm text-slate-500">Población estudiantil ({period})</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold tracking-tight">{enrolledStudents}</p>
            <span className="text-xs text-slate-400">matriculados</span>
          </div>
        </div>
      </article>
      <article className="rounded-2xl p-5 border bg-white border-slate-200 text-slate-950 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center">
          <GraduationCap size={24}/>
        </div>
        <div>
          <p className="text-sm text-slate-500">Graduados ({lastGraduates.year})</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold tracking-tight">{lastGraduates.graduates}</p>
            <span className="text-xs text-slate-400">estudiantes</span>
          </div>
        </div>
      </article>
    </section>

    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-slate-950">Evolución semestral</h3>
          <p className="text-sm text-slate-500 mt-1">Credenciales acumuladas por periodo</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full"><TrendingUp size={14}/>+24% interanual</span>
      </div>
      <div className="h-[320px]">
        <CertificationsChart data={mockData.certificationsEvolution}/>
      </div>
    </section>

    <InteractiveProviderChart />
  </div>;
}
