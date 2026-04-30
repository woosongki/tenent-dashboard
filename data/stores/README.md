# 이랜드리테일 점포 마스터 데이터

상권분석 모듈을 위한 이랜드리테일 5개 브랜드(NC백화점·뉴코아아울렛·2001아울렛·동아백화점·킴스클럽) 점포 마스터입니다.

## 파일 구성

| 파일 | 설명 |
|------|------|
| `stores-raw.json` | 점포 메타데이터 원본 (이름·주소·전화·킴스클럽 입점 여부) |
| `stores.json` | 지오코딩 후 결과 (위경도 + 법정동코드 + 도로명) |

## 구조

```jsonc
{
  "version": "0.1.0",
  "compiledAt": "2026-04-29",
  "stores": [
    {
      "id": "nc-songpa",
      "brand": "NC백화점",          // NC백화점 | 뉴코아아울렛 | 2001아울렛 | 동아백화점
      "type": "백화점",              // 백화점 | 아울렛 | 뉴코아몰 | WAVE
      "name": "송파점",
      "address": "서울 송파구 문정동 634",
      "phone": null,
      "hasKimsclub": true,           // 킴스클럽 식품관 입점 여부

      // ── geocode-stores.mjs 실행 후 추가 ──
      "lat": 37.4855,
      "lng": 127.1226,
      "bcode": "1171010100",          // 행정표준 법정동 코드 10자리
      "lawdCd": "11710",              // 시군구 코드 5자리 (실거래가 API용)
      "region1": "서울특별시",
      "region2": "송파구",
      "region3": "문정동",
      "roadAddress": "서울 송파구 ...",
      "jibunAddress": "서울 송파구 문정동 634",
      "geocoded": true
    }
  ]
}
```

## 매장 수 (v0.2.0 — 운영팀 확정)

| 브랜드 | 매장 수 | 비고 |
|--------|---------|------|
| NC백화점 | 18 | 백화점 11 + 뉴코아몰 4 + WAVE 2 + 아울렛 1 |
| 뉴코아아울렛 | 14 | |
| 2001아울렛 | 5 | 전 지점 킴스클럽 입점 |
| 동아백화점 | 4 | 대구 3 + 구미 1 |
| **합계** | **41** | |

킴스클럽은 별도 매장 entry 없이 부모 매장의 `hasKimsclub: true` 로 표현했습니다. 단독 매장(예: 가든파이브 라이프 송파점, 부천터미널 소풍점) 추가는 v0.2 예정입니다.

## 지오코딩 실행

### 1. 카카오 REST API 키 발급

[Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 → REST API 키 복사

### 2. 환경변수 설정 후 스크립트 실행

**Windows PowerShell**
```powershell
$env:KAKAO_REST_API_KEY="여기에_키_붙여넣기"
node scripts/geocode-stores.mjs
```

**macOS / Linux / WSL**
```bash
export KAKAO_REST_API_KEY="여기에_키_붙여넣기"
node scripts/geocode-stores.mjs
```

### 3. 결과 확인

```
[NC백화점 송파점] ✓ 37.48553, 127.12266 (11710)
[NC백화점 강서점] ✓ 37.55245, 126.86564 (11500)
...
=== 완료 ===
성공: 50 / 실패: 0 / 총 50건
출력: data/stores/stores.json
```

## 데이터 소스

- [NC백화점 — 위키백과](https://ko.wikipedia.org/wiki/NC%EB%B0%B1%ED%99%94%EC%A0%90)
- [뉴코아아울렛 — 위키백과](https://ko.wikipedia.org/wiki/%EB%89%B4%EC%BD%94%EC%95%84%EC%95%84%EC%9A%B8%EB%A0%9B)
- [2001아울렛 — 위키백과](https://ko.wikipedia.org/wiki/2001%EC%95%84%EC%9A%B8%EB%A0%9B)
- [동아백화점 — 위키백과](https://ko.wikipedia.org/wiki/%EB%8F%99%EC%95%84%EB%B0%B1%ED%99%94%EC%A0%90)
- [이랜드리테일 공식](https://www.elandretail.com/)

## Phase 2 (다음 단계)

`stores.json` 의 `lawdCd` (시군구 5자리)와 `lat/lng` 가 채워지면 다음을 연결합니다:

1. **소상공인진흥공단 상권정보 API** — 매장 좌표 반경 500m/1km 상권 분석
2. **k-skill real-estate-search** — `lawdCd` 로 상업업무용 매매 실거래가 조회
3. **한국부동산원 상업용부동산 임대동향** — 매장 권역의 평균 임대료/공실률 매핑
