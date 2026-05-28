// 이랜드 41개점 정성 메타데이터 (브랜드 적합도 진단용)
// store_id는 src/data/homeplus.ts 의 ELAND_STORES.id 와 1:1 매칭
//
// 채우는 방법:
//   각 점포 객체의 null/빈 배열을 단이님이 알고 있는 값으로 교체.
//   미입력 필드는 점수 산출 시 "데이터 없음"으로 처리되어 해당 평가축
//   가중치가 자동 감소됨. 결과 카드에 "데이터 보완 필요" 라벨 표시.

export type AgeBand = "10대" | "20대" | "30대" | "40대" | "50대" | "60대+";
export type Gender = "여성 중심" | "남성 중심" | "균형";
export type FamilyRatio = "가족 중심" | "개인 중심" | "둘 다";
export type PriceBand = "초저가" | "중저가" | "중가" | "중고가" | "고가";
export type SpaceSize = "~30평" | "30~50평" | "50~100평" | "100평+";

export interface StoreMeta {
  store_id: number;
  trade_area: {
    primary_age: AgeBand[];           // 빈 배열 = 미입력
    primary_gender: Gender | null;    // null = 미입력
    family_ratio: FamilyRatio | null;
  };
  anchors: string[];                  // 입점 중인 앵커 매장 (자유 텍스트)
  tenant_mix: {
    categories: string[];             // 강세 카테고리 (자유 텍스트)
    price_band: PriceBand[];          // 강세 가격대
  };
  available_space: SpaceSize[];       // 현재 입점 가능한 공간 크기
  popup_friendly: boolean | null;     // 팝업 운영 친화도
}

/** 빈 메타 생성 헬퍼 */
function empty(id: number): StoreMeta {
  return {
    store_id: id,
    trade_area: { primary_age: [], primary_gender: "여성 중심", family_ratio: null },
    anchors: [],
    tenant_mix: { categories: [], price_band: [] },
    available_space: [],
    popup_friendly: null,
  };
}

