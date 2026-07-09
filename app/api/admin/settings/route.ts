import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import {
  getSetting,
  setSetting,
  SETTING_HERO_FEATURED_VIDEO,
  SETTING_HERO_OVERLAY,
  SETTING_HEADER_BACKGROUND,
  SETTING_CALENDAR_CONFIG,
} from '@/lib/d1';
import { SETTING_SEO_BUSINESS } from '@/lib/seoBusiness';

// 임의 키 쓰기를 막기 위해 허용된 설정 키만 받는다.
const ALLOWED_KEYS = new Set<string>([
  SETTING_HERO_FEATURED_VIDEO,
  SETTING_HERO_OVERLAY,
  SETTING_HEADER_BACKGROUND,
  SETTING_CALENDAR_CONFIG,
  SETTING_SEO_BUSINESS,
]);

// GET - 설정값 조회 (관리자 전용)
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
    const key = searchParams.get('key');

    if (!key || !ALLOWED_KEYS.has(key)) {
      return NextResponse.json(
        { success: false, error: '허용되지 않은 설정 키입니다.' },
        { status: 400 }
      );
    }

    const value = await getSetting(key);
    return NextResponse.json({ success: true, data: { key, value } });
  } catch (error) {
    console.error('Setting fetch error:', error);
    return NextResponse.json(
      { success: false, error: '설정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

// POST - 설정값 저장 (관리자 전용)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value } = body as { key?: string; value?: string | null };

    if (!key || !ALLOWED_KEYS.has(key)) {
      return NextResponse.json(
        { success: false, error: '허용되지 않은 설정 키입니다.' },
        { status: 400 }
      );
    }

    // 빈 문자열은 null(자동/기본값 복원)로 정규화
    const normalized = value == null || value === '' ? null : String(value);
    await setSetting(key, normalized);

    // 홈(정적 ISR 페이지)을 즉시 무효화하여 변경이 방문자에게 바로 반영되게 한다.
    if (key === SETTING_HERO_FEATURED_VIDEO || key === SETTING_HERO_OVERLAY) {
      revalidatePath('/');
    }

    // 헤더 배경·SEO 비즈니스 정보(푸터 NAP + head JSON-LD)는 모든 페이지 공통(layout)
    // → 레이아웃 전체를 무효화한다.
    if (key === SETTING_HEADER_BACKGROUND || key === SETTING_SEO_BUSINESS) {
      revalidatePath('/', 'layout');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setting save error:', error);
    return NextResponse.json(
      { success: false, error: '저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
