"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RoleGate } from "@/features/access/RoleGate";
import { PageHeader, SectionHeading, SurfaceCard } from "@/shared/ui/DashboardPrimitives";
import { catalogApi, type CatalogCredential, type CatalogIssuer, type CatalogProposal, type CatalogSkill } from "@/shared/api/catalog";

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm";

function CatalogContent() {
  const [issuers, setIssuers] = useState<CatalogIssuer[]>([]);
  const [credentials, setCredentials] = useState<CatalogCredential[]>([]);
  const [skills, setSkills] = useState<CatalogSkill[]>([]);
  const [proposals, setProposals] = useState<CatalogProposal[]>([]);
  const [issuerName, setIssuerName] = useState("");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [issuerId, setIssuerId] = useState<string | null>(null);
  const [credentialName, setCredentialName] = useState("");
  const [credentialIssuerId, setCredentialIssuerId] = useState("");
  const [credentialSkillIds, setCredentialSkillIds] = useState<string[]>([]);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextIssuers, nextCredentials, nextSkills, nextProposals] = await Promise.all([
      catalogApi.issuers(), catalogApi.credentials(), catalogApi.skills(), catalogApi.proposals(),
    ]);
    setIssuers(nextIssuers); setCredentials(nextCredentials); setSkills(nextSkills); setProposals(nextProposals);
  }, []);
  useEffect(() => { void Promise.resolve().then(load).catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo abrir el catálogo.")); }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); await load(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el cambio."); }
    finally { setBusy(false); }
  }

  function saveIssuer(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const input = { name: issuerName.trim(), website_url: issuerUrl.trim() || null, active: true };
      if (issuerId) await catalogApi.updateIssuer(issuerId, input);
      else await catalogApi.createIssuer(input);
      setIssuerName(""); setIssuerUrl(""); setIssuerId(null);
    }, "Entidad guardada.");
  }

  function saveCredential(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const input = { issuer_id: credentialIssuerId, name: credentialName.trim(), skill_ids: credentialSkillIds, active: true };
      if (credentialId) await catalogApi.updateCredential(credentialId, input);
      else await catalogApi.createCredential(input);
      setCredentialName(""); setCredentialId(null); setCredentialSkillIds([]);
    }, "Certificación guardada.");
  }

  function saveSkill(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const input = { name: skillName.trim(), category: null, active: true };
      if (skillId) await catalogApi.updateSkill(skillId, input);
      else await catalogApi.createSkill(input);
      setSkillName(""); setSkillId(null);
    }, "Habilidad guardada.");
  }

  return <div className="space-y-6">
    <PageHeader title="Catálogo de certificaciones" description="Administra las opciones que pueden declarar los estudiantes." />
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="grid gap-5 xl:grid-cols-2">
      <SurfaceCard className="p-5">
        <SectionHeading title="Entidades emisoras" description="Usa el nombre oficial; registra variantes como alias." />
        <form onSubmit={saveIssuer} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="form-label">Nombre oficial<input required maxLength={150} value={issuerName} onChange={(e) => setIssuerName(e.target.value)} className={inputClass} /></label>
          <label className="form-label">Sitio oficial (opcional)<input type="url" value={issuerUrl} onChange={(e) => setIssuerUrl(e.target.value)} className={inputClass} /></label>
          <button disabled={busy} className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{issuerId ? "Actualizar entidad" : "Agregar entidad"}</button>
          {issuerId && <button type="button" onClick={() => { setIssuerId(null); setIssuerName(""); setIssuerUrl(""); }} className="w-fit text-sm text-slate-600">Cancelar edición</button>}
        </form>
        <div className="mt-5 space-y-2">{issuers.map((issuer) => <div key={issuer.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{issuer.name}</strong><p className="text-xs text-slate-500">{issuer.aliases.join(" · ")}</p></div><div className="flex gap-2"><button type="button" onClick={() => { setIssuerId(issuer.id); setIssuerName(issuer.name); setIssuerUrl(issuer.website_url ?? ""); }} className="text-blue-700">Editar</button><button type="button" disabled={busy} onClick={() => void run(() => catalogApi.updateIssuer(issuer.id, { name: issuer.name, website_url: issuer.website_url, active: !issuer.active }), "Estado actualizado.")} className="text-slate-600">{issuer.active ? "Desactivar" : "Activar"}</button></div></div>
          {issuerId === issuer.id && <div className="mt-3 flex gap-2"><input aria-label="Nuevo alias" placeholder="Alias de esta entidad" value={alias} onChange={(e) => setAlias(e.target.value)} className={inputClass} /><button type="button" disabled={!alias.trim() || busy} onClick={() => void run(async () => { await catalogApi.addAlias(issuer.id, alias.trim()); setAlias(""); }, "Alias agregado.")} className="text-sm font-semibold text-blue-700">Agregar alias</button></div>}
        </div>)}</div>
      </SurfaceCard>
      <SurfaceCard className="p-5">
        <SectionHeading title="Habilidades" description="Solo las habilidades del catálogo se incorporan a los indicadores." />
        <form onSubmit={saveSkill} className="mt-4 flex flex-wrap items-end gap-3"><label className="form-label flex-1">Nombre<input required maxLength={150} value={skillName} onChange={(e) => setSkillName(e.target.value)} className={inputClass} /></label><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{skillId ? "Actualizar" : "Agregar"}</button></form>
        <div className="mt-5 flex flex-wrap gap-2">{skills.map((skill) => <button key={skill.id} type="button" onClick={() => { setSkillId(skill.id); setSkillName(skill.name); }} className={`rounded-full border px-3 py-1.5 text-sm ${skill.active ? "border-slate-200 text-slate-700" : "border-slate-200 bg-slate-100 text-slate-400"}`}>{skill.name}</button>)}</div>
        {skillId && <div className="mt-3 flex gap-3 text-sm"><button type="button" disabled={busy} onClick={() => { const selected = skills.find((item) => item.id === skillId); if (selected) void run(() => catalogApi.updateSkill(selected.id, { name: selected.name, category: selected.category, active: !selected.active }), "Estado actualizado."); }} className="text-blue-700">{skills.find((item) => item.id === skillId)?.active ? "Desactivar" : "Activar"}</button><button type="button" onClick={() => { setSkillId(null); setSkillName(""); }} className="text-slate-600">Cancelar edición</button></div>}
      </SurfaceCard>
    </div>
    <SurfaceCard className="p-5">
      <SectionHeading title="Certificaciones por entidad" description="Las habilidades seleccionadas se sugieren al estudiante." />
      <form onSubmit={saveCredential} className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
        <label className="form-label">Entidad<select required value={credentialIssuerId} onChange={(e) => setCredentialIssuerId(e.target.value)} disabled={Boolean(credentialId)} className={inputClass}><option value="">Selecciona...</option>{issuers.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="form-label">Nombre de la certificación<input required value={credentialName} onChange={(e) => setCredentialName(e.target.value)} className={inputClass} /></label>
        <button disabled={busy} className="w-fit rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{credentialId ? "Actualizar" : "Agregar certificación"}</button>
        <fieldset className="md:col-span-3"><legend className="form-label">Habilidades sugeridas</legend><div className="mt-2 flex flex-wrap gap-2">{skills.filter((item) => item.active).map((skill) => <label key={skill.id} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm"><input type="checkbox" checked={credentialSkillIds.includes(skill.id)} onChange={() => setCredentialSkillIds((current) => current.includes(skill.id) ? current.filter((id) => id !== skill.id) : [...current, skill.id])} />{skill.name}</label>)}</div></fieldset>
      </form>
      <div className="mt-5 grid gap-2 md:grid-cols-2">{credentials.map((credential) => <div key={credential.id} className="rounded-lg border border-slate-200 p-3 text-sm"><strong>{credential.name}</strong><p className="text-xs text-slate-500">{issuers.find((item) => item.id === credential.issuer_id)?.name} · {credential.skill_ids.length} habilidades · {credential.active ? "Activa" : "Inactiva"}</p><div className="mt-2 flex gap-3"><button type="button" onClick={() => { setCredentialId(credential.id); setCredentialIssuerId(credential.issuer_id); setCredentialName(credential.name); setCredentialSkillIds(credential.skill_ids); }} className="text-blue-700">Editar</button><button type="button" disabled={busy} onClick={() => void run(() => catalogApi.updateCredential(credential.id, { issuer_id: credential.issuer_id, name: credential.name, skill_ids: credential.skill_ids, active: !credential.active }), "Estado actualizado.")} className="text-slate-600">{credential.active ? "Desactivar" : "Activar"}</button></div></div>)}</div>
    </SurfaceCard>
    <SurfaceCard className="p-5"><SectionHeading title="Solicitudes de estudiantes" description="Vincula cada solicitud con una opción canónica antes de que pase a validación." /><div className="mt-4 space-y-3">{proposals.filter((item) => item.status === "PENDING").map((proposal) => <ProposalRow key={proposal.id} proposal={proposal} issuers={issuers} credentials={credentials} skills={skills} busy={busy} resolve={(targetId) => run(() => catalogApi.resolve(proposal.id, targetId, "Vinculación revisada por administración"), "Solicitud resuelta.")} reject={(reason) => run(() => catalogApi.reject(proposal.id, reason), "Solicitud rechazada.")} />)}{!proposals.some((item) => item.status === "PENDING") && <p className="text-sm text-slate-500">No hay solicitudes pendientes.</p>}</div></SurfaceCard>
  </div>;
}

function ProposalRow({ proposal, issuers, credentials, skills, busy, resolve, reject }: { proposal: CatalogProposal; issuers: CatalogIssuer[]; credentials: CatalogCredential[]; skills: CatalogSkill[]; busy: boolean; resolve: (id: string) => void | Promise<void>; reject: (reason: string) => void | Promise<void> }) {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const options = proposal.kind === "ISSUER" ? issuers.filter((item) => item.active) : proposal.kind === "CREDENTIAL" ? credentials.filter((item) => item.active && item.issuer_id === proposal.issuer_id) : skills.filter((item) => item.active);
  return <div className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><div><p className="text-sm font-semibold text-slate-900">{proposal.proposed_name}</p><p className="text-xs text-slate-500">{proposal.kind === "ISSUER" ? "Entidad" : proposal.kind === "CREDENTIAL" ? "Certificación" : "Habilidad"} · solicitada {new Date(proposal.created_at).toLocaleDateString("es-PE")}</p></div><label className="form-label">Vincular a<select aria-label={`Resolver ${proposal.proposed_name}`} value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}><option value="">Selecciona...</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" disabled={!target || busy} onClick={() => void resolve(target)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Resolver</button><label className="form-label sm:col-span-2">Motivo del rechazo<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica al estudiante por qué no se incorpora" className={inputClass} /></label><button type="button" disabled={reason.trim().length < 3 || busy} onClick={() => void reject(reason.trim())} className="rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50">Rechazar</button></div>;
}

export default function CatalogPage() { return <RoleGate allow={["ADMIN"]}><CatalogContent /></RoleGate>; }
