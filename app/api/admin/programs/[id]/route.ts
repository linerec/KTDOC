/**
 * Admin Program Detail API
 * GET    /api/admin/programs/[id] - 프로그램 상세
 * PUT    /api/admin/programs/[id] - 프로그램 수정
 * DELETE /api/admin/programs/[id] - 프로그램 삭제 (이미지 R2 정리 포함)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getProgramById, updateProgram, deleteProgram, setProgramSupplies, setProgramSupplySets } from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import { PROGRAM_TYPES, type UpdateProgramInput } from '@/types/programs';
import { normalizeSupplyLinks, normalizeSupplySetLinks } from '@/types/supplies';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const programId = parseInt(id);
    if (isNaN(programId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const program = await getProgramById(programId);
    if (!program) {
      return NextResponse.json(
        { success: false, error: '프로그램을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: program });
  } catch (error) {
    console.error('Admin program fetch error:', error);
    return NextResponse.json(
      { success: false, error: '프로그램 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const programId = parseInt(id);
    if (isNaN(programId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const program = await getProgramById(programId);
    if (!program) {
      return NextResponse.json(
        { success: false, error: '프로그램을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const input: UpdateProgramInput = {};

    if (body.program_type !== undefined) {
      if (!PROGRAM_TYPES.includes(body.program_type)) {
        return NextResponse.json(
          { success: false, error: '올바른 종류를 선택하세요.' },
          { status: 400 }
        );
      }
      input.program_type = body.program_type;
    }
    const textFields: (keyof UpdateProgramInput)[] = [
      'title_ko', 'title_en', 'summary_ko', 'summary_en', 'description_ko', 'description_en',
      'age_range', 'schedule_ko', 'schedule_en', 'start_date', 'end_date',
      'weekdays', 'class_start_time', 'class_end_time', 'term_start_date', 'term_end_date',
      'price_ko', 'price_en', 'location_ko', 'location_en', 'slug',
      'poster_url', 'poster_r2_key', 'thumbnail_url', 'thumbnail_r2_key',
    ];
    for (const field of textFields) {
      if (body[field] !== undefined) {
        input[field] = body[field];
      }
    }
    if (body.is_published !== undefined) input.is_published = body.is_published;
    if (body.is_featured !== undefined) input.is_featured = body.is_featured;
    if (body.sort_order !== undefined) input.sort_order = body.sort_order;

    // 포스터 교체 시 기존 R2 파일 삭제
    if (input.poster_r2_key && program.poster_r2_key && program.poster_r2_key !== input.poster_r2_key) {
      try {
        await deleteFromR2(program.poster_r2_key);
      } catch (e) {
        console.warn('Failed to delete old poster from R2:', e);
      }
    }
    if (input.thumbnail_r2_key && program.thumbnail_r2_key && program.thumbnail_r2_key !== input.thumbnail_r2_key) {
      try {
        await deleteFromR2(program.thumbnail_r2_key);
      } catch (e) {
        console.warn('Failed to delete old thumbnail from R2:', e);
      }
    }

    await updateProgram(programId, input);
    if (body.supplies !== undefined) {
      await setProgramSupplies(programId, normalizeSupplyLinks(body.supplies));
    }
    if (body.supply_sets !== undefined) {
      await setProgramSupplySets(programId, normalizeSupplySetLinks(body.supply_sets));
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin program update error:', error);
    return NextResponse.json(
      { success: false, error: '프로그램 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const programId = parseInt(id);
    if (isNaN(programId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const removed = await deleteProgram(programId);
    if (!removed) {
      return NextResponse.json(
        { success: false, error: '프로그램을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // R2 정리 (DB CASCADE는 program_images 행을 지우지만 R2 객체는 별도 삭제)
    for (const image of removed.images) {
      try {
        await deleteFromR2(image.r2_key);
      } catch (e) {
        console.warn('Failed to delete image from R2:', e);
      }
    }
    if (removed.poster_r2_key) {
      try {
        await deleteFromR2(removed.poster_r2_key);
      } catch (e) {
        console.warn('Failed to delete poster from R2:', e);
      }
    }
    if (removed.thumbnail_r2_key) {
      try {
        await deleteFromR2(removed.thumbnail_r2_key);
      } catch (e) {
        console.warn('Failed to delete thumbnail from R2:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin program delete error:', error);
    return NextResponse.json(
      { success: false, error: '프로그램 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
