// 리테일 지도용 체인 좌표 데이터 집합 (약 1.1MB).
//
// 지도 클라이언트가 이 모듈을 dynamic import(마운트 후)로 불러와 초기 번들에서
// 분리한다 → 지도 첫 로딩 시 1.1MB가 블로킹으로 파싱되지 않음.
// 정적으로 import하지 말 것(그러면 다시 초기 번들에 포함됨).

import type { ChainStore } from "./artbox";

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

export const CHAINS: Record<string, ChainStore[]> = {
  artbox: ARTBOX_STORES,
  daiso: DAISO_STORES,
  oliveyoung: OLIVEYOUNG_STORES,
  lotte: LOTTE_STORES,
  hyundai: HYUNDAI_STORES,
  shinsegae: SHINSEGAE_STORES,
  ak: AK_STORES,
  galleria: GALLERIA_STORES,
  entersix: ENTERSIX_STORES,
  moda: MODA_STORES,
  savezone: SAVEZONE_STORES,
  lf: LF_STORES,
  modernhouse: MODERNHOUSE_STORES,
  spao: SPAO_STORES,
  mixxo: MIXXO_STORES,
  abcmart: ABCMART_STORES,
  eightseconds: EIGHTSECONDS_STORES,
  muji: MUJI_STORES,
  hanssem: HANSSEM_STORES,
  livart: LIVART_STORES,
  iloom: ILOOM_STORES,
  nitori: NITORI_STORES,
  uniqlo: UNIQLO_STORES,
  emart: EMART_STORES,
  lottemart: LOTTEMART_STORES,
  hanaromart: HANAROMART_STORES,
};

export type Chains = typeof CHAINS;
