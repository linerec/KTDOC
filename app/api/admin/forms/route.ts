/**
 * Admin 신청서 API
 * GET  /api/admin/forms - 신청서 목록 (응답 수 포함)
 * POST /api/admin/forms - 프리셋으로 신청서 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { createForm, getForms, getResponseCountsByForm, slugExists } from '@/lib/d1';
import { PRESETS } from '@/lib/forms/presets';
import type { FormKind } from '@/types/forms';

const KINDS: FormKind[] = ['season', 'workshop', 'survey'];

/** 공개 URL이 되는 값이라 좁게 받는다. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function GET() {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const [forms, counts] = await Promise.all([getForms(), getResponseCountsByForm()]);
    return NextResponse.json({
      success: true,
      data: forms.map((f) => ({ ...f, response_count: counts[f.id] ?? 0 })),
    });
  } catch (error) {
    console.error('Admin forms fetch error:', error);
    return NextResponse.json(
      { success: false, error: '신청서 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { kind, slug, season, title_ko, title_en, requires_login } = body;

    if (!KINDS.includes(kind)) {
      return NextResponse.json(
        { success: false, error: '알 수 없는 신청서 종류입니다.' },
        { status: 400 }
      );
    }

    const trimmedSlug = typeof slug === 'string' ? slug.trim() : '';
    if (!SLUG_RE.test(trimmedSlug)) {
      return NextResponse.json(
        { success: false, error: '주소는 소문자·숫자·하이픈만 쓸 수 있습니다.' },
        { status: 400 }
      );
    }
    if (!title_ko?.trim()) {
      return NextResponse.json({ success: false, error: '제목은 필수입니다.' }, { status: 400 });
    }
    if (await slugExists(trimmedSlug)) {
      return NextResponse.json({ success: false, error: '이미 쓰이는 주소입니다.' }, { status: 400 });
    }

    const id = await createForm({
      slug: trimmedSlug,
      season: typeof season === 'string' && season.trim() ? season.trim() : null,
      kind,
      preset_key: kind === 'season' ? 'season-2026' : kind,
      title_ko: title_ko.trim(),
      title_en: typeof title_en === 'string' && title_en.trim() ? title_en.trim() : null,
      description_ko: null,
      description_en: null,
      schema: PRESETS[kind as FormKind](),
      requires_login: requires_login === true,
      created_by: session?.user?.id ?? null,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin form create error:', error);
    return NextResponse.json(
      { success: false, error: '신청서 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
