"use client";

import Image from "next/image";
import { useState } from "react";

type ProviderLogoProps = {
  provider: string;
  size?: "sm" | "md";
};

const providerSlugs: Array<{ match: string[]; slug: string }> = [
  { match: ["aws", "amazon"], slug: "amazonaws" },
  { match: ["cisco"], slug: "cisco" },
  { match: ["datacamp"], slug: "datacamp" },
  { match: ["github"], slug: "github" },
  { match: ["google cloud", "googlecloud"], slug: "googlecloud" },
  { match: ["grafana"], slug: "grafana" },
  { match: ["liquibase"], slug: "liquibase" },
  { match: ["microsoft", "azure"], slug: "microsoftazure" },
  { match: ["mongodb"], slug: "mongodb" },
  { match: ["neo4j"], slug: "neo4j" },
  { match: ["oracle"], slug: "oracle" },
  { match: ["redis"], slug: "redis" },
  { match: ["snowflake"], slug: "snowflake" },
];

function normalized(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function initials(provider: string) {
  const words = provider.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map((word) => word[0]) : [words[0]?.[0] ?? "?"])
    .join("")
    .toUpperCase();
}

function logoSlug(provider: string) {
  const value = normalized(provider);
  return providerSlugs.find(({ match }) => match.some((term) => value.includes(term)))?.slug ?? null;
}

export function ProviderLogo({ provider, size = "md" }: ProviderLogoProps) {
  const [failed, setFailed] = useState(false);
  const slug = logoSlug(provider);
  const dimension = size === "sm" ? 32 : 42;
  const source = slug ? `https://cdn.simpleicons.org/${slug}/1f5edb` : null;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-semibold text-blue-700 ${size === "sm" ? "h-8 w-8" : "h-11 w-11"}`}
      aria-label={`${provider} logo`}
    >
      {source && !failed ? (
        <Image
          src={source}
          alt=""
          width={dimension}
          height={dimension}
          unoptimized
          onError={() => setFailed(true)}
          className={size === "sm" ? "h-5 w-5" : "h-6 w-6"}
        />
      ) : (
        initials(provider)
      )}
    </span>
  );
}
