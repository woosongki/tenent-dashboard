export interface SelectOption {
  value: string;
  label: string;
}

/** 각 필터 입력란의 형태를 정의하는 판별 유니언 */
export type FilterDef =
  | {
      type: "select";
      key: string;
      label: string;
      placeholder: string;      // 전체 선택 시 표시 문자열
      options: SelectOption[];
    }
  | {
      type: "text";
      key: string;
      label: string;
      placeholder?: string;
      debounceMs?: number;       // 기본 300ms
    }
  | {
      type: "daterange";
      fromKey: string;
      toKey: string;
      label: string;
    };

/** useFilterBar 훅의 반환 타입 */
export interface UseFilterBarReturn {
  /** URL에서 읽은 현재 필터 값 */
  values: Record<string, string>;
  /** 단일 키 업데이트. debounceMs 지정 시 해당 시간 후 URL 반영 */
  set: (key: string, value: string, debounceMs?: number) => void;
  /** 여러 키 일괄 업데이트 */
  setMany: (updates: Record<string, string>) => void;
  /** 모든 필터 초기화 */
  reset: () => void;
  /** 활성 필터 수 (빈 문자열 제외) */
  activeCount: number;
  /** router.push 전환 중 여부 */
  isPending: boolean;
}
