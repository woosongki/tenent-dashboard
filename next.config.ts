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
      // Next.js HMR + RSC payload + Kakao Maps SDK (dapi.kakao.com)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://dapi.kakao.com https://t1.daumcdn.net",
      // Tailwind inline styles + Recharts SVG + Kakao Maps inline styles
      "style-src 'self' 'unsafe-inline'",
      // Supabase API + Storage + Kakao Maps tile/API XHR
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "*"} wss://*.supabase.co https://dapi.kakao.com https://*.daumcdn.net`,
      // Kakao 지도 타일은 *.daumcdn.net 에서 로드 (https: 와일드카드로 이미 허용되지만 명시)
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "frame-ancestors 'none'",
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
};

export default nextConfig;
