/**
 * Admin Programs API
 * GET  /api/admin/programs - 프로그램 목록 (관리자용, 비공개 포함)
 * POST /api/admin/programs - 프로그램 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getPrograms, createProgram, setProgramSupplies } from '@/lib/d1';
import { PROGRAM_TYPES, type CreateProgramInput, type ProgramType } from '@/types/programs';
import { normalizeSupplyLinks } from '@/types/supplies';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const result = await getPrograms({
      type: typeParam && PROGRAM_TYPES.includes(typeParam as ProgramType)
        ? (typeParam as ProgramType)
        : undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      published: 'all',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin programs fetch error:', error);
    return NextResponse.json(
      { success: false, error: '프로그램 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title_ko, program_type } = body;

    if (!title_ko) {
      return NextResponse.json(
        { success: false, error: '제목(한글)은 필수입니다.' },
        { status: 400 }
      );
    }
    if (!program_type || !PROGRAM_TYPES.includes(program_type)) {
      return NextResponse.json(
        { success: false, error: '올바른 종류(수업/프로그램/캠프)를 선택하세요.' },
        { status: 400 }
      );
    }

    const input: CreateProgramInput = {
      program_type,
      title_ko,
      title_en: body.title_en,
      summary_ko: body.summary_ko,
      summary_en: body.summary_en,
      description_ko: body.description_ko,
      description_en: body.description_en,
      age_range: body.age_range,
      schedule_ko: body.schedule_ko,
      schedule_en: body.schedule_en,
      start_date: body.start_date,
      end_date: body.end_date,
      price_ko: body.price_ko,
      price_en: body.price_en,
      location_ko: body.location_ko,
      location_en: body.location_en,
      weekdays: body.weekdays,
      class_start_time: body.class_start_time,
      class_end_time: body.class_end_time,
      term_start_date: body.term_start_date,
      term_end_date: body.term_end_date,
      is_published: body.is_published ?? false,
      is_featured: body.is_featured ?? false,
      sort_order: body.sort_order,
      slug: body.slug,
    };

    const id = await createProgram(input);
    if (body.supplies !== undefined) {
      await setProgramSupplies(id, normalizeSupplyLinks(body.supplies));
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin program create error:', error);
    return NextResponse.json(
      { success: false, error: '프로그램 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
