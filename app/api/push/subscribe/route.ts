import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { upsertSubscription, type WebPushSubscriptionJSON } from '@/lib/push/subscriptions';

/** 현재 로그인 회원의 푸시 구독을 등록(upsert)한다. */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { subscription?: WebPushSubscriptionJSON }
      | null;
    const subscription = body?.subscription;
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: '구독 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent')?.slice(0, 255) ?? null;
    const ok = await upsertSubscription(session.user.id, subscription, userAgent);
    if (!ok) {
      return NextResponse.json({ error: '구독 키가 누락되었습니다.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: '알림이 켜졌습니다.' });
  } catch (error) {
    console.error('push subscribe error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
