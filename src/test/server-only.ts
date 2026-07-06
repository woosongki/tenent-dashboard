// vitest 스텁 — 실제 'server-only' 패키지는 클라이언트 번들에 섞이면 throw 하도록
// 설계돼 있어, 노드 테스트 환경에서 서버 모듈을 import 하면 실패한다.
// vitest.config.ts 에서 'server-only' → 이 빈 모듈로 alias 해 서버 로직도 단위 테스트 가능.
export {};
