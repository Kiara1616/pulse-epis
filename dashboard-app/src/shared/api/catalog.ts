import { apiFetch } from "./client";

export type CatalogIssuer = { id: string; name: string; website_url: string | null; active: boolean; aliases: string[] };
export type CatalogSkill = { id: string; name: string; category: string | null; active: boolean };
export type CatalogCredential = { id: string; issuer_id: string; name: string; active: boolean; skill_ids: string[] };
export type CatalogProposal = { id: string; kind: "ISSUER" | "CREDENTIAL" | "SKILL"; proposed_name: string; issuer_id: string | null; student_id: string; status: "PENDING" | "RESOLVED" | "REJECTED"; resolved_id: string | null; reason: string | null; created_at: string };
export type CatalogDraft = { id: string; form_data: { issuer_id: string | null; catalog_credential_id: string | null; skill_ids: string[]; issued_on: string; expires_on: string | null; source_url: string | null }; proposals: Array<{ id: string; kind: CatalogProposal["kind"]; name: string; status: CatalogProposal["status"]; resolved_id: string | null; reason: string | null }>; evidence_filename: string | null; submitted_certification_id: string | null; created_at: string };

export const catalogApi = {
  issuers: () => apiFetch<CatalogIssuer[]>("/catalog/issuers"),
  credentials: (issuerId?: string) => apiFetch<CatalogCredential[]>(`/catalog/credentials${issuerId ? `?issuer_id=${encodeURIComponent(issuerId)}` : ""}`),
  skills: () => apiFetch<CatalogSkill[]>("/catalog/skills"),
  proposals: () => apiFetch<CatalogProposal[]>("/catalog/proposals"),
  drafts: () => apiFetch<CatalogDraft[]>("/catalog/drafts"),
  createIssuer: (input: { name: string; website_url: string | null; active: boolean }) => apiFetch<CatalogIssuer>("/catalog/issuers", { method: "POST", body: JSON.stringify(input) }),
  updateIssuer: (id: string, input: { name: string; website_url: string | null; active: boolean }) => apiFetch<CatalogIssuer>(`/catalog/issuers/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  addAlias: (id: string, name: string) => apiFetch<CatalogIssuer>(`/catalog/issuers/${id}/aliases`, { method: "POST", body: JSON.stringify({ name }) }),
  createCredential: (input: { issuer_id: string; name: string; skill_ids: string[]; active: boolean }) => apiFetch<CatalogCredential>("/catalog/credentials", { method: "POST", body: JSON.stringify(input) }),
  updateCredential: (id: string, input: { issuer_id: string; name: string; skill_ids: string[]; active: boolean }) => apiFetch<CatalogCredential>(`/catalog/credentials/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  createSkill: (input: { name: string; category: string | null; active: boolean }) => apiFetch<CatalogSkill>("/catalog/skills", { method: "POST", body: JSON.stringify(input) }),
  updateSkill: (id: string, input: { name: string; category: string | null; active: boolean }) => apiFetch<CatalogSkill>(`/catalog/skills/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  propose: (input: { kind: CatalogProposal["kind"]; proposed_name: string; issuer_id: string | null }) => apiFetch<{ id: string }>("/catalog/proposals", { method: "POST", body: JSON.stringify(input) }),
  resolve: (id: string, target_id: string, reason: string) => apiFetch(`/catalog/proposals/${id}/resolve`, { method: "POST", body: JSON.stringify({ target_id, reason }) }),
  reject: (id: string, reason: string) => apiFetch(`/catalog/proposals/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  createDraft: (input: CatalogDraft["form_data"] & { proposal_ids: string[] }) => apiFetch<CatalogDraft>("/catalog/drafts", { method: "POST", body: JSON.stringify(input) }),
  uploadDraftEvidence: (id: string, file: File) => { const body = new FormData(); body.append("file", file); return apiFetch<CatalogDraft>(`/catalog/drafts/${id}/evidence`, { method: "POST", body }); },
  submitDraft: (id: string, input: { issuer_id: string; catalog_credential_id: string; skill_ids: string[] }) => apiFetch<{ certification_id: string }>(`/catalog/drafts/${id}/submit`, { method: "POST", body: JSON.stringify(input) }),
};
