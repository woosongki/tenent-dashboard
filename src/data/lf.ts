// LF스퀘어 전국 매장 위치 데이터
// 수집: Kakao Local API (scripts/fetch-other-mart-stores.mjs)
// 마지막 갱신: 2026-05-16T15:04:54.200Z
// 총 3개 매장 (양산점은 사용자 요청으로 제외)

import type { ChainStore } from "./artbox";

export const LF_STORES: ChainStore[] = [
  {
    "id": "1774059174",
    "name": "LF스퀘어 광양점",
    "addr": "전남 광양시 광양읍 순광로 466",
    "lat": 34.9631726636811,
    "lng": 127.565873709773
  },
  {
    "id": "2012439144",
    "name": "LF스퀘어 양주점",
    "addr": "경기 양주시 평화로 1593",
    "lat": 37.8313923303044,
    "lng": 127.052291647709
  },
  {
    "id": "27391747",
    "name": "LF스퀘어 인천점",
    "addr": "인천 연수구 청능대로23번길 11",
    "lat": 37.4185136371998,
    "lng": 126.669269328104
  }
];
