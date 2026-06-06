/**
 * Public Programs API (fallback)
 * GET /api/programs - 공개된 프로그램 목록
 * 페이지는 보통 lib/d1를 직접 호출하므로 이 라우트는 외부/클라이언트 fallback 용도.
 */

import { NextResponse } from 'next/server';
import { getPrograms } from '@/lib/d1';
import { PROGRAM_TYPES, type ProgramType } from '@/types/programs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam), 100) : 100;

    const result = await getPrograms({
      type:
        typeParam && PROGRAM_TYPES.includes(typeParam as ProgramType)
          ? (typeParam as ProgramType)
          : undefined,
      featured: searchParams.get('featured') === 'true' ? true : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit,
      published: true,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Public programs fetch error:', error);
    return NextResponse.json(
      { success: false, error: '프로그램 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
