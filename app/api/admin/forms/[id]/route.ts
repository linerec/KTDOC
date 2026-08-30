/**
 * Admin 신청서 상세 API
 * GET    /api/admin/forms/[id] - 신청서 + 운영 준비 상태(경고·미반영 응답 수)
 * PUT    /api/admin/forms/[id] - 문안(schema) 또는 머리말(meta) 저장
 * DELETE /api/admin/forms/[id] - 삭제 (응답이 없을 때만)
 *
 * 잠긴 신청서(첫 제출 이후)의 파괴적 편집은 409로 거부한다. 삭제·유형 변경 같은
 * 것들이며, 이미 낸 응답이 가리킬 곳을 잃기 때문이다. 판정은 lib/forms/schema.ts 가 한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import {
  LOCKED_ERROR_PREFIX,
  countDirty,
  deleteForm,
  getFormById,
  slugExists,
  updateFormMeta,
  updateFormSchema,
} from '@/lib/d1';
import { warnSchema } from '@/lib/forms/schema';
import type { FormSchema } from '@/types/forms';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const FORBIDDEN = NextResponse.json(
  { success: false, error: '접근 권한이 없습니다.' },
  { status: 403 }
);

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) return FORBIDDEN;

    const { id } = await params;
    const formId = Number(id);
    if (!Number.isInteger(formId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const form = await getFormById(formId);
    if (!form) {
      return NextResponse.json({ success: false, error: '신청서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const schema = JSON.parse(form.schema_json) as FormSchema;
    return NextResponse.json({
      success: true,
      data: {
        form,
        schema,
        warnings: warnSchema(schema),
        dirtyCount: await countDirty(formId),
      },
    });
  } catch (error) {
    console.error('Admin form fetch error:', error);
    return NextResponse.json(
      { success: false, error: '신청서를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) return FORBIDDEN;

    const { id } = await params;
    const formId = Number(id);
    if (!Number.isInteger(formId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const form = await getFormById(formId);
    if (!form) {
      return NextResponse.json({ success: false, error: '신청서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const { schema, note, meta } = body as {
      schema?: FormSchema;
      note?: string;
      meta?: Record<string, unknown>;
    };

    if (meta && typeof meta === 'object') {
      if (typeof meta.slug === 'string') {
        const trimmed = meta.slug.trim();
        if (!SLUG_RE.test(trimmed)) {
          return NextResponse.json(
            { success: false, error: '주소는 소문자·숫자·하이픈만 쓸 수 있습니다.' },
            { status: 400 }
          );
        }
        if (await slugExists(trimmed, formId)) {
          return NextResponse.json({ success: false, error: '이미 쓰이는 주소입니다.' }, { status: 400 });
        }
        meta.slug = trimmed;
      }
      await updateFormMeta(formId, meta);
    }

    let schemaVersion = form.schema_version;
    if (schema) {
      schemaVersion = await updateFormSchema(
        formId,
        schema,
        typeof note === 'string' && note.trim() ? note.trim() : null,
        session?.user?.id ?? null
      );
    }

    return NextResponse.json({ success: true, data: { schemaVersion } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // 잠긴 신청서의 파괴적 편집 — 운영자가 무엇이 막혔는지 그대로 볼 수 있게 사유를 넘긴다.
    if (message.startsWith(LOCKED_ERROR_PREFIX)) {
      return NextResponse.json(
        { success: false, error: message.slice(LOCKED_ERROR_PREFIX.length) },
        { status: 409 }
      );
    }
    if (message.startsWith('스키마 검증 실패')) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    console.error('Admin form update error:', error);
    return NextResponse.json({ success: false, error: '저장에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) return FORBIDDEN;

    const { id } = await params;
    const formId = Number(id);
    if (!Number.isInteger(formId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    await deleteForm(formId);
    return NextResponse.json({ success: true, data: { id: formId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('응답이 있는')) {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }
    console.error('Admin form delete error:', error);
    return NextResponse.json({ success: false, error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
