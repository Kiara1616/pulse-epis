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
  PENDING: "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-blue-50 text-blue-700",
  APPROVED: "bg-blue-100 text-blue-900",
  OBSERVED: "bg-sky-50 text-sky-800",
  RESUBMITTED: "bg-blue-50 text-blue-800",
  REJECTED: "bg-slate-100 text-slate-700",
  EXPIRED: "bg-slate-100 text-slate-600",
};
export function statusLabel(status: string) {
  return certificationLabels[status] ?? "Estado no reconocido";
}
export function statusClass(status: string) {
  return certificationClasses[status] ?? "bg-gray-100 text-gray-700";
}
