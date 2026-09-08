/**
 * POST /api/admin/forms/[id]/responses/[rid]/correct — 신청 과목 정정
 *
 * 한 라우트가 정정의 네 동작을 받는다. 판단과 실행은 lib/forms/correctionRun.ts 에
 * 있고 여기는 권한·입력 모양·응답 모양만 책임진다.
 *
 *   mode='preview'       { optionKeys }                      → 바뀌는 과목·배정을 미리 보여 준다(저장 없음)
 *   mode='apply'         { optionKeys, reason?, notify }     → 바로 적용: 답 + 배정 + 이력 + 안내
 *   mode='plan'          { optionKeys, reason?, notify, effective? } → 예고만(답·배정은 그대로)
 *   mode='applyPlanned'  { noteId, notify }                  → 예고했던 것을 지금 적용
 *   mode='withdraw'      { noteId }                          → 예고 철회
 *
 * 마감된 신청서에도 정정할 수 있다 — 대리 입력과 같은 이유(마감 뒤 전화가 온다).
 * 정정은 **현재 문안**의 선택지로 고른다. 옛 문안에 없던 과목으로 옮기는 일이 실제로 있다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getFormById, getResponseById } from '@/lib/d1';
import {
  applyPlannedChange,
  applySubjectChange,
  planSubjectChange,
  previewSubjectChange,
  withdrawPlannedChange,
} from '@/lib/forms/correctionRun';
import { describePlan } from '@/lib/forms/correction';
import type { CorrectionError } from '@/lib/forms/correction';

interface RouteParams {
  params: Promise<{ id: string; rid: string }>;
}

const REASON_MAX = 500;

function errorMessage(e: CorrectionError): string {
  switch (e.code) {
    case 'noQuestion':
      return '이 신청서에는 과목 문항이 없습니다.';
    case 'badOptions':
      return '지금 문안에 없는 과목이 섞여 있습니다. 화면을 새로 고친 뒤 다시 골라 주세요.';
    case 'pickAtLeast':
      return e.min === 1
        ? '과목을 하나 이상 골라 주세요. 전부 빼려면 ‘다르게 처리하기 → 취소’를 쓰세요.'
        : `과목을 ${e.min}개 이상 골라 주세요.`;
    case 'exclusiveConflict':
      return '함께 고를 수 없는 과목이 같이 골라져 있습니다.';
    case 'noChange':
      return '지금 신청 과목과 같습니다. 바뀐 것이 없습니다.';
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }
    const { id, rid } = await params;
    const formId = Number(id);
    const responseId = Number(rid);
    if (!Number.isInteger(formId) || !Number.isInteger(responseId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const [form, response] = await Promise.all([getFormById(formId), getResponseById(responseId)]);
    if (!form || !response || response.form_id !== formId) {
      return NextResponse.json({ success: false, error: '응답을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = typeof body.mode === 'string' ? body.mode : 'preview';
    const actor = { id: session?.user?.id ?? null, name: session?.user?.name ?? null };
    const notify = body.notify !== false;
    const reasonRaw = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reasonRaw.length > REASON_MAX) {
      return NextResponse.json({ success: false, error: `사유는 ${REASON_MAX}자까지입니다.` }, { status: 400 });
    }
    const reason = reasonRaw || null;
    const optionKeys: string[] = Array.isArray(body.optionKeys)
      ? body.optionKeys.filter((k: unknown): k is string => typeof k === 'string')
      : [];
    const effective =
      typeof body.effective === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.effective)
        ? body.effective
        : null;

    if (mode === 'preview') {
      const r = await previewSubjectChange({ response, form, nextKeys: optionKeys });
      if (!r.ok) return NextResponse.json({ success: false, error: errorMessage(r.error) }, { status: 400 });
      return NextResponse.json({
        success: true,
        data: { from: r.from, to: r.to, plan: r.plan, planLines: describePlan(r.plan), hasStudent: r.hasStudent },
      });
    }

    if (mode === 'apply') {
      const r = await applySubjectChange({ response, form, nextKeys: optionKeys, reason, notify, actor });
      if (!r.ok) {
        const msg = r.step === 'validate' ? errorMessage(r.error) : r.message;
        return NextResponse.json({ success: false, error: msg, step: r.step }, { status: r.step === 'validate' ? 400 : 500 });
      }
      return NextResponse.json({ success: true, data: { summary: r.summary, mail: r.mail } });
    }

    if (mode === 'plan') {
      const r = await planSubjectChange({ response, form, nextKeys: optionKeys, reason, notify, actor, effective });
      if (!r.ok) {
        const msg = r.step === 'validate' ? errorMessage(r.error) : r.message;
        return NextResponse.json({ success: false, error: msg, step: r.step }, { status: r.step === 'validate' ? 400 : 500 });
      }
      return NextResponse.json({ success: true, data: { summary: r.summary, noteId: r.noteId } });
    }

    const noteId = Number(body.noteId);
    if (!Number.isInteger(noteId)) {
      return NextResponse.json({ success: false, error: '예고를 찾을 수 없습니다.' }, { status: 400 });
    }
    if (mode === 'applyPlanned') {
      const r = await applyPlannedChange({ noteId, response, actor, notify });
      if (!r.ok) {
        const msg = r.step === 'validate' ? errorMessage(r.error) : r.message;
        return NextResponse.json({ success: false, error: msg, step: r.step }, { status: r.step === 'validate' ? 400 : 500 });
      }
      return NextResponse.json({ success: true, data: { summary: r.summary, mail: r.mail } });
    }
    if (mode === 'withdraw') {
      const ok = await withdrawPlannedChange(noteId, actor, responseId);
      if (!ok) return NextResponse.json({ success: false, error: '이미 적용했거나 철회한 예고입니다.' }, { status: 400 });
      return NextResponse.json({ success: true, data: { summary: '예고를 철회했습니다.' } });
    }

    return NextResponse.json({ success: false, error: '알 수 없는 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Admin form correction error:', error);
    return NextResponse.json({ success: false, error: '처리하지 못했습니다.' }, { status: 500 });
  }
}
