/**
 * 내 신청 내역 (원생·학부모·선생님 본인용)
 *
 * **왜 이 화면이 생겼나**: 제출 완료 화면과 가입 안내가 "로그인하시면 신청 내역을
 * 확인하실 수 있습니다"라고 약속하는데 그런 곳이 없었다. 학부모가 로그인해서
 * 아무것도 못 찾고 "저장이 안 됐다"고 알려 오셨다. 홈 화면은 그 위에
 * "신청하러 가기"를 계속 권해서 오해를 굳혔다.
 *
 * 여기서 보여주는 것은 **낸 사람이 봐도 되는 것뿐**이다 — 무엇을 신청했고,
 * 언제 냈고, 지금 어디까지 왔는가. 연락처·내부 메모·의료 본문은 담지 않는다
 * (건강 정보는 "적으셨다"까지만). 운영 화면(/admin/forms)과 섞지 않는 이유다.
 *
 * 범위는 formViews.myApplications 관점이 정한다: 세션 본인 + (학부모면) 확정된 자녀.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getMyResponses, getSelectionsForResponses, myApplications } from '@/lib/d1';
import { getGuardianView } from '@/lib/members';
import { APPLICANT_STATUS } from '@/lib/forms/responseLabels';
import type { MemberRole } from '@/types/members';

export const metadata: Metadata = {
  title: '내 신청 내역 | KTDOC',
};

function formatDate(value: string): string {
  const d = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export default async function MyApplicationsPage() {
  const session = await auth();
  await requireMenuAccess(session, 'my-applications');

  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session!.user!.id;

  // 학부모는 확정된 자녀까지 본다. 자녀 범위 판단은 GuardianView 관점이 단일 소스.
  const { childIds } = await getGuardianView(role, userId);
  const view = myApplications([userId, ...childIds]);
  const rows = await getMyResponses(view);
  const selections = await getSelectionsForResponses(rows.map((r) => r.id));

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <h1>내 신청 내역</h1>
        <p className="admin-page-lede">
          {role === 'parent'
            ? '보호자님과 자녀가 낸 수강 신청입니다.'
            : '지금까지 내신 수강 신청입니다.'}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="myapp-empty">
          <p className="myapp-empty-title">아직 내신 신청이 없습니다.</p>
          <p className="admin-form-help">
            신청서를 내셨는데 여기 보이지 않는다면, 로그인하지 않은 채로 내셨거나
            아직 회원 계정과 연결되지 않은 경우입니다. 학원으로 알려 주시면 이어 드립니다.
          </p>
          <Link href="/classes" className="admin-btn admin-btn-gold">
            수업 둘러보고 신청하기
          </Link>
        </div>
      ) : (
        <ul className="myapp-list">
          {rows.map((r) => {
            const st = APPLICANT_STATUS[r.status];
            const picked = selections.get(r.id) ?? [];
            return (
              <li key={r.id} className="myapp-card">
                <div className="myapp-card-head">
                  <div>
                    <p className="myapp-student">{r.student_name}</p>
                    <p className="myapp-form">{r.form_title_ko ?? '수강 신청서'}</p>
                  </div>
                  <span className={`myapp-status is-${r.status}`}>{st.label}</span>
                </div>

                <p className="myapp-hint">{st.hint}</p>

                {picked.length > 0 && (
                  <div className="myapp-classes">
                    <span className="myapp-classes-label">신청한 과목</span>
                    <ul>
                      {picked.map((p) => (
                        <li key={p.optionKey}>{p.labelKo ?? p.optionKey}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="myapp-foot">
                  <span>접수번호 #{r.id}</span>
                  <span>{formatDate(r.submitted_at)} 제출</span>
                  {/* 내용은 보이지 않는다 — 적으셨다는 사실만 확인시켜 드린다. */}
                  {r.has_medical === 1 && <span>건강 정보 적으심</span>}
                  {r.status === 'enrolled' && (
                    <Link href="/admin/my-classes" className="myapp-link">
                      내 수업 보기 →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="admin-form-help myapp-note">
        신청 내용을 고치고 싶으시면 학원으로 알려 주세요. 같은 신청서를 다시 내시면
        마지막에 내신 것으로 접수됩니다.
      </p>
    </div>
  );
}
