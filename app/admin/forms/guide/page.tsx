/**
 * 신청 내용 고치기 — 선생님용 안내
 *
 * 대면 산출물은 사이트 페이지로 둔다(외부 문서·아티팩트 아님). 신청서 관리 머리와
 * 정정 모달 안에서 링크한다. 문체는 차분한 합니다체. 버튼 이름은 화면과 글자까지 같게.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';

export const metadata: Metadata = {
  title: '신청 내용 고치기 안내 | KTDOC Admin',
};

export default async function FormsGuidePage() {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/forms">신청서 관리</Link>
            <span>/</span>
            <span>안내</span>
          </div>
          <h1 className="admin-title">신청 내용 고치기</h1>
          <p className="admin-subtitle">
            과목을 잘못 넣은 신청을 고치는 방법입니다. 어느 버튼을 누르든 기록이 남고, 학생과
            보호자에게 안내가 나갑니다.
          </p>
        </div>
      </div>

      <div className="guide">
        <section className="admin-card guide-section">
          <h2>어느 버튼을 누르나</h2>
          <div className="admin-table-wrap">
            <table className="admin-table guide-table">
              <thead>
                <tr>
                  <th>상황</th>
                  <th>누르는 곳</th>
                  <th>함께 처리되는 것</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>과목을 잘못 골랐다 (배정 전이든 후든)</td>
                  <td>
                    응답 상세 → <strong>신청 과목 정정</strong>
                  </td>
                  <td>답 수정 · 수업 명단 · 안내 메일 · 기록</td>
                </tr>
                <tr>
                  <td>명단을 보다 잘못 들어간 학생을 발견했다</td>
                  <td>
                    과목별 명단 → 그 줄의 <strong>정정</strong>
                  </td>
                  <td>같은 화면이 열린 채로 응답 상세로 이동</td>
                </tr>
                <tr>
                  <td>학생이 신청서를 다시 냈다</td>
                  <td>
                    새 응답 상세 → <strong>수업에 넣기</strong>
                  </td>
                  <td>옛 응답이 만든 배정 중 빠진 것도 함께 정리 · 변경 안내</td>
                </tr>
                <tr>
                  <td>신청을 아예 취소한다</td>
                  <td>
                    다르게 처리하기 → 상태 <strong>취소</strong>
                  </td>
                  <td>상자를 켜 두면 명단에서 빼고 안내까지</td>
                </tr>
                <tr>
                  <td>“신청 과목과 수업 명단이 다릅니다” 경고가 떴다</td>
                  <td>
                    그 상자의 <strong>배정 맞추기</strong>
                  </td>
                  <td>신청 과목 기준으로 명단을 맞추고 안내</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="admin-field-help">
            수업 화면(프로그램 편집 → 수강생)에서 직접 해제하는 것도 됩니다. 다만 그 길은
            신청서에 기록이 남지 않고 안내도 나가지 않아, 나중에 “왜 빠졌지”를 알 수 없습니다.
          </p>
        </section>

        <section className="admin-card guide-section">
          <h2>바로 적용과 먼저 예고</h2>
          <dl className="guide-dl">
            <dt>바로 적용</dt>
            <dd>
              학부모나 학생이 요청해서 고치는 경우입니다. 저장하는 순간 답과 명단이 바뀌고,
              “이렇게 변경되었습니다” 확인 안내가 나갑니다. 대부분 이쪽입니다.
            </dd>
            <dt>먼저 예고</dt>
            <dd>
              학원 사정으로 옮기는 경우입니다 — 반을 합치거나, 시간이 바뀌거나, 우리가 잘못
              배정했을 때. 저장하면 “○일부터 이렇게 바뀔 예정입니다” 예고만 나가고 답·명단은
              그대로입니다. 응답 상세에 <strong>예고된 정정</strong> 상자가 남으니, 그 날이 되면{' '}
              <strong>지금 적용</strong>을 눌러 주세요. 마음이 바뀌면 <strong>철회</strong>.
              자동으로 적용되지는 않습니다 — 마지막 확인은 사람이 합니다.
            </dd>
          </dl>
        </section>

        <section className="admin-card guide-section">
          <h2>저장 전에 확인할 세 가지</h2>
          <ol className="guide-ol">
            <li>
              <strong>누구 것인가.</strong> 창 맨 위에 학생 이름과 연결된 회원이 있습니다.
              형제가 있는 집은 특히 — 다른 자녀의 응답을 열어 놓고 고치는 실수가 가장 흔합니다.
            </li>
            <li>
              <strong>배정이 어떻게 되나.</strong> 과목을 바꾸면 “저장하면 이렇게 됩니다”에
              빠지는 수업과 새 수업이 보입니다. 시작 전 수업은 명단에서 지워지고, 이미 시작한
              수업은 ‘취소’로 남습니다(출석·사진 기록이 있을 수 있어서입니다).
            </li>
            <li>
              <strong>안내가 어디로 가나.</strong> 주소가 보입니다. 신청서에 적은 주소, 회원
              계정 주소, 보호자 주소가 다를 수 있습니다. 주소가 하나도 없으면 저장은 되지만
              안내는 나가지 않으니 전화로 알려 주세요.
            </li>
          </ol>
          <p className="admin-field-help">
            전화로 이미 설명을 드렸다면 “안내 보내기” 상자를 끄셔도 됩니다. 끈 사실도 기록에
            남습니다.
          </p>
        </section>

        <section className="admin-card guide-section">
          <h2>실수했을 때</h2>
          <p>
            되돌리기 버튼은 없습니다. <strong>한 번 더 정정</strong>하면 됩니다 — 원래 과목으로
            다시 고르면 명단도 돌아오고, 안내도 다시 나갑니다. 무엇을 언제 누가 바꿨는지는
            응답 상세의 <strong>처리 이력</strong>과 답변 카드의 <strong>정정됨</strong> 표시에
            전부 남아 있습니다.
          </p>
          <p>
            저장 중간에 “명단을 맞추지 못했습니다”가 뜨면 과목은 이미 바뀐 상태입니다. 응답
            상세를 새로 고치면 경고 상자가 뜨고, <strong>배정 맞추기</strong>가 이어서 처리합니다.
            여러 번 눌러도 중복되지 않습니다.
          </p>
        </section>

        <section className="admin-card guide-section">
          <h2>자주 묻는 것</h2>
          <dl className="guide-dl">
            <dt>학부모가 신청서를 다시 냈는데, 옛 신청은 어떻게 되나요?</dt>
            <dd>
              같은 학생의 옛 응답은 목록·명단에서 빠지고 “대체됨” 표시가 붙습니다. 옛 응답이
              만든 배정은 새 응답에서 <strong>수업에 넣기</strong>를 누를 때 함께 정리됩니다.
              접수 메일에도 “이전 신청을 대체했습니다 · 바뀐 것”이 적혀 나갑니다.
            </dd>
            <dt>같은 학생 응답이 두 개라는 경고가 떠요.</dt>
            <dd>
              로그인 없이 이름을 조금 다르게 적어 낸 경우입니다. 어느 쪽이 맞는지 확인한 뒤
              한쪽을 <strong>취소</strong>로 내려 주세요.
            </dd>
            <dt>학비는 안내에 들어가나요?</dt>
            <dd>
              들어가지 않습니다. 화면의 학비표 참고 줄은 운영진만 봅니다. 금액은 지금처럼
              개별로 안내해 주세요.
            </dd>
            <dt>선생님이 직접 배정한 학생은요?</dt>
            <dd>
              수업 화면에서 직접 넣은 배정은 신청서 쪽 정정이 건드리지 않습니다. 신청서에서 온
              배정만 정리합니다.
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
