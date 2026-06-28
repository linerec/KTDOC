import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { markRead, markAllRead, deleteInboxItem } from '@/lib/push/notifications';

/** 읽음 처리 — body {all:true} 면 전체, {id} 면 한 건. 본인 행만. */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as
      | { id?: number; all?: boolean }
      | null;

    if (body?.all) {
      await markAllRead(session.user.id);
      return NextResponse.json({ success: true });
    }
    const id = Number(body?.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: '대상이 올바르지 않습니다.' }, { status: 400 });
    }
    await markRead(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('inbox read error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/** 한 건 삭제 — body {id}. 본인 행만. */
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as { id?: number } | null;
    const id = Number(body?.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: '대상이 올바르지 않습니다.' }, { status: 400 });
    }
    await deleteInboxItem(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('inbox delete error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
