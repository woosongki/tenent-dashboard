// 경량 인메모리 레이트 리미터 (외부 유료 API 비용 보호용)
//
// ⚠ 한계: Vercel 서버리스에서는 인스턴스(람다)별로 메모리가 분리되어
//   완벽한 전역 제한은 아님. 단, 같은 인스턴스에서의 연속 폭주(burst)는 막아
//   비용 폭탄을 실질적으로 완화한다. 엄격한 전역 제한이 필요해지면
//   Upstash Redis 등 외부 스토어로 교체.
//
// 사용:
//   const limited = rateLimit(`meetings-candidates:${userId}`, { limit: 30, windowMs: 60_000 });
//   if (limited) return Response.json({ error: limited.message }, { status: 429 });

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export interface RateLimitOptions {
  /** 윈도 내 허용 횟수 */
  limit: number;
  /** 윈도 길이 (ms) */
  windowMs: number;
}

export interface RateLimitResult {
  /** 남은 호출 가능 횟수 */
  remaining: number;
  /** 윈도 리셋까지 남은 초 */
  retryAfter: number;
  /** 사용자 표시용 메시지 */
  message: string;
}

/**
 * 호출 시 카운트를 1 증가시키고, 한도를 초과하면 RateLimitResult를 반환한다.
 * 한도 이내면 null을 반환한다 (= 통과).
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult | null {
  const now = Date.now();

  // 만료된 버킷 주기적 정리 (1분에 한 번, 메모리 누수 방지)
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
    lastSweep = now;
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > opts.limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return {
      remaining: 0,
      retryAfter,
      message: `요청이 너무 잦습니다. ${retryAfter}초 후 다시 시도해주세요.`,
    };
  }

  return null;
}
