"use client";

import { useMemo, useState } from "react";
import type { AttractionRow } from "@/types/attraction";
import BranchProgressGrid from "./BranchProgressGrid";
import AttractionTable from "./AttractionTable";

interface Props {
  rows: AttractionRow[];
}

/**
 * 지점별 진행률 히트맵과 입점 브랜드 표 사이의 연결 상태를 보유.
 * - 히트맵 셀 클릭 → 같은 지점의 행만 남도록 표 필터
 * - 카테고리 필터는 히트맵 진행률 계산에도 반영 (그리드/리스트 동기화)
 * - 상태 필터(완료/진행중)는 적용 시 그리드 %가 항상 100/0이라 의미가 깨져
 *   테이블 내부에만 적용
 */
export default function BranchAttractionView({ rows }: Props) {
  const [branch, setBranch] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("전체");
  const [filterStatus, setFilterStatus] = useState<string>("전체");

  const gridRows = useMemo(
    () => (filterCat === "전체" ? rows : rows.filter((r) => r.category === filterCat)),
    [rows, filterCat],
  );

  return (
    <>
      <BranchProgressGrid
        rows={gridRows}
        selectedBranch={branch}
        onSelectBranch={setBranch}
        filterCat={filterCat}
      />
      <AttractionTable
        rows={rows}
        branchFilter={branch}
        onClearBranch={() => setBranch(null)}
        filterCat={filterCat}
        onFilterCat={setFilterCat}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
      />
    </>
  );
}
