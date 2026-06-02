import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 순수 로직(룰베이스 스코어링) 단위 테스트 — node 환경이면 충분
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // @/* → ./src/* (tsconfig paths 네이티브 해석)
    tsconfigPaths: true,
  },
});
