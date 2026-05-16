// 홈플러스 영업중단 점포 × 이랜드리테일 점포 상권 매칭 데이터
// 출처: 데스크톱 분석 HTML (2026.05 기준)

export type Tier = "동일상권" | "인접상권" | "근접권" | "별도상권";

export interface CategoryGroup {
  category: string;
  brands: string[];
  count: number;
}

export interface HomeplusStore {
  name: string;
  addr: string;
  lat: number;
  lng: number;
  tier: Tier;
  eland_id: number;
  eland_brand: string;
  eland_name: string;
  eland_addr: string;
  distance: number;
  total_brands: number;
  categories: CategoryGroup[];
}

export interface ElandStore {
  id: number;
  brand: string;
  name: string;
  addr: string;
  dong: string;
  lat: number;
  lng: number;
}

export const HOMEPLUS_STORES: HomeplusStore[] = [
  {"name":"중계점","addr":"서울 노원구 중계동","lat":37.639815,"lng":127.06864,"tier":"동일상권","eland_id":36,"eland_brand":"2001아울렛","eland_name":"중계점","eland_addr":"서울 노원구 동일로204가길 46","distance":0.18,"total_brands":5,"categories":[{"category":"뷰티/헤어/네일","brands":["미플","박공헤어"],"count":2},{"category":"생활/홈/리빙","brands":["다이소"],"count":1},{"category":"키즈/놀이/엔터","brands":["노리디지털키즈카페"],"count":1},{"category":"화훼/플라워","brands":["로즈플라워"],"count":1}]},
  {"name":"신내점","addr":"서울 중랑구 신내동","lat":37.615754,"lng":127.093753,"tier":"근접권","eland_id":36,"eland_brand":"2001아울렛","eland_name":"중계점","eland_addr":"서울 노원구 동일로204가길 46","distance":3.64,"total_brands":4,"categories":[{"category":"뷰티/헤어/네일","brands":["준오헤어"],"count":1},{"category":"생활/홈/리빙","brands":["까사벨르","다이소"],"count":2},{"category":"여행/서비스/기타","brands":["하나투어"],"count":1}]},
  {"name":"면목점","addr":"서울 중랑구 면목동","lat":37.580511,"lng":127.081936,"tier":"별도상권","eland_id":37,"eland_brand":"2001아울렛","eland_name":"천호2점","eland_addr":"서울 강동구 구천면로 189","distance":5.84,"total_brands":2,"categories":[{"category":"여행/서비스/기타","brands":["하나투어"],"count":1},{"category":"통신/모바일","brands":["LG_U플러스"],"count":1}]},
  {"name":"잠실점","addr":"서울 송파구 잠실동","lat":37.516228,"lng":127.102999,"tier":"근접권","eland_id":37,"eland_brand":"2001아울렛","eland_name":"천호2점","eland_addr":"서울 강동구 구천면로 189","distance":3.44,"total_brands":9,"categories":[{"category":"뷰티/헤어/네일","brands":["박승철헤어","포쉬네일"],"count":2},{"category":"생활/홈/리빙","brands":["소잉팩토리"],"count":1},{"category":"스포츠/피트니스","brands":["코너스톤잠실아카데미"],"count":1},{"category":"여행/서비스/기타","brands":["마인드카페"],"count":1},{"category":"키즈/놀이/엔터","brands":["상상블럭","오락카페","캘리클럽"],"count":3},{"category":"화훼/플라워","brands":["플로리아트"],"count":1}]},
  {"name":"센텀시티점","addr":"부산 해운대구 센텀","lat":35.170936,"lng":129.13371,"tier":"근접권","eland_id":17,"eland_brand":"NC백화점","eland_name":"해운대점","eland_addr":"부산 해운대구 좌동 1467-4","distance":3.94,"total_brands":17,"categories":[{"category":"뷰티/헤어/네일","brands":["준오헤어"],"count":1},{"category":"생활/홈/리빙","brands":["까사벨르","다이소","엘레강스파리","이노센트"],"count":4},{"category":"스포츠/피트니스","brands":["신준골프아카데미","핏플러스"],"count":2},{"category":"여행/서비스/기타","brands":["모두모임","모두투어","하나투어"],"count":3},{"category":"키즈/놀이/엔터","brands":["상상블럭","시크릿쥬쥬"],"count":2},{"category":"통신/모바일","brands":["KT","LGU+","SKT"],"count":3},{"category":"화훼/플라워","brands":["그리니(행사)","포시즌"],"count":2}]},
  {"name":"부산반여점","addr":"부산 해운대구 반여동","lat":35.196186,"lng":129.115601,"tier":"근접권","eland_id":5,"eland_brand":"NC백화점","eland_name":"부산대점","eland_addr":"부산 금정구 장전동 40","distance":4.92,"total_brands":2,"categories":[{"category":"뷰티/헤어/네일","brands":["포쉬네일"],"count":1},{"category":"생활/홈/리빙","brands":["좋은숨"],"count":1}]},
  {"name":"영도점","addr":"부산 영도구","lat":35.095925,"lng":129.044258,"tier":"근접권","eland_id":21,"eland_brand":"뉴코아아울렛","eland_name":"괴정점","eland_addr":"부산 사하구 괴정동","distance":4.58,"total_brands":1,"categories":[{"category":"여행/서비스/기타","brands":["모두투어"],"count":1}]},
  {"name":"서부산점","addr":"부산 사상구","lat":35.164289,"lng":128.977809,"tier":"별도상권","eland_id":22,"eland_brand":"뉴코아아울렛","eland_name":"덕천점","eland_addr":"부산 북구 덕천동","distance":5.87,"total_brands":2,"categories":[{"category":"스포츠/피트니스","brands":["메디제이필라테스"],"count":1},{"category":"여행/서비스/기타","brands":["모두투어"],"count":1}]},
  {"name":"상인점","addr":"대구 달서구 상인동","lat":35.817952,"lng":128.533611,"tier":"별도상권","eland_id":40,"eland_brand":"동아백화점","eland_name":"쇼핑점","eland_addr":"대구 중구 달구벌대로 2085","distance":7.51,"total_brands":5,"categories":[{"category":"스포츠/피트니스","brands":["위드컴퍼니","윈드사커"],"count":2},{"category":"여행/서비스/기타","brands":["모두투어"],"count":1},{"category":"키즈/놀이/엔터","brands":["맥스라이더","히어로플레이파크"],"count":2}]},
  {"name":"가좌점","addr":"인천 서구 가좌동","lat":37.497669,"lng":126.670669,"tier":"근접권","eland_id":33,"eland_brand":"2001아울렛","eland_name":"부평점","eland_addr":"인천 부평구 경원대로 1277","distance":3.57,"total_brands":7,"categories":[{"category":"뷰티/헤어/네일","brands":["젤리네일"],"count":1},{"category":"생활/홈/리빙","brands":["다이소","리눔아티카","모던하우스","좋은숨굿프렌드"],"count":4},{"category":"스포츠/피트니스","brands":["GDRKU골프아카데미"],"count":1},{"category":"여행/서비스/기타","brands":["하나투어"],"count":1}]},
  {"name":"인천연수점","addr":"인천 연수구","lat":37.405979,"lng":126.683703,"tier":"근접권","eland_id":28,"eland_brand":"뉴코아아울렛","eland_name":"인천점","eland_addr":"인천 남동구 인하로 485","distance":4.52,"total_brands":9,"categories":[{"category":"뷰티/헤어/네일","brands":["네일퀸","두쏠뷰티"],"count":2},{"category":"생활/홈/리빙","brands":["다이소","좋은숨"],"count":2},{"category":"키즈/놀이/엔터","brands":["상상블럭","원더4D","짱죽","챔피언"],"count":4},{"category":"화훼/플라워","brands":["연수블라썸"],"count":1}]},
  {"name":"인천송도점","addr":"인천 연수구 송도","lat":37.38033,"lng":126.65629,"tier":"별도상권","eland_id":28,"eland_brand":"뉴코아아울렛","eland_name":"인천점","eland_addr":"인천 남동구 인하로 485","distance":8.12,"total_brands":18,"categories":[{"category":"기타","brands":["피티시모"],"count":1},{"category":"뷰티/헤어/네일","brands":["고연화에스테틱","네일퀸","준오헤어"],"count":3},{"category":"생활/홈/리빙","brands":["다이소","아르페지오","유에이치북 행사","일룸"],"count":4},{"category":"여행/서비스/기타","brands":["모두투어","하나투어"],"count":2},{"category":"키즈/놀이/엔터","brands":["베이비엔젤스","상상블럭","상상스케치","시아북카페","원더4D","챔피언"],"count":6},{"category":"통신/모바일","brands":["SKT","굿리치"],"count":2}]},
  {"name":"인천논현점","addr":"인천 남동구 논현","lat":37.400273,"lng":126.725193,"tier":"별도상권","eland_id":28,"eland_brand":"뉴코아아울렛","eland_name":"인천점","eland_addr":"인천 남동구 인하로 485","distance":5.35,"total_brands":9,"categories":[{"category":"뷰티/헤어/네일","brands":["고정현헤어","네일퀸"],"count":2},{"category":"생활/홈/리빙","brands":["다이소","블루메코","아르페지오"],"count":3},{"category":"스포츠/피트니스","brands":["아놀드홍"],"count":1},{"category":"여행/서비스/기타","brands":["웅진코웨이"],"count":1},{"category":"키즈/놀이/엔터","brands":["엔젤크루키즈스위밍"],"count":1},{"category":"화훼/플라워","brands":["데코플라워"],"count":1}]},
  {"name":"킨텍스점","addr":"경기 고양시 일산서구","lat":37.667778,"lng":126.752238,"tier":"인접상권","eland_id":29,"eland_brand":"뉴코아아울렛","eland_name":"일산점","eland_addr":"경기 고양시 일산동구 중앙로 1206","distance":2.62,"total_brands":4,"categories":[{"category":"뷰티/헤어/네일","brands":["이가자헤어비스","포쉬네일"],"count":2},{"category":"생활/홈/리빙","brands":["모던하우스"],"count":1},{"category":"여행/서비스/기타","brands":["여행이지"],"count":1}]},
  {"name":"고양터미널점","addr":"경기 고양시 일산동구","lat":37.643233,"lng":126.789699,"tier":"인접상권","eland_id":29,"eland_brand":"뉴코아아울렛","eland_name":"일산점","eland_addr":"경기 고양시 일산동구 중앙로 1206","distance":1.69,"total_brands":4,"categories":[{"category":"뷰티/헤어/네일","brands":["바디닥터","이철헤어커커"],"count":2},{"category":"생활/홈/리빙","brands":["다이소","모모아이"],"count":2}]},
  {"name":"포천송우점","addr":"경기 포천시","lat":37.824383,"lng":127.14132,"tier":"별도상권","eland_id":36,"eland_brand":"2001아울렛","eland_name":"중계점","eland_addr":"서울 노원구 동일로204가길 46","distance":21.35,"total_brands":5,"categories":[{"category":"뷰티/헤어/네일","brands":["두쏠헤어"],"count":1},{"category":"생활/홈/리빙","brands":["두원리퍼브"],"count":1},{"category":"스포츠/피트니스","brands":["FITIN365+"],"count":1},{"category":"키즈/놀이/엔터","brands":["맥스라이더"],"count":1},{"category":"화훼/플라워","brands":["프렌치메종"],"count":1}]},
  {"name":"남양주진접점","addr":"경기 남양주시","lat":37.721502,"lng":127.188792,"tier":"별도상권","eland_id":36,"eland_brand":"2001아울렛","eland_name":"중계점","eland_addr":"서울 노원구 동일로204가길 46","distance":13.88,"total_brands":6,"categories":[{"category":"생활/홈/리빙","brands":["다이소","모모아이"],"count":2},{"category":"스포츠/피트니스","brands":["피트인365+"],"count":1},{"category":"여행/서비스/기타","brands":["모두투어","하나투어"],"count":2},{"category":"키즈/놀이/엔터","brands":["타요키즈카페"],"count":1}]},
  {"name":"경기하남점","addr":"경기 하남시","lat":37.538278,"lng":127.212432,"tier":"별도상권","eland_id":37,"eland_brand":"2001아울렛","eland_name":"천호2점","eland_addr":"서울 강동구 구천면로 189","distance":7.63,"total_brands":3,"categories":[{"category":"뷰티/헤어/네일","brands":["이가자헤어비스"],"count":1},{"category":"생활/홈/리빙","brands":["까사벨르"],"count":1},{"category":"여행/서비스/기타","brands":["하나투어"],"count":1}]},
  {"name":"부천소사점","addr":"경기 부천시 소사구","lat":37.484863,"lng":126.814255,"tier":"별도상권","eland_id":24,"eland_brand":"뉴코아아울렛","eland_name":"부천점","eland_addr":"경기 부천시 송내대로 239","distance":5.49,"total_brands":3,"categories":[{"category":"뷰티/헤어/네일","brands":["두쏠뷰티"],"count":1},{"category":"생활/홈/리빙","brands":["다이소","좋은숨"],"count":2}]},
  {"name":"분당오리점","addr":"경기 성남시 분당구 구미동","lat":37.340046,"lng":127.106971,"tier":"인접상권","eland_id":34,"eland_brand":"2001아울렛","eland_name":"분당점","eland_addr":"경기 성남시 분당구 미금일로154번길 20","distance":1.0,"total_brands":6,"categories":[{"category":"뷰티/헤어/네일","brands":["더모락","이철헤어커커"],"count":2},{"category":"생활/홈/리빙","brands":["세사리빙","한샘키친&바스"],"count":2},{"category":"여행/서비스/기타","brands":["모두투어","하나투어"],"count":2}]},
  {"name":"동수원점","addr":"경기 수원시 팔달구 인계동","lat":37.262536,"lng":127.03044,"tier":"동일상권","eland_id":23,"eland_brand":"뉴코아아울렛","eland_name":"동수원점","eland_addr":"경기 수원시 팔달구 인계로 154","distance":0.55,"total_brands":8,"categories":[{"category":"뷰티/헤어/네일","brands":["박승철헤어","플러스인바디"],"count":2},{"category":"생활/홈/리빙","brands":["라라홈","아르페지오","좋은숨"],"count":3},{"category":"여행/서비스/기타","brands":["마인드카페"],"count":1},{"category":"화훼/플라워","brands":["진스플라워","프렌치메종"],"count":2}]},
  {"name":"익산점","addr":"전북 익산시","lat":35.95888,"lng":126.972349,"tier":"별도상권","eland_id":13,"eland_brand":"NC백화점","eland_name":"전주점","eland_addr":"전북 전주시 완산구 고사동 105-3","distance":21.96,"total_brands":2,"categories":[{"category":"키즈/놀이/엔터","brands":["맥스라이더","타요키즈카페"],"count":2}]},
  {"name":"김제점","addr":"전북 김제시","lat":35.799997,"lng":126.903191,"tier":"별도상권","eland_id":13,"eland_brand":"NC백화점","eland_name":"전주점","eland_addr":"전북 전주시 완산구 고사동 105-3","distance":21.92,"total_brands":1,"categories":[{"category":"생활/홈/리빙","brands":["누리홈_브륄리에"],"count":1}]},
  {"name":"목포점","addr":"전남 목포시","lat":34.805938,"lng":126.399654,"tier":"별도상권","eland_id":16,"eland_brand":"NC백화점","eland_name":"충장점","eland_addr":"광주 동구 충장로4가 29-2","distance":60.35,"total_brands":2,"categories":[{"category":"생활/홈/리빙","brands":["브릴리에(침구)"],"count":1},{"category":"키즈/놀이/엔터","brands":["맥스라이더"],"count":1}]},
  {"name":"순천풍덕점","addr":"전남 순천시 풍덕동","lat":34.939942,"lng":127.508766,"tier":"근접권","eland_id":9,"eland_brand":"NC백화점","eland_name":"순천점","eland_addr":"전남 순천시 조례동 766","distance":3.78,"total_brands":1,"categories":[{"category":"생활/홈/리빙","brands":["아르페지오"],"count":1}]},
  {"name":"경산점","addr":"경북 경산시","lat":35.832761,"lng":128.735654,"tier":"인접상권","eland_id":2,"eland_brand":"NC백화점","eland_name":"경산점","eland_addr":"경북 경산시 중방동 332-13","distance":1.28,"total_brands":6,"categories":[{"category":"생활/홈/리빙","brands":["다이소","리치랜드","블루메코,하나침장","아르페지오"],"count":4},{"category":"스포츠/피트니스","brands":["잇츠짐"],"count":1},{"category":"여행/서비스/기타","brands":["모두투어"],"count":1}]},
  {"name":"죽도점","addr":"경북 포항시 북구 죽도동","lat":36.030881,"lng":129.365104,"tier":"별도상권","eland_id":26,"eland_brand":"뉴코아아울렛","eland_name":"울산2점","eland_addr":"울산 중구 성남동","distance":53.13,"total_brands":1,"categories":[{"category":"스포츠/피트니스","brands":["잇츠짐"],"count":1}]},
  {"name":"구미점","addr":"경북 구미시","lat":36.102758,"lng":128.36379,"tier":"인접상권","eland_id":39,"eland_brand":"동아백화점","eland_name":"구미점","eland_addr":"경북 구미시 송원동로 28","distance":2.33,"total_brands":3,"categories":[{"category":"뷰티/헤어/네일","brands":["더모스트헤어"],"count":1},{"category":"생활/홈/리빙","brands":["클푸/나이스필"],"count":1},{"category":"키즈/놀이/엔터","brands":["바운스트램폴린파크"],"count":1}]},
  {"name":"밀양점","addr":"경남 밀양시","lat":35.488966,"lng":128.740756,"tier":"별도상권","eland_id":30,"eland_brand":"뉴코아아울렛","eland_name":"창원점","eland_addr":"경남 창원시 의창구 창원대로397번길 6","distance":29.67,"total_brands":2,"categories":[{"category":"생활/홈/리빙","brands":["누리홈"],"count":1},{"category":"스포츠/피트니스","brands":["잇츠짐"],"count":1}]},
  {"name":"진주점","addr":"경남 진주시","lat":35.187602,"lng":128.117743,"tier":"별도상권","eland_id":30,"eland_brand":"뉴코아아울렛","eland_name":"창원점","eland_addr":"경남 창원시 의창구 창원대로397번길 6","distance":47.94,"total_brands":3,"categories":[{"category":"뷰티/헤어/네일","brands":["티엠헤어"],"count":1},{"category":"생활/홈/리빙","brands":["다이소","브릴리에"],"count":2}]},
  {"name":"마산점","addr":"경남 창원시 마산회원구","lat":35.222657,"lng":128.585752,"tier":"별도상권","eland_id":30,"eland_brand":"뉴코아아울렛","eland_name":"창원점","eland_addr":"경남 창원시 의창구 창원대로397번길 6","distance":5.3,"total_brands":3,"categories":[{"category":"생활/홈/리빙","brands":["제우스가구"],"count":1},{"category":"스포츠/피트니스","brands":["더스포잇츠짐"],"count":1},{"category":"키즈/놀이/엔터","brands":["몬스터파크"],"count":1}]},
  {"name":"진해점","addr":"경남 창원시 진해구","lat":35.153234,"lng":128.691258,"tier":"별도상권","eland_id":30,"eland_brand":"뉴코아아울렛","eland_name":"창원점","eland_addr":"경남 창원시 의창구 창원대로397번길 6","distance":10.08,"total_brands":5,"categories":[{"category":"뷰티/헤어/네일","brands":["라브릿지헤어"],"count":1},{"category":"생활/홈/리빙","brands":["까사벨르","누리홈","제우스가구"],"count":3},{"category":"스포츠/피트니스","brands":["잇츠짐"],"count":1}]},
  {"name":"김해점","addr":"경남 김해시","lat":35.241827,"lng":128.870178,"tier":"별도상권","eland_id":22,"eland_brand":"뉴코아아울렛","eland_name":"덕천점","eland_addr":"부산 북구 덕천동","distance":12.94,"total_brands":10,"categories":[{"category":"뷰티/헤어/네일","brands":["두쏠헤어"],"count":1},{"category":"생활/홈/리빙","brands":["다이소","모던하우스","아르페지오","엘레강스파리","킹스톤 가구"],"count":5},{"category":"여행/서비스/기타","brands":["모두투어","하나투어"],"count":2},{"category":"키즈/놀이/엔터","brands":["타카슬라임카페"],"count":1},{"category":"통신/모바일","brands":["알뜰폰"],"count":1}]}
];

