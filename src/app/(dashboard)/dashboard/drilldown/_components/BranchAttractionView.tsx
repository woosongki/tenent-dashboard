"use client";

import { useState } from "react";
import type { AttractionRow } from "@/types/attraction";
import BranchProgressGrid from "./BranchProgressGrid";
import AttractionTable from "./AttractionTable";

interface Props {
  rows: AttractionRow[];
}

/**
 * 지점별 진행률 히트맵과 입점 브랜드 표 사이의 연결 상태를 보유.
 * - 히트맵 셀 클릭 → 같은 지점의 행만 남도록 표 필터
 * - 같은 지점을 다시 누르거나 표 안 칩의 X를 누르면 해제
 */
export default function BranchAttractionView({ rows }: Props) {
  const [branch, setBranch] = useState<string | null>(null);

  return (
    <>
      <BranchProgressGrid
        rows={rows}
        selectedBranch={branch}
        onSelectBranch={setBranch}
      />
      <AttractionTable
        rows={rows}
        branchFilter={branch}
        onClearBranch={() => setBranch(null)}
      />
    </>
  );
}
