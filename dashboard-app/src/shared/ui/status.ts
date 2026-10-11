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
  PENDING: "bg-amber-50 text-amber-700",
  UNDER_REVIEW: "bg-blue-50 text-blue-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  OBSERVED: "bg-orange-50 text-orange-700",
  RESUBMITTED: "bg-violet-50 text-violet-700",
  REJECTED: "bg-rose-50 text-rose-700",
  EXPIRED: "bg-gray-100 text-gray-700",
};
export function statusLabel(status: string) {
  return certificationLabels[status] ?? "Estado no reconocido";
}
export function statusClass(status: string) {
  return certificationClasses[status] ?? "bg-gray-100 text-gray-700";
}