export const ELAND_STORES: ElandStore[] = [
  {"id":1,"brand":"NC백화점","name":"강서점","addr":"서울 강서구 등촌동 689","dong":"등촌동","lat":37.559904,"lng":126.840512},
  {"id":2,"brand":"NC백화점","name":"경산점","addr":"경북 경산시 중방동 332-13","dong":"중방동","lat":35.821765,"lng":128.731472},
  {"id":3,"brand":"NC백화점","name":"고잔점","addr":"경기 안산시 단원구 광덕대로 194","dong":"고잔동","lat":37.313444,"lng":126.831009},
  {"id":4,"brand":"NC백화점","name":"광주역점","addr":"광주 북구 신안동 6-1","dong":"신안동","lat":35.161514,"lng":126.907212},
  {"id":5,"brand":"NC백화점","name":"부산대점","addr":"부산 금정구 장전동 40","dong":"장전동","lat":35.232298,"lng":129.084245},
  {"id":6,"brand":"NC백화점","name":"불광점","addr":"서울 은평구 대조동 240","dong":"대조동","lat":37.609712,"lng":126.928852},
  {"id":7,"brand":"NC백화점","name":"송파점","addr":"서울 송파구 문정동 634","dong":"문정동","lat":37.477406,"lng":127.125741},
  {"id":8,"brand":"NC백화점","name":"수원터미널점","addr":"경기 수원시 권선구 권선동 1189","dong":"권선동","lat":37.250182,"lng":127.01989},
  {"id":9,"brand":"NC백화점","name":"순천점","addr":"전남 순천시 조례동 766","dong":"조례동","lat":34.972477,"lng":127.520939},
  {"id":10,"brand":"NC백화점","name":"신구로점","addr":"서울 구로구 구로중앙로 152","dong":"구로동","lat":37.50106,"lng":126.88268},
  {"id":11,"brand":"NC백화점","name":"야탑점","addr":"경기 성남시 분당구 야탑동 357-1","dong":"야탑동","lat":37.410906,"lng":127.127476},
  {"id":12,"brand":"NC백화점","name":"엑스코점","addr":"대구 북구 산격2동 1668","dong":"산격동","lat":35.905265,"lng":128.610443},
  {"id":13,"brand":"NC백화점","name":"전주점","addr":"전북 전주시 완산구 고사동 105-3","dong":"고사동","lat":35.819538,"lng":127.145081},
  {"id":14,"brand":"NC백화점","name":"중앙로역점","addr":"대전 중구 선화동 3-14","dong":"선화동","lat":36.328894,"lng":127.425032},
  {"id":15,"brand":"NC백화점","name":"청주점","addr":"충북 청주시 흥덕구 풍산로 15","dong":"가경동","lat":36.626225,"lng":127.431113},
  {"id":16,"brand":"NC백화점","name":"충장점","addr":"광주 동구 충장로4가 29-2","dong":"충장로4가","lat":35.14864,"lng":126.913311},
  {"id":17,"brand":"NC백화점","name":"해운대점","addr":"부산 해운대구 좌동 1467-4","dong":"좌동","lat":35.170584,"lng":129.177093},
  {"id":18,"brand":"NC백화점","name":"NC대전유성점","addr":"대전 유성구 계룡로 119","dong":"봉명동","lat":36.353564,"lng":127.343895},
  {"id":19,"brand":"뉴코아아울렛","name":"강남점","addr":"서울 서초구 잠원로 51","dong":"잠원동","lat":37.50928,"lng":127.0075},
  {"id":20,"brand":"뉴코아아울렛","name":"광명점","addr":"경기 광명시 하안로287번길 8","dong":"하안동","lat":37.461151,"lng":126.879319},
  {"id":21,"brand":"뉴코아아울렛","name":"괴정점","addr":"부산 사하구 괴정동","dong":"괴정동","lat":35.098937,"lng":128.994066},
  {"id":22,"brand":"뉴코아아울렛","name":"덕천점","addr":"부산 북구 덕천동","dong":"덕천동","lat":35.211104,"lng":129.007605},
  {"id":23,"brand":"뉴코아아울렛","name":"동수원점","addr":"경기 수원시 팔달구 인계로 154","dong":"인계동","lat":37.266301,"lng":127.034536},
  {"id":24,"brand":"뉴코아아울렛","name":"부천점","addr":"경기 부천시 송내대로 239","dong":"상동","lat":37.504566,"lng":126.757187},
  {"id":25,"brand":"뉴코아아울렛","name":"산본점","addr":"경기 군포시 산본동","dong":"산본동","lat":37.357783,"lng":126.932562},
  {"id":26,"brand":"뉴코아아울렛","name":"울산2점","addr":"울산 중구 성남동","dong":"성남동","lat":35.554404,"lng":129.321441},
  {"id":27,"brand":"뉴코아아울렛","name":"울산점","addr":"울산 남구 삼산로 217","dong":"달동","lat":35.538481,"lng":129.330734},
  {"id":28,"brand":"뉴코아아울렛","name":"인천점","addr":"인천 남동구 인하로 485","dong":"구월동","lat":37.444267,"lng":126.700754},
  {"id":29,"brand":"뉴코아아울렛","name":"일산점","addr":"경기 고양시 일산동구 중앙로 1206","dong":"마두동","lat":37.65452,"lng":126.77678},
  {"id":30,"brand":"뉴코아아울렛","name":"창원점","addr":"경남 창원시 의창구 창원대로397번길 6","dong":"팔용동","lat":35.234533,"lng":128.642249},
  {"id":31,"brand":"뉴코아아울렛","name":"평촌2점","addr":"경기 안양시 동안구 호계동","dong":"호계동","lat":37.389184,"lng":126.951189},
  {"id":32,"brand":"뉴코아아울렛","name":"평택점","addr":"경기 평택시 경기대로 279","dong":"비전동","lat":36.995475,"lng":127.112502},
  {"id":33,"brand":"2001아울렛","name":"부평점","addr":"인천 부평구 경원대로 1277","dong":"산곡동","lat":37.490614,"lng":126.710149},
  {"id":34,"brand":"2001아울렛","name":"분당점","addr":"경기 성남시 분당구 미금일로154번길 20","dong":"구미동","lat":37.349049,"lng":127.10744},
  {"id":35,"brand":"2001아울렛","name":"안양점","addr":"경기 안양시 만안구 안양로 275","dong":"안양동","lat":37.396706,"lng":126.922694},
  {"id":36,"brand":"2001아울렛","name":"중계점","addr":"서울 노원구 동일로204가길 46","dong":"중계동","lat":37.641304,"lng":127.067988},
  {"id":37,"brand":"2001아울렛","name":"천호2점","addr":"서울 강동구 구천면로 189","dong":"천호동","lat":37.541205,"lng":127.125953},
  {"id":38,"brand":"동아백화점","name":"강북점","addr":"대구 북구 칠곡중앙대로 416","dong":"읍내동","lat":35.933041,"lng":128.548981},
  {"id":39,"brand":"동아백화점","name":"구미점","addr":"경북 구미시 송원동로 28","dong":"송정동","lat":36.119756,"lng":128.348535},
  {"id":40,"brand":"동아백화점","name":"쇼핑점","addr":"대구 중구 달구벌대로 2085","dong":"덕산동","lat":35.866314,"lng":128.591847},
  {"id":41,"brand":"동아백화점","name":"수성점","addr":"대구 수성구 지범로 191","dong":"범물동","lat":35.821137,"lng":128.640387}
];

export const TIER_COUNTS: Record<Tier, number> = {
  "동일상권": 2,
  "인접상권": 5,
  "근접권": 8,
  "별도상권": 18,
};

export const TOTAL_BRANDS = 168;
