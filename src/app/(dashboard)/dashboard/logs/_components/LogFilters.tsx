"use client";

import { useFilterBar } from "@/hooks/useFilterBar";
import FilterBar from "@/components/ui/FilterBar";
import { ACTION_META, ENTITY_TYPE_LABELS } from "@/types/audit";
import type { FilterDef } from "@/types/filterBar";

interface Props {
  actors: { id: string; email: string }[];
}

export default function LogFilters({ actors }: Props) {
  const defs: FilterDef[] = [
    {
      type: "select",
      key: "entityType",
      label: "유형",
      placeholder: "전체 유형",
      options: Object.entries(ENTITY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
    },
    {
      type: "select",
      key: "action",
      label: "액션",
      placeholder: "전체 액션",
      options: Object.entries(ACTION_META).map(([v, m]) => ({ value: v, label: m.label })),
    },
    ...(actors.length > 0
      ? [
          {
            type: "select" as const,
            key: "actorId",
            label: "작성자",
            placeholder: "전체 작성자",
            options: actors.map((a) => ({ value: a.id, label: a.email })),
          },
        ]
      : []),
    {
      type: "daterange",
      fromKey: "dateFrom",
      toKey: "dateTo",
      label: "기간",
    },
  ];

  const bar = useFilterBar(defs, { resetOnChange: ["cursor"], pushHistory: true });

  return <FilterBar defs={defs} bar={bar} />;
}
