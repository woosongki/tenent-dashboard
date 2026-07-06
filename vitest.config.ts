import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // 순수 로직(룰베이스 스코어링) 단위 테스트 — node 환경이면 충분
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // @/* → ./src/* (tsconfig paths 네이티브 해석)
    tsconfigPaths: true,
    alias: {
      // 'server-only' 가드는 노드 테스트에서 throw → 빈 모듈로 대체해 서버 로직도 테스트 가능
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
});
