import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getAllLocaleMessages, upsertLocale, deleteLocale } from '@/lib/d1';

// GET - Fetch all locale data from D1
export async function GET() {
  try {
    const { ko, en } = await getAllLocaleMessages();

    return NextResponse.json({
      success: true,
      messages: { ko, en },
      langs: ['ko', 'en'],
    });
  } catch (error) {
    console.error('Locale fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch locale data' },
      { status: 500 }
    );
  }
}

// POST - Save locale data to D1 (requires authentication)
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
    const { keycode, localeData } = body;

    if (!keycode) {
      return NextResponse.json(
        { success: false, error: '키코드가 필요합니다.' },
        { status: 400 }
      );
    }

    await upsertLocale(
      keycode,
      localeData.ko || '',
      localeData.en || ''
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Locale save error:', error);
    return NextResponse.json(
      { success: false, error: '저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete locale entry from D1 (requires authentication)
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keycode = searchParams.get('keycode');

    if (!keycode) {
      return NextResponse.json(
        { success: false, error: '키코드가 필요합니다.' },
        { status: 400 }
      );
    }

    const deleted = await deleteLocale(keycode);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '해당 키코드를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Locale delete error:', error);
    return NextResponse.json(
      { success: false, error: '삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
