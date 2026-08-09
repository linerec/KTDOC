'use client';

/**
 * PushGuideModal — "알림이 뭔가요?" 가이드
 *
 * 알림 카드의 '알림이 뭔가요?' 버튼으로 연다. 컴퓨터를 잘 다루지 않는 학부모가
 * 혼자 읽고 끝까지 켤 수 있는 것이 목표라서, 아는 것을 전제하지 않고 쓴다:
 *  - 어려운 말(구독·푸시·권한)은 쓰지 않는다
 *  - 아이폰과 안드로이드·컴퓨터를 갈라서 각각 끝까지 안내한다
 *    (아이폰만 '홈 화면에 추가'가 먼저라 섞어 쓰면 둘 다 못 따라간다)
 *  - 안 될 때 무엇을 볼지까지 적는다 — 여기서 막히면 전화가 온다
 *
 * 문구는 전부 t()를 거친다(한국어·영어). 그림은 guideArt.tsx — 글자가 없으므로
 * 번역돼도 그대로 쓰인다.
 */

import { useState } from 'react';
import Modal from '@/components/common/Modal';
import { useT, type TFunction } from '@/lib/i18n/useT';
import {
  ArtPhoneNotice,
  ArtShare,
  ArtAddHome,
  ArtTapBell,
  ArtAllow,
  ArtDevices,
} from './guideArt';

/** 받는 소식이 역할마다 달라서 목록만 갈아 끼운다. */
export type GuideAudience = 'member' | 'staff';

