import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control",  value: "on" },
  { key: "X-Frame-Options",         value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",  value: "nosniff" },
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js HMR + RSC payload + Kakao Maps SDK + Leaflet CDN (홈플 이슈맵)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://dapi.kakao.com https://t1.daumcdn.net https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
      // Tailwind inline styles + Recharts SVG + Kakao Maps inline styles + Leaflet/Pretendard CDN
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
      // Supabase API + Storage + Kakao Maps tile/API XHR
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "*"} wss://*.supabase.co https://dapi.kakao.com https://*.daumcdn.net`,
      // Kakao 지도 타일은 *.daumcdn.net 에서 로드 (https: 와일드카드로 이미 허용되지만 명시)
      "img-src 'self' data: blob: https:",
      // Pretendard 폰트는 jsdelivr CDN
      "font-src 'self' https://cdn.jsdelivr.net",
      // 같은 origin iframe 허용 (예: /dashboard/homeplus → /homeplus-map.html)
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // 프로덕션 빌드에서만 보안 헤더 적용 (개발 시 CSP 오류 방지)
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // 서버 컴포넌트에서 외부 이미지를 사용한다면 아래에 도메인 추가
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // 빌드 시 타입 오류를 CI에서 명시적으로 잡도록 설정
  typescript: { ignoreBuildErrors: false },

  // Server Actions 바디 크기 — 도면 업로드용 (기본 1MB → 25MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
