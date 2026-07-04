/**
 * Admin Glossary Song Detail API (말모이 노래)
 * GET    /api/admin/glossary/songs/[id] - 노래 상세 (가사 줄 포함)
 * PUT    /api/admin/glossary/songs/[id] - 노래 수정 (lines 제공 시 전량 교체)
 * DELETE /api/admin/glossary/songs/[id] - 노래 삭제 (가사 줄 CASCADE)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getGlossarySongById, updateGlossarySong, deleteGlossarySong } from '@/lib/d1';
import type { UpdateGlossarySongInput, SongLineInput } from '@/types/glossary';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const songId = parseInt(id);
    if (isNaN(songId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const song = await getGlossarySongById(songId);
    if (!song) {
      return NextResponse.json({ success: false, error: '노래를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: song });
  } catch (error) {
    console.error('Admin glossary song fetch error:', error);
    return NextResponse.json({ success: false, error: '노래 정보를 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const songId = parseInt(id);
    if (isNaN(songId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const existing = await getGlossarySongById(songId);
    if (!existing) {
      return NextResponse.json({ success: false, error: '노래를 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const input: UpdateGlossarySongInput = {};
    const textFields: (keyof UpdateGlossarySongInput)[] = [
      'title_ko', 'title_en', 'romanization', 'pronunciation',
      'description_ko', 'description_en', 'youtube_url', 'slug',
    ];
    for (const field of textFields) {
      if (body[field] !== undefined) {
        input[field] = body[field];
      }
    }
    if (body.is_published !== undefined) input.is_published = body.is_published;
    if (body.sort_order !== undefined) input.sort_order = body.sort_order;
    if (body.lines !== undefined) input.lines = normalizeLines(body.lines) ?? [];

    await updateGlossarySong(songId, input);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin glossary song update error:', error);
    return NextResponse.json({ success: false, error: '노래 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const songId = parseInt(id);
    if (isNaN(songId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const removed = await deleteGlossarySong(songId);
    if (!removed) {
      return NextResponse.json({ success: false, error: '노래를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin glossary song delete error:', error);
    return NextResponse.json({ success: false, error: '노래 삭제에 실패했습니다.' }, { status: 500 });
  }
}
