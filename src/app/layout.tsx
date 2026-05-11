import type { Metadata } from "next";
import { JetBrains_Mono, Archivo_Black } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// 모노 — KPI 숫자/코드
const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

// 디스플레이 — 큰 헤드라인 (영문)
const archivoBlack = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "lifestyle — 이랜드리테일",
  description: "이랜드리테일 lifestyle 컨텐츠 운영 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${jetbrains.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF7EC] text-[#0a0a0a]">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-none !border-[2px] !border-[#0a0a0a] !shadow-[4px_4px_0_0_#0a0a0a] !text-[13px] !font-medium !bg-white",
              success: "!text-emerald-700",
              error: "!text-rose-600",
            },
          }}
        />
      </body>
    </html>
  );
}
