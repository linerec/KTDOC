/**
 * /api/admin/forms/[id]/responses/[rid]/reconcile — 신청 과목 ↔ 배정 맞추기
 *
 *   GET  → 지금 어긋나 있는가(계획 미리보기). 상세 화면이 경고 띠를 그리는 데 쓴다.
 *   POST → 계획 실행. 누군가 수업 화면에서 손으로 해제했거나, 정정이 배정 단계에서
 *          멈췄을 때 이어 붙이는 버튼이다. 계획이 멱등이라 몇 번 눌러도 안전하다.
 *
 * 판단은 '수업에 넣기'와 같은 함수(reconcileEnrollments)다 — 두 벌이면 어긋난다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getResponseById } from '@/lib/d1';
import { loadPlan, reconcileEnrollments } from '@/lib/forms/correctionRun';
import { describePlan, isPlanNoop } from '@/lib/forms/correction';

interface RouteParams {
  params: Promise<{ id: string; rid: string }>;
}

async function load(params: RouteParams['params']) {
  const session = await auth();
  if (!(await hasMenuAccess(session, 'forms'))) return { error: '접근 권한이 없습니다.', status: 403 } as const;
  const { rid } = await params;
  const responseId = Number(rid);
  if (!Number.isInteger(responseId)) return { error: '유효하지 않은 ID입니다.', status: 400 } as const;
  const response = await getResponseById(responseId);
  if (!response) return { error: '응답을 찾을 수 없습니다.', status: 404 } as const;
  return { session, response } as const;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const r = await load(params);
    if ('error' in r) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
    const loaded = await loadPlan(r.response);
    return NextResponse.json({
      success: true,
      data: {
        hasStudent: loaded.hasStudent,
        drift: loaded.hasStudent && !isPlanNoop(loaded.plan),
        planLines: describePlan(loaded.plan),
        plan: loaded.plan,
      },
    });
  } catch (error) {
    console.error('Admin reconcile preview error:', error);
    return NextResponse.json({ success: false, error: '확인하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const r = await load(params);
    if ('error' in r) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
    const body = await request.json().catch(() => ({}));
    const result = await reconcileEnrollments({
      response: r.response,
      actor: { id: r.session?.user?.id ?? null, name: r.session?.user?.name ?? null },
      notify: body.notify !== false,
      noteBody: '배정 맞추기(신청 과목 기준)',
    });
    return NextResponse.json({ success: true, data: { summary: result.summary, noop: result.noop } });
  } catch (error) {
    console.error('Admin reconcile error:', error);
    return NextResponse.json({ success: false, error: '배정을 맞추지 못했습니다.' }, { status: 500 });
  }
}
