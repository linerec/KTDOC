/**
 * 공연 자료함 사용법 — 운영진용 안내
 *
 * "가이드가 없어서 아무도 이게 뭔지 모를 것 같다"에서 출발했다. 그래서 이 페이지의
 * 첫 일은 기능 설명이 아니라 **무엇을 대신하는지** 말하는 것이다(USB와 노트북 세팅).
 *
 * 그림과 캡처의 역할을 갈라 두었다:
 *  - **캡처**(public/assets/guide/resources/*.webp)는 실제로 누를 화면이다. 우리 화면이라
 *    남의 상표가 찍히지 않고 우리 모르게 바뀌지도 않아, 유튜브 안내와 달리 캡처가 정직하다.
 *    캡처는 **가짜 자료함**(473128 · 2026 가을 정기공연 음원)을 렌더해서 찍었다 — 진짜를
 *    찍으면 실제 번호와 비밀번호가 안내 페이지에 박제되고, 그 둘이 저작권 자료를 여는
 *    열쇠다. 다시 찍어야 하면 이 머리말과 같은 방식으로 지그를 세워 찍을 것.
 *  - **그림**(VaultGuideFigures)은 캡처로 찍을 수 없는 것만 맡는다: 전체 흐름과
 *    "번호는 주소, 비밀번호는 열쇠"라는 머릿속 그림. 둘 다 어느 한 화면에도 없다.
 *
 * 화면에 있는 그대로의 버튼 이름을 쓴다(‘생성’·‘새로 뽑기’·‘받기 링크 모두 무효화’).
 * 화면과 글자가 다르면 안내가 아니라 수수께끼가 된다.
 *
 * 문체는 /admin/forms/guide와 같은 차분한 합니다체. 한국어 전용도 그 페이지와 같다.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  FigAddress,
  FigHandOff,
  FigKey,
  FigOpen,
  FigUpload,
} from '@/components/admin/resources/VaultGuideFigures';

export const metadata: Metadata = {
  title: '공연 자료함 사용법 | KTDOC Admin',
};

const SHOT = '/assets/guide/resources';

/** 캡처 한 장 — 액자에 넣어 "지금 이 페이지"가 아니라 "저기 그 화면"으로 읽히게 한다 */
function Shot({
  src,
  alt,
  caption,
  width,
  height,
  narrow,
}: {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  narrow?: boolean;
}) {
  return (
    <figure className={`rvg-shot${narrow ? ' rvg-shot--narrow' : ''}`}>
      {/* 안내 페이지에서 그림은 곁다리가 아니라 본문이다. 여덟 장을 합쳐 144KB라
          게으른 로딩으로 아낄 것이 없고, 스크롤할 때 빈 액자가 먼저 보이지도 않는다. */}
      <Image src={`${SHOT}/${src}`} alt={alt} width={width} height={height} loading="eager" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default async function ResourcesGuidePage() {
  const session = await auth();
  await requireMenuAccess(session, 'resources');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/resources">공연 자료함</Link>
            <span>/</span>
            <span>사용법</span>
          </div>
          <h1 className="admin-title">공연 자료함 사용법</h1>
          <p className="admin-subtitle">
            음원을 USB에 담아 다니는 대신, 번호 하나로 공연장에서 엽니다. 처음이시라면 이
            페이지를 위에서부터 한 번만 읽어 보시면 됩니다.
          </p>
        </div>
      </div>

      <div className="guide">
        {/* ── 무엇을 대신하나 ─────────────────────────────────── */}
        <section className="admin-card guide-section">
          <h2>무엇을 대신하나요</h2>
          <p>
            지금까지는 공연 때마다 음원을 USB에 담아 가서 공연장 컴퓨터에 옮겨 두어야 했습니다.
            USB를 두고 오거나, 파일이 안 열리거나, 순서가 섞이는 일이 그래서 생깁니다.
          </p>
          <p>
            자료함은 그 USB를 <strong>여섯 자리 번호</strong> 하나로 바꿉니다. 미리 올려 두면,
            공연장에서는 인터넷이 되는 아무 기기(휴대폰·태블릿·공연장 컴퓨터)에서{' '}
            <strong>ktdoc.org/473128</strong> 처럼 번호만 붙여 열고 바로 재생합니다.
          </p>

          <div className="rvg-flow">
            <div className="rvg-step">
              <FigUpload />
              <p className="rvg-step-text">
                공연 전에 이 화면에서
                <br />
                음원을 올려 둡니다
              </p>
            </div>
            <div className="rvg-step">
              <FigHandOff />
              <p className="rvg-step-text">
                현장 담당자에게 번호와
                <br />
                비밀번호를 알려 줍니다
              </p>
            </div>
            <div className="rvg-step">
              <FigOpen />
              <p className="rvg-step-text">
                공연장에서 번호로 열고
                <br />
                바로 재생합니다
              </p>
            </div>
          </div>

          <p className="admin-field-help">
            설치할 프로그램도, 만들어 줄 계정도 없습니다. 현장 담당자는 회원이 아니어도 됩니다.
          </p>
        </section>

        {/* ── 번호와 비밀번호 ─────────────────────────────────── */}
        <section className="admin-card guide-section">
          <h2>번호와 비밀번호는 다른 물건입니다</h2>
          <p>
            이 둘을 같은 것으로 생각하면 자료함이 왜 안전한지가 헷갈립니다. 하나는 주소이고
            하나는 열쇠입니다.
          </p>

          <div className="rvg-pair">
            <div className="rvg-pair__item">
              <FigAddress />
              <div>
                <h3>번호 — 주소입니다</h3>
                <p>
                  <strong>473128</strong> 같은 여섯 자리입니다. 이걸 아는 사람은 문 앞까지 옵니다.
                  하지만 <strong>열리지는 않습니다.</strong> 잠긴 화면만 보입니다. 그 화면은 자료함
                  제목도, 비밀번호가 몇 자리인지도 말하지 않습니다.
                </p>
              </div>
            </div>
            <div className="rvg-pair__item">
              <FigKey />
              <div>
                <h3>비밀번호 — 열쇠입니다</h3>
                <p>
                  숫자 <strong>4~8자리</strong>입니다. 이것이 있어야 열립니다. 10분 안에 10번을
                  틀리면 그 기기는 10분 동안 막힙니다 — 번호를 찍어 보며 뚫는 일을 막습니다.
                </p>
              </div>
            </div>
          </div>

          <p className="admin-field-help">
            그래서 번호는 전화로 편하게 불러 주셔도 됩니다. 조심하실 것은 비밀번호 쪽입니다.
            계정 로그인 비밀번호와는 <strong>다른 번호</strong>를 쓰세요.
          </p>
        </section>

        {/* ── ① 만들기 ───────────────────────────────────────── */}
        <section className="admin-card guide-section">
          <h2>① 자료함 만들기</h2>
          <p>
            공연 자료함 화면 오른쪽 위 <strong>+ 새 자료함</strong>을 누릅니다. 보통 공연 하나에
            자료함 하나입니다.
          </p>

          <Shot
            src="new.webp"
            width={841}
            height={822}
            narrow
            alt="새 자료함 만들기 창. 제목, 비밀번호, 내려받기 허용, 이메일로 받기 허용 항목이 있다."
            caption="+ 새 자료함을 누르면 뜨는 창"
          />

          <dl className="guide-dl">
            <dt>제목</dt>
            <dd>
              나중에 목록에서 찾을 이름입니다. 공연 이름을 그대로 쓰시면 됩니다. 현장 담당자에게는
              보이지 않습니다 — 잠긴 화면에는 제목이 나오지 않습니다.
            </dd>
            <dt>비밀번호</dt>
            <dd>
              무작위로 하나 미리 뽑아 둡니다. 마음에 들지 않으면 <strong>새로 뽑기</strong>를
              누르거나 직접 지우고 쓰셔도 됩니다(숫자 4~8자리). 잊어버리셔도 괜찮습니다 — 나중에
              자료함 화면에서 다시 확인하실 수 있습니다.
            </dd>
            <dt>내려받기 허용</dt>
            <dd>
              현장 담당자가 파일을 자기 기기에 받아 둘 수 있게 합니다. 공연장 인터넷이 불안할 때
              미리 받아 두면 안전하니, 보통은 켜 두시면 됩니다.
            </dd>
            <dt>이메일로 받기 허용</dt>
            <dd>
              현장 담당자가 자기 주소를 넣으면 메일이 갑니다. 메일에 담기는 것은{' '}
              <strong>파일이 아니라 링크</strong>이고, 그 링크는 24시간 뒤 만료됩니다.
            </dd>
          </dl>

          <p>
            <strong>생성</strong>을 누르면 번호가 자동으로 붙고 자료함 화면으로 넘어갑니다. 번호는
            우리가 고르는 것이 아니라 시스템이 뽑습니다.
          </p>
        </section>

        {/* ── ② 올리기 ───────────────────────────────────────── */}
        <section className="admin-card guide-section">
          <h2>② 음원 올리기</h2>
          <p>
            자료함 화면 가운데 <strong>파일</strong> 칸에서 올립니다. 파일 고르는 버튼을 눌러
            여러 개를 한 번에 선택하셔도 됩니다.
          </p>

          <Shot
            src="files.webp"
            width={1400}
            height={614}
            alt="파일 목록. 곡마다 순서 번호, 제목, 파일명·용량·재생시간이 보이고 오른쪽에 위·아래·삭제 버튼이 있다."
            caption="올린 파일은 공연 순서대로 정렬해 둘 수 있습니다"
          />

          <ol className="guide-ol">
            <li>
              <strong>올릴 수 있는 것.</strong> 음원(mp3·wav 등), PDF, 이미지입니다. 한 개당
              100MB까지 — 보통 음원 한 곡이 10~20MB이니 넉넉합니다. 무대 순서표 PDF를 함께 올려
              두시는 분들이 많습니다.
            </li>
            <li>
              <strong>이름은 눌러서 바꿉니다.</strong> 제목을 한 번 누르면 바로 고칠 수 있습니다.
              파일 이름이 <code>track01.mp3</code> 처럼 되어 있어도, 여기서{' '}
              <strong>1. 부채춤</strong> 으로 바꿔 두면 현장에서 헷갈리지 않습니다.
            </li>
            <li>
              <strong>순서는 ↑ ↓ 로 맞춥니다.</strong> 여기서 맞춰 둔 순서 그대로 공연장 화면에
              나옵니다. 공연 순서대로 두시면 현장에서 찾을 일이 없습니다.
            </li>
            <li>
              <strong>× 는 지우기입니다.</strong> 지우면 되돌릴 수 없으니 확인하고 눌러 주세요.
            </li>
          </ol>
        </section>

        {/* ── ③ 건네기 ───────────────────────────────────────── */}
        <section className="admin-card guide-section">
          <h2>③ 현장에 건네기</h2>
          <p>
            자료함 화면 맨 위에 번호·비밀번호·QR이 함께 있습니다. 이 화면을 여는 이유의 절반이
            그것이라 맨 위에 두었습니다.
          </p>

          <Shot
            src="head.webp"
            width={1400}
            height={575}
            alt="자료함 맨 위. 왼쪽에 큰 번호 473128과 주소, 비밀번호 8241, 오른쪽에 QR 코드와 공유하기·QR 복사 버튼."
            caption="비밀번호는 평소 가려져 있고, 보기를 눌러야 나옵니다"
          />

          <div className="admin-table-wrapper">
            <table className="admin-table guide-table">
              <thead>
                <tr>
                  <th>상황</th>
                  <th>이렇게 건넵니다</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>전화로 알려 주는 경우</td>
                  <td>
                    번호 여섯 자리와 비밀번호를 불러 주시면 됩니다. “ktdoc.org 뒤에 473128을
                    붙여서 여세요”.
                  </td>
                </tr>
                <tr>
                  <td>문자·카톡으로 보내는 경우</td>
                  <td>
                    목록에서 <strong>주소 복사</strong>를 누르고 붙여넣기 하세요. 비밀번호는{' '}
                    <strong>따로</strong> 보내시는 편이 안전합니다.
                  </td>
                </tr>
                <tr>
                  <td>미리 준비해 두는 경우</td>
                  <td>
                    <strong>QR 보기</strong>(목록) 또는 맨 위 QR을 담당자 휴대폰에 저장해 두게
                    하세요. 공연장에서 스캔하면 바로 열립니다.
                  </td>
                </tr>
                <tr>
                  <td>담당자가 파일을 미리 받아 두고 싶어 하는 경우</td>
                  <td>
                    담당자가 자기 주소를 자료함 화면에 넣으면 메일이 갑니다. 우리가 보내 줄 일은
                    없습니다.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Shot
            src="list.webp"
            width={1400}
            height={490}
            alt="자료함 목록. 줄마다 왼쪽에 큰 번호와 주소 복사·QR 보기 버튼, 가운데 제목과 파일 수, 오른쪽에 열림/꺼짐 표시."
            caption="목록에서도 주소 복사와 QR 보기가 바로 됩니다. 번호를 누르면 번호만 복사됩니다"
          />

          <p className="admin-field-help">
            오른쪽 <strong>열림</strong>/<strong>꺼짐</strong>은 지금 그 자료함이 열리는 상태인지를
            말합니다. 공연이 끝난 자료함을 꺼 두면 여기가 ‘꺼짐’으로 바뀝니다.
          </p>
        </section>

        {/* ── 현장 화면 ──────────────────────────────────────── */}
        <section className="admin-card guide-section">
          <h2>현장에서는 이렇게 보입니다</h2>
          <p>
            전화로 설명해 주셔야 할 때가 있으니, 담당자 쪽 화면도 알아 두시면 좋습니다. 이 두
            화면에는 사이트 메뉴가 없습니다 — 무대 뒤에서 헤매지 않도록 일부러 걷어냈습니다.
          </p>

          <div className="rvg-pair rvg-pair--shots">
            <Shot
              src="lock.webp"
              width={1400}
              height={781}
              alt="잠긴 자료함 화면. 위에 번호, 잠겨 있습니다라는 문구, 숫자 키패드가 크게 있다."
              caption="번호로 들어오면 먼저 이 화면입니다"
            />
            <Shot
              src="vault.webp"
              width={1400}
              height={942}
              alt="열린 자료함 화면. 곡 목록마다 재생 버튼과 내려받기 버튼이 있고, 아래에 이메일로 받기 칸이 있다."
              caption="비밀번호를 맞히면 목록이 열립니다"
            />
          </div>

          <dl className="guide-dl">
            <dt>키보드가 없어도 됩니다</dt>
            <dd>
              숫자판이 화면에 그려져 있어 손가락으로 누릅니다. 공연장 태블릿이나 휴대폰을
              생각하고 만든 화면입니다. 노트북이면 키보드로 쳐도 됩니다.
            </dd>
            <dt>한 번 열면 6시간 동안 다시 묻지 않습니다</dt>
            <dd>
              리허설 때 열어 두면 공연이 끝날 때까지 그 기기에서는 비밀번호를 다시 묻지 않습니다.
              공연 중에 화면을 잘못 닫아도 당황할 일이 없습니다.
            </dd>
            <dt>두 곡이 겹쳐 나오지 않습니다</dt>
            <dd>
              다른 곡을 누르면 앞 곡이 저절로 멈춥니다. 재생·정지·볼륨은 그 기기가 늘 쓰던 모양
              그대로입니다.
            </dd>
            <dt>맨 아래 저작권 문구</dt>
            <dd>
              “공연 목적 외로 쓰거나 다시 공유하지 말아 주세요”가 항상 붙어 나갑니다. 따로
              말씀하지 않으셔도 담당자가 보게 됩니다.
            </dd>
          </dl>
        </section>

        {/* ── 공연이 끝나면 ──────────────────────────────────── */}
        <section className="admin-card guide-section">
          <h2>공연이 끝나면</h2>
          <p>
            저작권이 있는 음원이라 공연이 끝난 자료함은 닫아 두시는 편이 좋습니다. 자료함 화면
            아래쪽 <strong>설정</strong>에서 합니다.
          </p>

          <Shot
            src="settings.webp"
            width={1400}
            height={379}
            alt="설정 칸. 열어 두기, 내려받기 허용, 이메일로 받기 허용 체크상자와 받기 링크 모두 무효화 버튼."
            caption="설정은 누르는 즉시 저장됩니다"
          />

          <dl className="guide-dl">
            <dt>열어 두기를 끕니다</dt>
            <dd>
              끄는 즉시 막힙니다. 번호를 아는 사람이 들어와도 “지금은 열 수 없는 자료함입니다”만
              보입니다. 파일은 지워지지 않으니 다음 공연에 다시 켜서 쓰셔도 됩니다.
            </dd>
            <dt>받기 링크 모두 무효화</dt>
            <dd>
              메일로 나갔던 링크를 전부 죽입니다. 담당자에게 보낸 링크가 엉뚱한 곳으로 퍼졌을 때
              쓰세요. <strong>번호와 비밀번호는 그대로 살아 있습니다</strong> — 우리 쪽은 계속
              열 수 있습니다.
            </dd>
            <dt>비밀번호만 바꾸고 싶다면</dt>
            <dd>
              맨 위 비밀번호 옆 <strong>새로 뽑기</strong>를 누르세요. 그 순간부터 옛 비밀번호는
              못 씁니다. 이미 열어 둔 기기는 6시간까지 그대로 열려 있습니다.
            </dd>
          </dl>

          <h3 className="rvg-h3">누가 언제 열었는지 봅니다</h3>
          <p>
            자료함 맨 아래 <strong>접근 기록</strong>에 남습니다. 문제가 생겼을 때 “언제 누구에게
            나갔나”에 답하기 위한 자리입니다.
          </p>

          <Shot
            src="log.webp"
            width={1400}
            height={361}
            alt="접근 기록 표. 시각, 무엇(재생·열림·메일 보냄·내려받음), 누구(지문), 내용 열이 있다."
            caption="지문은 사람을 식별하지 않습니다 — 같은 기기인지만 알려 줍니다"
          />

          <p className="admin-field-help">
            목록에서 <strong>실패 N회</strong> 표시가 붙었다면 누군가 비밀번호를 여러 번 틀린
            것입니다. 담당자가 잘못 받아 적었을 수도 있고, 번호만 알아낸 사람이 찍어 보는 것일
            수도 있습니다. 후자라면 비밀번호를 새로 뽑아 주세요.
          </p>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <section className="admin-card guide-section">
          <h2>자주 묻는 것</h2>
          <dl className="guide-dl">
            <dt>비밀번호를 잊어버렸습니다.</dt>
            <dd>
              자료함 화면 맨 위 비밀번호 옆 <strong>보기</strong>를 누르면 나옵니다. 다시 설정할
              필요가 없습니다 — 현장 담당자에게 이미 알려 준 번호가 그대로 살아 있어야 하기
              때문에 일부러 이렇게 만들었습니다.
            </dd>
            <dt>번호를 우리가 정할 수 있나요?</dt>
            <dd>
              아닙니다. 만들 때 시스템이 뽑습니다. 기억하기 좋은 번호는 남도 찍어 맞히기 좋습니다.
            </dd>
            <dt>현장 담당자도 회원가입을 해야 하나요?</dt>
            <dd>아닙니다. 번호와 비밀번호만 있으면 됩니다.</dd>
            <dt>인터넷이 안 되는 공연장이면요?</dt>
            <dd>
              열 수 없습니다. 그런 공연장이 예상되면 리허설 때 미리 열어{' '}
              <strong>내려받기</strong>로 담당자 기기에 받아 두게 하세요. 그래서 ‘내려받기 허용’을
              보통 켜 둡니다.
            </dd>
            <dt>파일이 100MB를 넘습니다.</dt>
            <dd>
              올라가지 않습니다. 보통은 wav 원본이라 그렇습니다 — mp3로 변환해서 올려 주세요.
              공연장 재생에는 차이가 없습니다.
            </dd>
            <dt>지난 공연 자료함을 다시 쓰고 싶습니다.</dt>
            <dd>
              설정에서 <strong>열어 두기</strong>를 다시 켜면 됩니다. 번호와 파일이 그대로
              있습니다. 지난 번호가 밖에 돌아다니는 것이 걱정되면 비밀번호만 새로 뽑으세요.
            </dd>
            <dt>영상도 올릴 수 있나요?</dt>
            <dd>
              지금은 음원·PDF·이미지만 받습니다. 영상이 필요해지면 말씀해 주세요 — 자료함이라는
              이름을 쓴 것이 그래서입니다.
            </dd>
            <dt>이 메뉴는 누가 볼 수 있나요?</dt>
            <dd>
              기본은 원장님과 관리자입니다. 선생님 계정에는 이 메뉴가 나오지 않습니다 — 저작권
              자료를 담는 자리라 좁게 잡아 두었습니다. 필요하시면 <strong>메뉴 권한</strong>
              화면에서 선생님도 볼 수 있게 여실 수 있습니다.
            </dd>
          </dl>
        </section>

        <p className="rvg-back">
          <Link href="/admin/resources" className="admin-btn admin-btn-outline">
            공연 자료함으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
