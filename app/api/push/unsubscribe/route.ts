import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteSubscriptionByEndpoint } from '@/lib/push/subscriptions';

/** 현재 기기의 푸시 구독을 해제한다(endpoint 기준). */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
    const endpoint = body?.endpoint;
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint가 필요합니다.' }, { status: 400 });
    }

    await deleteSubscriptionByEndpoint(endpoint);
    return NextResponse.json({ success: true, message: '알림이 꺼졌습니다.' });
  } catch (error) {
    console.error('push unsubscribe error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