function ExampleList({ t, audience }: { t: TFunction; audience: GuideAudience }) {
  const items =
    audience === 'staff'
      ? [
          t('push.guide.egStaff1', '새로 가입 신청한 분이 있을 때'),
          t('push.guide.egStaff2', '수업·공연 신청이 들어왔을 때'),
          t('push.guide.egStaff3', '공연 일정이 바뀌었을 때'),
        ]
      : [
          t('push.guide.egMember1', '공연·수업 일정이 정해지거나 바뀌었을 때'),
          t('push.guide.egMember2', '준비물이나 공지가 올라왔을 때'),
          t('push.guide.egMember3', '공연 사진이 새로 올라왔을 때'),
        ];
  return (
    <ul className="push-guide-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** 그림 + 설명 한 단계. */
function Step({ art, children }: { art: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="push-guide-step">
      <span className="push-guide-step-icon" aria-hidden="true">
        {art}
      </span>
      <span className="push-guide-step-text">{children}</span>
    </li>
  );
}

export default function PushGuideModal({
  audience = 'member',
}: {
  audience?: GuideAudience;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="push-guide-open" onClick={() => setOpen(true)}>
        {t('push.guide.open', '알림이 뭔가요?')}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        label={t('push.guide.title', '알림 안내')}
        title={t('push.guide.title', '알림 안내')}
        className="push-guide-modal"
      >
        <div className="push-guide">
          {/* 1. 알림이 뭔가 — 아는 말로 먼저 바꿔 준다 */}
          <section className="push-guide-hero">
            <div className="push-guide-hero-art" aria-hidden="true">
              <ArtPhoneNotice />
            </div>
            <div>
              <h3 className="push-guide-h">{t('push.guide.whatH', '알림이 뭔가요?')}</h3>
              <p className="push-guide-p">
                {t(
                  'push.guide.whatP',
                  '휴대폰 화면에 잠깐 떴다 사라지는 쪽지입니다. 카카오톡 메시지가 오는 것과 똑같다고 생각하시면 됩니다. 홈페이지를 열어 두지 않아도, 휴대폰이 잠겨 있어도 도착합니다.'
                )}
              </p>
              <p className="push-guide-note">
                {t(
                  'push.guide.whatFree',
                  '요금은 들지 않고, 전화번호를 알려 주지 않아도 됩니다. 문자메시지가 아니라 인터넷으로 오는 것이기 때문입니다.'
                )}
              </p>
            </div>
          </section>

          {/* 2. 무엇이 오나 */}
          <section>
            <h3 className="push-guide-h">{t('push.guide.whenH', '언제 오나요?')}</h3>
            <ExampleList t={t} audience={audience} />
            <p className="push-guide-note">
              {t(
                'push.guide.whenNote',
                '광고는 보내지 않습니다. 꼭 알아야 하는 일만 보냅니다.'
              )}
            </p>
          </section>

          {/* 3-A. 아이폰 — 설치가 먼저라 따로 뗀다 */}
          <section className="push-guide-how">
            <h3 className="push-guide-h">{t('push.guide.iosH', '아이폰(아이패드)에서 켜는 법')}</h3>
            <p className="push-guide-p">
              {t(
                'push.guide.iosLede',
                '아이폰은 홈 화면에 앱으로 먼저 추가해야 알림을 받을 수 있습니다. 애플이 그렇게 정해 두었습니다. 한 번만 하면 됩니다.'
              )}
            </p>
            <ol className="push-guide-steps">
              <Step art={<ArtShare />}>
                {t(
                  'push.guide.ios1',
                  'Safari로 이 홈페이지를 열고, 화면 아래쪽 가운데의 네모에서 위로 화살표가 나가는 모양을 누릅니다.'
                )}
              </Step>
              <Step art={<ArtAddHome />}>
                {t(
                  'push.guide.ios2',
                  '위로 올려 보면 ‘홈 화면에 추가’가 있습니다. 그것을 누르고 ‘추가’를 누릅니다. 홈 화면에 KTDOC 아이콘이 생깁니다.'
                )}
              </Step>
              <Step art={<ArtTapBell />}>
                {t(
                  'push.guide.ios3',
                  '이제 그 아이콘으로 다시 들어와서 ‘알림 켜기’ 버튼을 누릅니다. (Safari가 아니라 새로 생긴 아이콘으로 들어와야 합니다.)'
                )}
              </Step>
              <Step art={<ArtAllow />}>
                {t(
                  'push.guide.ios4',
                  '‘허용하시겠습니까?’ 하고 물어보면 ‘허용’을 누릅니다. 끝입니다.'
                )}
              </Step>
            </ol>
          </section>

          {/* 3-B. 안드로이드·컴퓨터 */}
          <section className="push-guide-how">
            <h3 className="push-guide-h">
              {t('push.guide.androidH', '안드로이드 휴대폰·컴퓨터에서 켜는 법')}
            </h3>
            <ol className="push-guide-steps">
              <Step art={<ArtTapBell />}>
                {t('push.guide.and1', '‘알림 켜기’ 버튼을 누릅니다.')}
              </Step>
              <Step art={<ArtAllow />}>
                {t(
                  'push.guide.and2',
                  '화면 위쪽에 ‘알림을 표시하시겠습니까?’ 하고 작은 창이 뜹니다. ‘허용’을 누릅니다. 끝입니다.'
                )}
              </Step>
            </ol>
            <p className="push-guide-note">
              {t(
                'push.guide.andNote',
                '이 창은 한 번만 물어봅니다. 실수로 ‘차단’을 눌렀다면 아래 ‘알림이 안 와요’를 봐 주세요.'
              )}
            </p>
          </section>

          {/* 4. 기기마다 따로 — 가장 자주 헷갈리는 대목이라 따로 세운다 */}
          <section className="push-guide-hero">
            <div className="push-guide-hero-art" aria-hidden="true">
              <ArtDevices />
            </div>
            <div>
              <h3 className="push-guide-h">
                {t('push.guide.deviceH', '기기마다 한 번씩 켜야 합니다')}
              </h3>
              <p className="push-guide-p">
                {t(
                  'push.guide.deviceP',
                  '휴대폰에서 켰다고 컴퓨터에도 켜지지 않습니다. 알림을 받고 싶은 기기마다 그 기기에서 한 번씩 켜 주세요. 보통은 휴대폰 하나면 충분합니다.'
                )}
              </p>
            </div>
          </section>

          {/* 5. 끄기 */}
          <section>
            <h3 className="push-guide-h">{t('push.guide.offH', '그만 받고 싶으면')}</h3>
            <p className="push-guide-p">
              {t(
                'push.guide.offP',
                '언제든 끌 수 있습니다. 왼쪽 메뉴에서 ‘내 프로필’로 들어가면 ‘알림 끄기’ 버튼이 있습니다. 다시 켜는 것도 같은 자리에서 합니다.'
              )}
            </p>
          </section>

          {/* 6. 안 될 때 — 여기서 막히면 전화가 오므로 아낌없이 적는다 */}
          <section>
            <h3 className="push-guide-h">{t('push.guide.troubleH', '알림이 안 와요')}</h3>
            <ul className="push-guide-list">
              <li>
                {t(
                  'push.guide.trouble1',
                  '먼저 ‘내 프로필’에서 ‘테스트 알림 받기’를 눌러 보세요. 이것이 오면 잘 켜진 것입니다.'
                )}
              </li>
              <li>
                {t(
                  'push.guide.trouble2',
                  '아이폰인데 홈 화면 아이콘이 아니라 Safari에서 열었다면 오지 않습니다. 아이콘으로 들어와 주세요.'
                )}
              </li>
              <li>
                {t(
                  'push.guide.trouble3',
                  '실수로 ‘차단’을 눌렀다면 — 아이폰은 [설정 → 알림 → KTDOC], 안드로이드·컴퓨터는 주소창 왼쪽 자물쇠 → 알림에서 ‘허용’으로 바꿔 주세요.'
                )}
              </li>
              <li>
                {t(
                  'push.guide.trouble4',
                  '휴대폰이 방해금지 모드이거나 소리가 꺼져 있으면 조용히 들어옵니다. 알림 목록을 내려서 확인해 보세요.'
                )}
              </li>
            </ul>
            <p className="push-guide-note">
              {t(
                'push.guide.troubleTail',
                '그래도 안 되면 학원으로 알려 주세요. 놓친 알림은 왼쪽 메뉴 ‘내 알림’에 그대로 남아 있으니 안심하셔도 됩니다.'
              )}
            </p>
          </section>

          <div className="push-guide-close">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setOpen(false)}
            >
              {t('push.guide.done', '알겠습니다')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
