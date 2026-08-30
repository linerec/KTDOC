import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getAllLocaleMessages, upsertLocale, deleteLocale } from '@/lib/d1';
import { isRichKeycode } from '@/lib/i18n/richKeys';
import { sanitizeRichText } from '@/lib/html/richText';

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

    // 긴 본문 키는 저장 전에 깎는다. 화면에서 이미 깎아 보내지만, 화면을 거치지 않는
    // 저장 경로(스크립트·옛 클라이언트)도 같은 문을 지나야 한다 — 이 값들은
    // dangerouslySetInnerHTML 로 그대로 페이지 마크업이 된다.
    // 짧은 문구 키는 건드리지 않는다: locale 파일에 <br/>·<a class="...">로 손질해 둔
    // 값이 열댓 개 있고, 같은 허용 목록으로 깎으면 조용히 모양이 바뀐다.
    const clean = isRichKeycode(keycode)
      ? {
          ko: sanitizeRichText(localeData?.ko || ''),
          en: sanitizeRichText(localeData?.en || ''),
        }
      : { ko: localeData?.ko || '', en: localeData?.en || '' };

    await upsertLocale(keycode, clean.ko, clean.en);

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
