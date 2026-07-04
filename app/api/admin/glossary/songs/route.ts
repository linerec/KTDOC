/**
 * Admin Glossary Songs API (말모이 노래)
 * GET  /api/admin/glossary/songs - 노래 목록 (관리자용, 비공개 포함)
 * POST /api/admin/glossary/songs - 노래 생성 (가사 줄 포함)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getGlossarySongs, createGlossarySong } from '@/lib/d1';
import type { CreateGlossarySongInput, SongLineInput } from '@/types/glossary';

function normalizeLines(raw: unknown): SongLineInput[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => ({
      text_ko: typeof l.text_ko === 'string' ? l.text_ko : '',
      romanization: typeof l.romanization === 'string' ? l.romanization : undefined,
      pronunciation: typeof l.pronunciation === 'string' ? l.pronunciation : undefined,
      text_en: typeof l.text_en === 'string' ? l.text_en : undefined,
      is_refrain: Boolean(l.is_refrain),
    }))
    .filter((l) => l.text_ko.trim().length > 0);
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const result = await getGlossarySongs({
      search: searchParams.get('search') || undefined,
      published: 'all',
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin glossary songs fetch error:', error);
    return NextResponse.json({ success: false, error: '노래 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.title_ko) {
      return NextResponse.json({ success: false, error: '노래 제목(한글)은 필수입니다.' }, { status: 400 });
    }

    const input: CreateGlossarySongInput = {
      title_ko: body.title_ko,
      title_en: body.title_en,
      romanization: body.romanization,
      pronunciation: body.pronunciation,
      description_ko: body.description_ko,
      description_en: body.description_en,
      youtube_url: body.youtube_url,
      is_published: body.is_published ?? true,
      sort_order: body.sort_order,
      slug: body.slug,
      lines: normalizeLines(body.lines),
    };

    const id = await createGlossarySong(input);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin glossary song create error:', error);
    return NextResponse.json({ success: false, error: '노래 생성에 실패했습니다.' }, { status: 500 });
  }
}
