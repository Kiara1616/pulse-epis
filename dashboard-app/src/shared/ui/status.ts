export const certificationLabels: Record<string, string> = {
  PENDING: "Pendiente",
  UNDER_REVIEW: "En revisión",
  APPROVED: "Aprobada",
  OBSERVED: "Observada",
  RESUBMITTED: "Reenviada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
};
export const certificationClasses: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-100",
  UNDER_REVIEW: "bg-blue-100/70 text-blue-800 ring-1 ring-inset ring-blue-200",
  APPROVED: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-100",
  OBSERVED: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  RESUBMITTED: "bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-100",
  REJECTED: "bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300",
  EXPIRED: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};
export function statusLabel(status: string) {
  return certificationLabels[status] ?? "Estado no reconocido";
}
export function statusClass(status: string) {
  return certificationClasses[status] ?? "bg-gray-100 text-gray-700";
}
