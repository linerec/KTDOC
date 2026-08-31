/**
 * 무차별 대입 차단 — "이 사람을 지금 들여보내도 되는가" (순수 함수)
 *
 * 번호는 여섯 자리(90만 가지), 비밀번호는 네 자리부터(1만 가지)다. 둘 다
 * 사람이 외울 수 있는 크기라, 기계가 순서대로 두드리는 것을 세지 않으면
 * 언젠가는 열린다.
 *
 * 두 겹으로 센다:
 *  - **같은 IP**가 짧은 시간에 여러 번 틀리면 그 IP를 잠깐 막는다.
 *  - 그것만으로는 여러 대를 동원한 훑기를 못 막으므로, **자료함 전체**의
 *    실패도 훨씬 높은 한도로 함께 본다.
 *
 * 자료함 전체를 잠그면 진짜 쓰는 사람도 막힌다 — 그래서 한도를 IP의 여섯 배로
 * 두고 잠금 시간은 절반으로 짧게 잡았다. 공격을 늦추는 것이 목적이지 완전히
 * 세우는 것이 아니다.
 *
 * 저장은 resource_access_log의 unlock_fail 행이 대신한다. 표를 따로 두지 않는
 * 이유는, 어차피 "누가 언제 두드렸나"를 저작권 때문에 남겨야 하기 때문이다.
 */

/** 실패를 세는 창 */
export const FAIL_WINDOW_MS = 10 * 60 * 1000;

/** 한 IP가 이만큼 틀리면 막는다 */
export const IP_FAIL_LIMIT = 10;

/** 자료함 전체가 이만큼 틀리면 잠근다(여러 IP 동원 대비) */
export const VAULT_FAIL_LIMIT = 60;

export const IP_BLOCK_MS = 10 * 60 * 1000;
export const VAULT_BLOCK_MS = 5 * 60 * 1000;

export interface FailureSample {
  /** 모를 수도 있다(프록시·직접 호출) */
  ipHash: string | null;
  /** epoch ms */
  at: number;
}

export interface RateLimitVerdict {
  blocked: boolean;
  reason: 'ip' | 'vault' | null;
  /** 화면에 "잠시 후 다시" 를 말할 때 쓴다. 통과면 0. */
  retryAfterMs: number;
}

const PASS: RateLimitVerdict = { blocked: false, reason: null, retryAfterMs: 0 };

export function evaluateRateLimit(input: {
  now: number;
  ipHash: string | null;
  failures: FailureSample[];
}): RateLimitVerdict {
  const { now, ipHash } = input;
  const since = now - FAIL_WINDOW_MS;
  const recent = (input.failures ?? []).filter((f) => f && f.at >= since && f.at <= now);
  if (!recent.length) return PASS;

  // ① 같은 IP — 더 좁은 사유이므로 먼저 본다.
  //    IP를 모르는 요청끼리는 묶지 않는다. "모른다"를 하나의 신원으로 치면
  //    프록시 뒤의 여러 사람이 서로를 막는다.
  if (ipHash) {
    const mine = recent.filter((f) => f.ipHash === ipHash);
    if (mine.length >= IP_FAIL_LIMIT) {
      const last = Math.max(...mine.map((f) => f.at));
      return { blocked: true, reason: 'ip', retryAfterMs: Math.max(1, last + IP_BLOCK_MS - now) };
    }
  }

  // ② 자료함 전체
  if (recent.length >= VAULT_FAIL_LIMIT) {
    const last = Math.max(...recent.map((f) => f.at));
    return {
      blocked: true,
      reason: 'vault',
      retryAfterMs: Math.max(1, last + VAULT_BLOCK_MS - now),
    };
  }

  return PASS;
}
