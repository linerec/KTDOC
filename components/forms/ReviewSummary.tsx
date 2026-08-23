'use client';

/**
 * ReviewSummary — 제출 버튼 바로 위의 "내 신청 내역"
 *
 * 신청서가 길다. 과목은 화면 위쪽에서 고르고 제출 버튼은 한참 아래인데, 내려오는
 * 동안 무엇을 골랐는지 잊는다. 확인하려면 위로 되짚어 올라가야 했고, 그 김에
 * 페이지를 떠나면 쓰던 것이 사라졌다.
 *
 * **아직 안 고른 것은 비워 두고 눌러서 갈 수 있게 한다.** 요약이 "다 채웠다"고
 * 말하는 화면이 아니라 **무엇이 비었는지 보여주는 화면**이기도 하다. 제출 버튼을
 * 눌러 빨간 글씨를 만나기 전에 여기서 먼저 알 수 있다.
 *
 * **동의는 세기만 한다.** 동의 문구는 한 문장이 통째로 라벨이라 낱낱이 실으면
 * 요약이 신청서만큼 길어진다 — 여기서 알아야 할 것은 남은 동의가 있는가뿐이다.
 *
 * **금액은 없다.** 학비는 지금도 확인 후 개별 안내이고, 그 정책을 이 요약이
 * 바꾸지 않는다. 무엇을 신청했는지만 되짚어 준다.
 */

import { useT } from '@/lib/i18n/useT';
import type { FormSummary } from '@/lib/forms/summary';

interface ReviewSummaryProps {
  summary: FormSummary;
  /** 비어 있는 항목을 눌렀을 때 그 문항으로 데려간다. */
  onJump: (questionKey: string) => void;
}

export default function ReviewSummary({ summary, onJump }: ReviewSummaryProps) {
  const t = useT();
  const { lines, consents } = summary;

  return (
    <section className="form-review" aria-labelledby="form-review-title">
      <h2 className="form-review-title" id="form-review-title">
        {t('forms.review.title', '내 신청 내역')}
      </h2>
      <p className="form-review-lead">
        {t('forms.review.lead', '아래 내용으로 접수됩니다. 고치실 것이 있으면 항목을 눌러 주세요.')}
      </p>

      <dl className="form-review-list">
        {lines.map((line) => (
          <div key={line.key} className={`form-review-row form-review-${line.kind}`}>
            <dt className="form-review-label">{line.label}</dt>
            <dd className="form-review-value">
              {line.values.length === 0 ? (
                <button type="button" className="form-review-empty" onClick={() => onJump(line.key)}>
                  {t('forms.review.empty', '아직 고르지 않으셨습니다 — 고르러 가기')}
                </button>
              ) : line.values.length === 1 ? (
                <span>{line.values[0]}</span>
              ) : (
                <ul className="form-review-multi">
                  {line.values.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        ))}

        {consents && (
          <div className="form-review-row form-review-consent">
            <dt className="form-review-label">{t('forms.review.consents', '동의 항목')}</dt>
            <dd className="form-review-value">
              {consents.firstMissingKey ? (
                <button
                  type="button"
                  className="form-review-empty"
                  onClick={() => onJump(consents.firstMissingKey!)}
                >
                  {t('forms.review.consentsLeft', '{total}개 중 {done}개 확인함 — 남은 항목 보러 가기', {
                    total: consents.total,
                    done: consents.done,
                  })}
                </button>
              ) : (
                <span>
                  {t('forms.review.consentsDone', '{total}개 모두 확인함', { total: consents.total })}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <p className="form-review-note">
        {t(
          'forms.review.tuitionNote',
          '등록금은 선택하신 과목과 등록 기간에 따라 정해집니다. 최종 등록금과 결제 방법은 신청 내용을 확인한 후 개별 안내드립니다.'
        )}
      </p>
    </section>
  );
}
