/**
 * POST /api/confirm/banner — 인쇄물 도안 회신 접수
 *
 * 회신은 **저장하지 않는다.** 메일 한 통이 전부다. 그래서 다른 공개 폼과 달리
 * notifyEvent를 응답 뒤로 미루지 않고 기다린다 — 발송이 실패했는데 화면에
 * "전달했습니다"가 뜨면 회신은 사라지고 보내신 분은 답을 준 줄 아신다.
 *
 * 봇 방어는 app/api/applications/route.ts와 같은 관용구(본문 크기·허니팟·
 * 최소 제출 시간·길이 제한). 공개 주소이므로 없으면 스팸이 학원 메일함으로 간다.
 */

import { NextResponse } from 'next/server';
import { notifyEvent } from '@/lib/mail/notify';
import { parseBannerFeedback } from '@/lib/print/bannerConfirm';
import { resolvePrintFeedbackTo } from '@/lib/print/feedbackRecipients';

export const runtime = 'nodejs';

const MIN_SUBMIT_MS = 2000;
const MAX_BODY_BYTES = 32 * 1024;
/** 회신이 도착할 자리를 알려 주는 링크 — 메일에서 도안을 다시 열 수 있게 */
const PAGE_PATH = '/confirm/banner';

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: '보내신 내용이 너무 깁니다.' },
        { status: 413 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    // 허니팟: 봇이 채우는 숨김 칸이 비어 있지 않으면 조용히 성공으로 돌려보낸다
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ success: true });
    }

    // 최소 제출 시간 — 화면이 그려진 시각(_t)이 없거나 2초 미만이면 사람이 아니다
    const renderedAt = Number(body._t);
    if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_SUBMIT_MS) {
      return NextResponse.json(
        { success: false, error: '잠시 후 다시 보내 주세요.' },
        { status: 429 }
      );
    }

    const parsed = parseBannerFeedback(body);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const result = await notifyEvent('print.feedback', {
      // 관리 콘솔의 '운영진 주소'는 학원 대표 메일이다. 도안 회신은 그 답으로
      // 일할 사람에게 가야 하므로 이 사건만 수신처를 따로 준다.
      staffTo: resolvePrintFeedbackTo(process.env.PRINT_FEEDBACK_TO),
      data: {
        title: '퍼레이드 배너 · 북 배너',
        message: parsed.value.note,
        url: `${origin}${PAGE_PATH}`,
      },
    });

    // 한 통도 나가지 않았으면 실패다. 회신이 남는 곳은 이 메일뿐이므로
    // 화면에 "전달됨"이라고 말하면 안 된다.
    if (result.sent === 0) {
      console.error('[confirm/banner] 회신 메일 발송 실패', result.outcomes);
      return NextResponse.json(
        { success: false, error: '메일 전달에 실패했습니다.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[confirm/banner] 회신 접수 실패:', error);
    return NextResponse.json(
      { success: false, error: '접수 중 문제가 생겼습니다.' },
      { status: 500 }
    );
  }
}
