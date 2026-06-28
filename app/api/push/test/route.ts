import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendToUsers } from '@/lib/push/webpush';

/** 본인에게 테스트 알림을 보낸다(온보딩 "테스트 알림 받기"). */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const result = await sendToUsers([session.user.id], {
      title: 'KTDOC 알림 테스트',
      body: '알림이 정상적으로 설정되었습니다. 이렇게 도착합니다. 🔔',
      url: '/admin',
      tag: 'ktdoc-test',
    });

    if (result.sent === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            '보낼 구독이 없습니다. 알림을 먼저 켜고(권한 허용) 다시 시도해 주세요.',
          ...result,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `테스트 알림을 보냈습니다(${result.sent}대 기기).`,
      ...result,
    });
  } catch (error) {
    console.error('push test error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