// 41개점 정성 데이터 (2026-05 기준 자동 채움)
//
// ✅ 자동 채움 슬롯 (출처)
//   - primary_age:       store-demographics.json (구매고객 연령대)
//   - primary_gender:    전사 평균 여성 78% → 41점 모두 "여성 중심"
//   - tenant_mix.price_band:   store-sales.json (객단가 기반)
//   - tenant_mix.categories:   store-categories.json (카테고리 매출 비중)
//   - anchors:           store-brands.json (점포별 TOP10 매출 브랜드)
//
// ⏸ 미입력 슬롯 (수동 또는 동적 처리)
//   - family_ratio:      추가 가공 필요 (연령 비중에서 추정 가능)
//   - available_space:   공실 변동성 큼 → 정적 데이터로 부적합
//                        (필요 시 vacancy.json 실시간 조회로 처리)
//   - popup_friendly:    운영팀 정성 평가 필요
export const ELAND_META: StoreMeta[] = [
  {
    store_id: 1,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","애슐리퀸즈","나이키(NIKE)","전자랜드","네파","ABC마트","특정명품","스케쳐스","로운"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 2,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["애슐리퀸즈","모던하우스공통(MODERN HOUSE","뉴발란스키즈","에스핏","폴햄메가샾","뱅뱅","에꼴리에","허쉬파피(HUSHPUPPIES)","밀리밤(MILIBAM)","애니바디(ANYBODY)"],
    tenant_mix: { categories: ["아동의류","F&B"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 3,
    trade_area: { primary_age: ["50대","40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["하이퍼","애슐리퀸즈","모던하우스공통(MODERN HOUSE","게스(GUESS)(진)","ABC마트","에스마켓","뉴발란스","디스커버리","노스페이스(THENORTHFACE)","LF종합관"],
    tenant_mix: { categories: ["캐주얼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 4,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["로운","모던하우스공통(MODERN HOUSE","헤이린뉴욕","레드페이스","엘칸토(ELCANTO )","유니프랜드(모이모이)","스테파니(STEFANI)","벨리시앙","조순희","텐퍼센트커피"],
    tenant_mix: { categories: ["여성의류","영캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 5,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","애슐리퀸즈","SPAO(캐주얼)","로운","폴햄메가샾","영풍문고","미쏘","에스마켓","리트머스"],
    tenant_mix: { categories: ["아동의류","캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 6,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","뉴발란스","LF종합관","엘칸토(ELCANTO )","오프라이스","SPAO(캐주얼)","폴햄메가샾","ABC마트","게스(GUESS)(진)"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 7,
    trade_area: { primary_age: ["40대","60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","로운","락앤락","ABC마트","뉴발란스","스타벅스","사월에보리밥과쭈꾸미","SPAO(캐주얼)","특정OPR"],
    tenant_mix: { categories: ["하이퍼","F&B"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 8,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["모던하우스공통(MODERN HOUSE","애슐리퀸즈","탑텐","로운","ABC마트","아디다스(ADIDAS)","미샤팩토리","게스(GUESS)(진)","에스마켓","피자몰"],
    tenant_mix: { categories: ["스포츠","F&B"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 9,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["애슐리퀸즈","특정명품","모던하우스공통(MODERN HOUSE","로운","아디다스(ADIDAS)","크리스챤디올","블랙야크","문화센터(CULTURECENTER)","아이더(EIDER)","에스콰이아(ESQUIRE)"],
    tenant_mix: { categories: ["여성의류","잡화"], price_band: ["고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 10,
    trade_area: { primary_age: ["60대+","40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["하이퍼","삼성패션아울렛","애슐리퀸즈","다이소","스타벅스","올리브영","사월에보리밥과쭈꾸미","행텐틴즈","모던하우스공통(MODERN HOUSE","스케쳐스"],
    tenant_mix: { categories: ["F&B","하이퍼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 11,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","하이마트","애슐리퀸즈","모던하우스공통(MODERN HOUSE","아디다스(ADIDAS)","오아시스","맥도날드","LF종합관","컬럼비아","멜본"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 12,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["에스마켓","모던하우스공통(MODERN HOUSE","에꼴리에","소이","유솔(USALL)","아디다스(ADIDAS)","디즈니골프","폴햄메가샾","스케쳐스","폴햄키즈"],
    tenant_mix: { categories: ["아동의류","남성의류"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 13,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["교보문고","애슐리퀸즈","피자몰","SPAO(캐주얼)","반에이크","폴햄메가샾","두끼","해요","스파오키즈","캉골"],
    tenant_mix: { categories: ["F&B","라이프스타일","캐주얼","아동의류"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 14,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["애슐리퀸즈","로운","모던하우스공통(MODERN HOUSE","아트박스","버커루","SPAO(캐주얼)","슈펜","에꼴리에","멜본","행텐"],
    tenant_mix: { categories: ["캐주얼","여성의류","영캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 15,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["다이소","애슐리퀸즈","서브웨이","올리비아로렌","씨지브이(CGV)","델리BY애슐리","뉴발란스","하이퍼","디스커버리","파사디골프"],
    tenant_mix: { categories: ["F&B","라이프스타일"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 16,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["애슐리퀸즈","아디다스(ADIDAS)","씨지브이(CGV)","모던하우스공통(MODERN HOUSE","폴햄","SPAO(캐주얼)","미쏘","크록스(CROCS)","알래스카","게스(GUESS)(진)"],
    tenant_mix: { categories: ["캐주얼","아동의류"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 17,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","애슐리퀸즈","탑텐","스타벅스","교보문고","폴햄","비씨비지","락앤락","ABC마트"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 18,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["하이퍼","애슐리퀸즈","다이소","스케쳐스","스타벅스","LF종합관","ABC마트","피자몰","SPAO(캐주얼)","뉴발란스키즈"],
    tenant_mix: { categories: ["F&B"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 19,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","오아시스","모던하우스공통(MODERN HOUSE","특정명품","애슐리퀸즈","올리브영","아디다스(ADIDAS)","ABC마트","AK골프","버거킹(burgerking)"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 20,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","애슐리퀸즈","스포츠직매입","피자몰","숙녀(특정)_사입","특정OPR","크로커다일레이디","폴햄","모던하우스공통(MODERN HOUSE","멜본"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 21,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","아이더(EIDER)","폴햄메가샾","로운","LF팩토리","케이투(K2)","아디다스(ADIDAS)","로이드(LLOYD)","비씨비지"],
    tenant_mix: { categories: ["하이퍼","스포츠"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 22,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["애슐리퀸즈","ABC마트","탑텐","뉴발란스","SPAO(캐주얼)","아이더(EIDER)","케이투(K2)","스케쳐스","요하넥스","베네통(영캐주얼)"],
    tenant_mix: { categories: ["스포츠","캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 23,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","애슐리퀸즈","모던하우스공통(MODERN HOUSE","게스(GUESS)(진)","콜핑(KOLPING)","크로커다일(CROCODILE)","아식스(ASICS)","베스띠벨리","폴햄","아우어베이커리"],
    tenant_mix: { categories: [], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 24,
    trade_area: { primary_age: ["40대","50대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["하이퍼","아디다스(ADIDAS)","모던하우스공통(MODERN HOUSE","애슐리퀸즈","SPAO(캐주얼)","나이키(NIKE)","ABC마트","에스마켓","루이까스텔","올리브영"],
    tenant_mix: { categories: ["하이퍼","스포츠"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 25,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "개인 중심" },
    anchors: ["하이퍼","맥스온누리 약국","ABC마트","게스(GUESS)(진)","피에이티(PAT)","미셸BY탠디","피자몰","프로젝트M","이헌영패션","엘칸토(ELCANTO )"],
    tenant_mix: { categories: ["하이퍼","라이프스타일"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 26,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["올리브영","폴햄메가샾","엘칸토(ELCANTO )","에꼴리에","애니바디(ANYBODY)","행텐틴즈","비너스(VENUS)","오픈클로젯","엔코코","프로젝트M"],
    tenant_mix: { categories: ["잡화","아동의류","캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 27,
    trade_area: { primary_age: ["60대+","40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["애슐리퀸즈","모던하우스공통(MODERN HOUSE","행텐틴즈","아메리칸투어리스트","에스핏","인디고뱅크키즈(INDIGOBANKKI","밀리밤(MILIBAM)","폴햄키즈","아다바트화이트","로엠(ROEM)"],
    tenant_mix: { categories: ["영캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 28,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","애슐리퀸즈","게스(GUESS)(진)","아디다스(ADIDAS)","탑텐","아가방","미쏘","폴햄","소이"],
    tenant_mix: { categories: [], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 29,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","애슐리퀸즈","로운","ABC마트","SPAO(캐주얼)","뉴발란스","모조에스핀","프로젝트M","미셸BY탠디"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 30,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "가족 중심" },
    anchors: ["모던하우스공통(MODERN HOUSE","애슐리퀸즈","아디다스(ADIDAS)","에스마켓","탑텐","뉴발란스","행텐틴즈","인터크루","소이","에꼴리에"],
    tenant_mix: { categories: ["아동의류","스포츠","남성의류"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 31,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","ABC마트","애슐리퀸즈","모던하우스공통(MODERN HOUSE","미샤(화장품)","프랑제리","좋은영화","로운","뉴발란스","올리브영"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 32,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["엠페스트","모던하우스공통(MODERN HOUSE","애슐리퀸즈","스케쳐스","ABC마트","레드페이스","베스띠벨리","피에이티(PAT)","제이디엑스(JDX)","루이까스텔"],
    tenant_mix: { categories: ["남성의류"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 33,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "개인 중심" },
    anchors: ["엠페스트","모던하우스공통(MODERN HOUSE","바바&바바","스케쳐스","오후(OHOO)","CMCUBE","오스본(OSBORNE)","소이","아메리칸투어리스트","크로커다일레이디"],
    tenant_mix: { categories: ["스포츠","잡화"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 34,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["하이퍼","모던하우스공통(MODERN HOUSE","애슐리퀸즈","아동(특정)_사입","숙녀(특정)_사입","특정OPR","스타벅스","멜본","오프라이스","스케쳐스"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 35,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "개인 중심" },
    anchors: ["프로스펙스","크로커다일(CROCODILE)","크로커다일레이디","발렌시아","소이","콜핑(KOLPING)","피에이티(PAT)","행텐틴즈","수엔지","애니바디(ANYBODY)"],
    tenant_mix: { categories: ["여성의류","스포츠","잡화"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 36,
    trade_area: { primary_age: ["50대"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["모던하우스공통(MODERN HOUSE","하이퍼","델리BY애슐리","애슐리퀸즈","피자몰","ABC마트","엘칸토(ELCANTO )","스케쳐스","디스커버리","SPAO(캐주얼)"],
    tenant_mix: { categories: [], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 37,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "둘 다" },
    anchors: ["모던하우스공통(MODERN HOUSE","하이퍼","델리BY애슐리","애슐리퀸즈","피자몰","ABC마트","엘칸토(ELCANTO )","스케쳐스","디스커버리","SPAO(캐주얼)"],
    tenant_mix: { categories: ["스포츠"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 38,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "개인 중심" },
    anchors: ["엠페스트","애슐리퀸즈","뉴발란스","모던하우스공통(MODERN HOUSE","특정OPR","ABC마트","숙녀(특정)_사입","스케쳐스","엘칸토(ELCANTO )","트랜드컬렉션(TREND COLLECT"],
    tenant_mix: { categories: ["남성의류","여성의류","잡화"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 39,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "개인 중심" },
    anchors: ["트레몰로","소이","프로스펙스","레드페이스","더레노마","모던하우스공통(MODERN HOUSE","미소페(MISOPE)","도쿄엔펄","멜본","엔프라니"],
    tenant_mix: { categories: ["여성의류","잡화"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 40,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "개인 중심" },
    anchors: ["애슐리퀸즈","엘칸토(ELCANTO )","발렌시아","CMCUBE","클라비스(CLOVIS)","오휘","닥스(셔츠/타이)","비씨비지","리스트","비너스(VENUS)"],
    tenant_mix: { categories: ["하이퍼","잡화"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 41,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: "여성 중심", family_ratio: "개인 중심" },
    anchors: ["하이퍼","델리BY애슐리","애슐리퀸즈","모던하우스공통(MODERN HOUSE","스케쳐스","피에르가르뎅(신사캐주얼)","특정명품","게스(GUESS)(진)","크로커다일(CROCODILE)","인디고뱅크키즈(INDIGOBANKKI"],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
];

/** store_id로 메타 조회 */
export function getMeta(storeId: number): StoreMeta | undefined {
  return ELAND_META.find((m) => m.store_id === storeId);
}

/** 메타가 비어있는지 검사 (모든 정성 필드가 미입력) */
export function isMetaEmpty(m: StoreMeta): boolean {
  return (
    m.trade_area.primary_age.length === 0 &&
    m.trade_area.primary_gender === null &&
    m.trade_area.family_ratio === null &&
    m.anchors.length === 0 &&
    m.tenant_mix.categories.length === 0 &&
    m.tenant_mix.price_band.length === 0 &&
    m.available_space.length === 0 &&
    m.popup_friendly === null
  );
}
