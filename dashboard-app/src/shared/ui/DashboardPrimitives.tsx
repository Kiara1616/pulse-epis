import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-intro mt-2 max-w-3xl">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="section-title">{title}</h2>
        {description && <p className="page-intro mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SurfaceCard({
  children,
  className = "",
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return <section aria-labelledby={labelledBy} className={`surface-card ${className}`}>{children}</section>;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
}) {
  return (
    <article aria-label={`${label}: ${value}`} className="surface-card min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {Icon && <Icon aria-hidden="true" size={20} className="shrink-0 text-slate-500" />}
      </div>
      <p className="metric-value mt-2 break-words">{value}</p>
      {description && <p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>}
    </article>
  );
}

export function ContextNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <aside role="note" className={`context-note px-4 py-3 ${className}`}>{children}</aside>;
}
