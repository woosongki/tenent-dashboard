// 가드: 자동 생성된 점포 수(retail-layer-counts.ts)가 실제 체인 데이터와 일치하는지 검증.
// 체인 데이터를 갱신하고 `node scripts/gen-retail-layers.mjs` 재생성을 깜빡하면 여기서 실패한다.
// (이 테스트만 좌표 배열을 import — 사이드바 번들에는 들어가지 않는다.)

import { describe, it, expect } from "vitest";
import { RETAIL_LAYERS, retailLayerCount } from "./retail-layers";

import { ARTBOX_STORES } from "./artbox";
import { DAISO_STORES } from "./daiso";
import { OLIVEYOUNG_STORES } from "./oliveyoung";
import { LOTTE_STORES } from "./lotte";
import { HYUNDAI_STORES } from "./hyundai";
import { SHINSEGAE_STORES } from "./shinsegae";
import { AK_STORES } from "./ak";
import { GALLERIA_STORES } from "./galleria";
import { ENTERSIX_STORES } from "./entersix";
import { MODA_STORES } from "./moda";
import { SAVEZONE_STORES } from "./savezone";
import { LF_STORES } from "./lf";
import { MODERNHOUSE_STORES } from "./modernhouse";
import { SPAO_STORES } from "./spao";
import { MIXXO_STORES } from "./mixxo";
import { ABCMART_STORES } from "./abcmart";
import { EIGHTSECONDS_STORES } from "./eightseconds";
import { MUJI_STORES } from "./muji";
import { HANSSEM_STORES } from "./hanssem";
import { LIVART_STORES } from "./livart";
import { ILOOM_STORES } from "./iloom";
import { NITORI_STORES } from "./nitori";
import { UNIQLO_STORES } from "./uniqlo";
import { EMART_STORES } from "./emart";
import { LOTTEMART_STORES } from "./lottemart";
import { HANAROMART_STORES } from "./hanaromart";

const ACTUAL: Record<string, { length: number }> = {
  lotte: LOTTE_STORES,
  hyundai: HYUNDAI_STORES,
  shinsegae: SHINSEGAE_STORES,
  ak: AK_STORES,
  galleria: GALLERIA_STORES,
  artbox: ARTBOX_STORES,
  abcmart: ABCMART_STORES,
  "8seconds": EIGHTSECONDS_STORES,
  spao: SPAO_STORES,
  mixxo: MIXXO_STORES,
  daiso: DAISO_STORES,
  oliveyoung: OLIVEYOUNG_STORES,
  modernhouse: MODERNHOUSE_STORES,
  muji: MUJI_STORES,
  hanssem: HANSSEM_STORES,
  livart: LIVART_STORES,
  iloom: ILOOM_STORES,
  nitori: NITORI_STORES,
  uniqlo: UNIQLO_STORES,
  entersix: ENTERSIX_STORES,
  moda: MODA_STORES,
  savezone: SAVEZONE_STORES,
  lf: LF_STORES,
  emart: EMART_STORES,
  lottemart: LOTTEMART_STORES,
  hanaromart: HANAROMART_STORES,
};

describe("retail-layer-counts", () => {
  it("모든 레지스트리 레이어가 실제 데이터에 매핑된다", () => {
    for (const l of RETAIL_LAYERS) {
      expect(ACTUAL[l.layer], `레이어 '${l.layer}' 실데이터 매핑 누락`).toBeDefined();
    }
  });

  it("생성된 점포 수가 실제 데이터 길이와 일치한다 (불일치 시 gen-retail-layers.mjs 재실행)", () => {
    for (const l of RETAIL_LAYERS) {
      const actual = ACTUAL[l.layer]?.length ?? -1;
      expect(retailLayerCount(l.layer), `레이어 '${l.layer}' 점포 수 불일치`).toBe(actual);
    }
  });
});
