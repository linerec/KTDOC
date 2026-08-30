import type { Metadata } from 'next';
import { ParadeBannerArt, DrumBannerArt } from './BannerArt';
import ConfirmForm from './ConfirmForm';

export const metadata: Metadata = {
  title: '인쇄물 도안 확인 — 퍼레이드 배너 · 북 배너',
};

export default function BannerConfirmPage() {
  return (
    <main className="cb-page">
      <header className="cb-head">
        <p className="cb-eyebrow">춤누리 · 인쇄물 도안</p>
        <h1 className="cb-title">퍼레이드 배너 · 북 배너</h1>
        <p className="cb-lede">
          행진용 3폭 배너와 북 배너 도안입니다. 보시고 아래에서 알려 주시면
          그대로 고쳐 인쇄에 넘깁니다.
        </p>
      </header>

      <section className="cb-section">
        <div className="cb-section__head">
          <h2>배너 A · 퍼레이드</h2>
          <p className="cb-spec">84 × 28 in · 3폭 연결</p>
        </div>
        <div className="cb-stage">
          <ParadeBannerArt />
        </div>
        <p className="cb-hint">폰을 가로로 돌리시면 크게 보입니다.</p>
        <ul className="cb-notes">
          <li>점선은 천이 갈라지는 자리(28 · 56인치)입니다. 로고와 국기는 그 위를 피했습니다.</li>
          <li>행진하는 주체가 춤누리이므로 KTDOC를 가장 크게 두고, KHPAF는 가로로 받아 높이를 낮췄습니다.</li>
          <li>좌상 홍 · 우하 청은 지금 쓰시는 배너의 모서리를 그대로 가져왔습니다.</li>
        </ul>
      </section>

      <section className="cb-section">
        <div className="cb-section__head">
          <h2>배너 B · 북 배너</h2>
          <p className="cb-spec">19 × 23 in · 세로형</p>
        </div>
        <div className="cb-stage cb-stage--drum">
          <DrumBannerArt />
        </div>
        <ul className="cb-notes">
          <li>점선 위 약 4.6인치는 북 윗면을 넘어가 정면에서 보이지 않습니다. 그래서 비웠습니다.</li>
          <li>로고는 종이 한가운데가 아니라 보이는 면(점선 아래) 기준으로 가운데입니다.</li>
          <li>위 모서리는 접혀 사라지므로 모서리 색을 아래 두 귀퉁이로 내렸습니다.</li>
        </ul>
      </section>

      <ConfirmForm />

      <section className="cb-section cb-blocker">
        <h2>한 가지 먼저 확인이 필요합니다</h2>
        <p>
          KTDOC 로고의 원본 파일(AI · EPS · SVG)이 있어야 합니다. 지금 가진 가장 큰
          파일은 400 × 242 픽셀이라, 실제 인쇄 크기로 환산하면 퍼레이드 배너에서 약
          17 DPI, 북 배너에서 약 27 DPI입니다. 배너 인쇄는 150 DPI 이상을 권합니다.
        </p>
        <p>
          로고를 만든 곳에 원본이 남아 있는지 확인 부탁드립니다. 원본이 없으면 벡터로
          다시 그려야 하고, 그 작업이 일정과 비용에 들어갑니다. 이 한 건이 두 배너
          모두를 막고 있습니다.
        </p>
        <p className="cb-blocker__sub">
          KHPAF 로고는 재단 공식 벡터 파일이라 그대로 인쇄할 수 있습니다. 태극기와
          성조기는 규격대로 작도했고, 최종본은 정부 표준 파일로 바꾸는 편이 안전합니다.
          한글 서체는 임시이며 인쇄용 라이선스를 확인한 뒤 정합니다.
        </p>
      </section>
    </main>
  );
}
