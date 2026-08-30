'use client';

/**
 * ReadinessPanel — "이 신청서, 지금 내보내도 되나"를 한눈에
 *
 * 이 설계의 최대 약점은 **조용한 실패**다. 과목에 수업을 연결하지 않아도 폼은
 * 멀쩡히 돌아가고 응답도 잘 쌓이는데, 정작 명단이 나오지 않는다.
 * 그 사실을 화면에 끌어올리는 것이 이 패널의 유일한 일이다.
 *
 * 문구 규칙: "파생 인덱스", "바인딩" 같은 말을 쓰지 않는다.
 * 원장이 읽고 무엇을 해야 하는지 알 수 있는 문장만 쓴다.
 */

interface ReadinessPanelProps {
  warnings: string[];
  dirtyCount: number;
  consentCount: number;
  locked: boolean;
}

export default function ReadinessPanel({
  warnings,
  dirtyCount,
  consentCount,
  locked,
}: ReadinessPanelProps) {
  return (
    <section className="readiness" aria-label="운영 준비 상태">
      <h2 className="readiness-title">운영 준비 상태</h2>

      <ul className="readiness-list">
        <li className="readiness-ok">
          <span className="readiness-mark" aria-hidden="true">
            ✓
          </span>
          <span>회원 정보 자동 채우기 — 준비됨</span>
        </li>

        <li className={consentCount > 0 ? 'readiness-ok' : 'readiness-info'}>
          <span className="readiness-mark" aria-hidden="true">
            {consentCount > 0 ? '✓' : 'ℹ'}
          </span>
          <span>
            {consentCount > 0
              ? `필수 동의 ${consentCount}건 — 제출할 때 기록으로 남습니다`
              : '동의 항목이 없습니다'}
          </span>
        </li>

        {warnings.map((w) => (
          <li key={w} className="readiness-warn">
            <span className="readiness-mark" aria-hidden="true">
              ✗
            </span>
            <span>{w}</span>
          </li>
        ))}

        {dirtyCount > 0 && (
          <li className="readiness-info">
            <span className="readiness-mark" aria-hidden="true">
              ℹ
            </span>
            <span>명단에 아직 반영되지 않은 응답 {dirtyCount}건 — 잠시 후 자동 반영됩니다</span>
          </li>
        )}

        {locked && (
          <li className="readiness-info">
            <span className="readiness-mark" aria-hidden="true">
              ℹ
            </span>
            <span>
              이미 제출된 응답이 있어 <strong>문항과 선택지 구조가 잠겼습니다.</strong> 문구 수정과
              항목 추가는 그대로 됩니다.
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
