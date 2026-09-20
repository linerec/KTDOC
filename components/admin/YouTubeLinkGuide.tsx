'use client';

/**
 * YouTubeLinkGuide — "링크를 어떻게 가져오나요?"
 *
 * 링크를 넣는 칸 바로 아래에 접어 둔다. 별도 도움말 페이지를 만들면 아무도 열지 않는다.
 * 문장은 'URL'·'임베드' 같은 말을 쓰지 않고, 손가락이 눌러야 할 것만 순서대로 적는다.
 * 목적은 원리 설명이 아니라 **"아, 이렇게 하면 되는구나"** 하나다.
 */

import { useT } from '@/lib/i18n/useT';

interface Props {
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

export default function YouTubeLinkGuide({ open, onToggle }: Props) {
  const t = useT();
  return (
    <details
      className="yt-guide"
      open={open}
      onToggle={(e) => onToggle?.((e.target as HTMLDetailsElement).open)}
    >
      <summary className="yt-guide-summary">
        {t('admin.youtube.guide.open', '링크를 어떻게 가져오나요?')}
      </summary>
      <div className="yt-guide-body">
        <p className="yt-guide-lead">
          {t(
            'admin.youtube.guide.lead',
            '유튜브에서 복사한 것을 그대로 붙여넣으시면 됩니다. 주소 모양은 신경 쓰지 않으셔도 됩니다.'
          )}
        </p>
        <div className="yt-guide-cols">
          <div className="yt-guide-col">
            <h4 className="yt-guide-head">{t('admin.youtube.guide.phone', '휴대폰 · 태블릿')}</h4>
            <ol className="yt-guide-steps">
              <li>{t('admin.youtube.guide.phone1', '유튜브 앱에서 올리고 싶은 영상을 엽니다')}</li>
              <li>{t('admin.youtube.guide.phone2', '영상 아래 ‘공유’를 누릅니다')}</li>
              <li>{t('admin.youtube.guide.phone3', '‘복사’(링크 복사)를 누릅니다')}</li>
              <li>{t('admin.youtube.guide.phone4', '위 칸을 꾹 눌러 ‘붙여넣기’를 누릅니다')}</li>
            </ol>
          </div>
          <div className="yt-guide-col">
            <h4 className="yt-guide-head">{t('admin.youtube.guide.pc', '컴퓨터')}</h4>
            <ol className="yt-guide-steps">
              <li>{t('admin.youtube.guide.pc1', '유튜브에서 올리고 싶은 영상을 엽니다')}</li>
              <li>
                {t(
                  'admin.youtube.guide.pc2',
                  '화면 맨 위 주소창을 한 번 클릭합니다 (글자가 파랗게 선택됩니다)'
                )}
              </li>
              <li>{t('admin.youtube.guide.pc3', 'Ctrl 키를 누른 채 C 를 누릅니다')}</li>
              <li>{t('admin.youtube.guide.pc4', '위 칸을 클릭하고 Ctrl 키를 누른 채 V 를 누릅니다')}</li>
            </ol>
          </div>
        </div>
        <p className="yt-guide-note">
          {t(
            'admin.youtube.guide.note',
            '쇼츠(세로 영상)도 그대로 됩니다. 붙여넣으면 아래에 영상이 나타납니다 — 그 영상이 맞는지만 확인해 주세요.'
          )}
        </p>
      </div>
    </details>
  );
}
