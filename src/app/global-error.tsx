"use client";

// 루트 레이아웃 자체에서 발생한 에러를 잡는 최종 바운더리.
// global-error는 자체 <html>/<body>를 렌더해야 한다 (루트 레이아웃을 대체하므로).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#f5f5f0" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 480, width: "100%", border: "3px solid #0a0a0a", background: "#fff", padding: 28, boxShadow: "8px 8px 0 0 #0a0a0a" }}>
            <div style={{ display: "inline-block", border: "2px solid #0a0a0a", background: "#f87171", padding: "4px 12px", fontWeight: 700, fontSize: 12, marginBottom: 12 }}>
              FATAL ERROR
            </div>
            <h1 style={{ fontSize: 24, margin: 0, color: "#0a0a0a" }}>앱에 문제가 발생했어요</h1>
            <p style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
              예기치 못한 오류로 화면을 표시할 수 없습니다. 다시 시도해 주세요.
            </p>
            {error?.digest && (
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 12, fontFamily: "monospace", wordBreak: "break-all" }}>
                오류 코드: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ marginTop: 20, border: "3px solid #0a0a0a", background: "#fde047", padding: "10px 24px", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "4px 4px 0 0 #0a0a0a" }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
