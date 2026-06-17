import type { MetadataRoute } from "next";

// PWA 매니페스트 — 홈화면 설치(아이콘) 지원
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "lifestyle — 이랜드리테일",
    short_name: "lifestyle",
    description: "이랜드리테일 lifestyle 컨텐츠 운영 대시보드",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAF7EC",
    theme_color: "#0a0a0a",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
