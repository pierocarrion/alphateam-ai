"use client";

import { useState } from "react";
import type { EmployeeWithMetrics } from "../types";
import { ColleagueCard } from "./ColleagueCard";
import { ColleagueDetailDrawer } from "./ColleagueDetailDrawer";
import { Panel, EmptyState } from "./Panel";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

export function ColleagueList({
  members,
}: {
  members: EmployeeWithMetrics[];
}) {
  const [locale] = useLocale();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Panel
      kicker={t(locale, "insights.colleagues.kicker")}
      title={t(locale, "insights.colleagues.title")}
    >
      {members.length === 0 ? (
        <EmptyState message={t(locale, "insights.colleagues.empty")} />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {members.map((m) => (
            <ColleagueCard
              key={m.id}
              employee={m}
              expanded={selected === m.id}
              onToggle={() =>
                setSelected((prev) => (prev === m.id ? null : m.id))
              }
            />
          ))}
        </div>
      )}
      <ColleagueDetailDrawer
        employeeId={selected}
        onClose={() => setSelected(null)}
      />
    </Panel>
  );
}
