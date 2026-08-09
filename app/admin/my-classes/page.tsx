/**
 * 내 수업 (원생·학부모용)
 *
 * 원생: 본인이 배정된 수업·프로그램.
 * 학부모: 연결(확정)된 자녀별로 배정된 수업.
 * 데이터는 운영진이 프로그램 편집 화면에서 배정한다(program_enrollments). 취소(cancelled)는 숨긴다.
 * 카드를 누르면 수업 상세(/admin/my-classes/[id])에서 정보 확인·사진 제출을 할 수 있다.
 */

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEnrollmentsForUser, getEnrollmentsForUsers } from '@/lib/d1';
import { getGuardianChildren } from '@/lib/members';
import type { MemberRole } from '@/types/members';
import type { MyEnrollment } from '@/types/programs';
import ClassCard from '@/components/admin/ClassCard';
import T from '@/components/common/T';

export const metadata: Metadata = {
  title: '내 수업 | KTDOC',
};

function ClassList({ items }: { items: MyEnrollment[] }) {
  const visible = items.filter((i) => i.status !== 'cancelled');
  if (visible.length === 0) {
    return (
      <p className="admin-form-help">
        <T k="admin.myClasses.empty">
          아직 배정된 수업이 없습니다. 운영진이 수업에 배정하면 이곳에 표시됩니다.
        </T>
      </p>
    );
  }
  return (
    <div className="myclass-grid">
      {visible.map((item) => (
        <ClassCard key={item.enrollment_id} item={item} />
      ))}
    </div>
  );
}

export default async function MyClassesPage() {
  const session = await auth();
  await requireMenuAccess(session, 'my-classes');

  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session!.user!.id;

  // 학부모: 연결된 자녀별로 묶어서 보여준다.
  if (role === 'parent') {
    const children = await getGuardianChildren(userId);
    const all =
      children.length > 0
        ? await getEnrollmentsForUsers(children.map((c) => c.studentId))
        : [];
    const byChild = new Map<string, MyEnrollment[]>();
    for (const item of all) {
      const list = byChild.get(item.user_id) ?? [];
      list.push(item);
      byChild.set(item.user_id, list);
    }

    return (
      <div className="admin-page">
        <div className="admin-header">
          <div className="admin-header-content">
            <h1 className="admin-title">
              <T k="admin.nav.my-classes">내 수업</T>
            </h1>
            <p className="admin-subtitle">
              <T k="admin.myClasses.subtitleParent">자녀가 배정된 수업·프로그램입니다.</T>
            </p>
          </div>
        </div>

        {children.length === 0 ? (
          <p className="admin-form-help">
            <T k="admin.myClasses.noChildren">
              아직 연결된 자녀가 없습니다. 회원 관리에서 자녀 연결이 확정되면 자녀의 수업이 이곳에
              표시됩니다.
            </T>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {children.map((c) => (
              <section key={c.studentId}>
                <h2 className="myclass-child-name">
                  {c.studentName || <T k="admin.myClasses.child">자녀</T>}
                </h2>
                <ClassList items={byChild.get(c.studentId) ?? []} />
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 원생 본인(및 admin이 진입 시 본인 기준).
  const items = await getEnrollmentsForUser(userId);
  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">
            <T k="admin.nav.my-classes">내 수업</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.myClasses.subtitleStudent">내가 배정된 수업·프로그램입니다.</T>
          </p>
        </div>
      </div>
      <ClassList items={items} />
    </div>
  );
}
