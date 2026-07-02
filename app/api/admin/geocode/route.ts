/**
 * Admin Geocode API
 * GET /api/admin/geocode?q=<검색어> — 주소·장소 자동완성(이벤트 폼용)
 *
 * 지오코딩은 반드시 이 서버 프록시를 거친다 — 제공자를 API 키가 필요한 것(Google 등)으로
 * 교체해도 키가 클라이언트에 노출되지 않고, 클라이언트 코드는 그대로다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getMapsProvider } from '@/lib/maps';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (q.length < 3) {
      return NextResponse.json({ success: true, data: [] });
    }

    const results = await getMapsProvider().geocode(q, { limit: 6 });
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('지오코딩 오류:', error);
    return NextResponse.json(
      { success: false, error: '주소 검색에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 502 }
    );
  }
}
