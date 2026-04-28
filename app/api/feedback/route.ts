/**
 * Feedback API - Requirements draft form submission
 * POST /api/feedback
 *
 * Sends form responses to owenkdev@gmail.com via Resend.
 * Requires RESEND_API_KEY environment variable.
 *
 * Get a free API key at https://resend.com (3000 emails/month free).
 * Default sender `onboarding@resend.dev` works without domain verification.
 */

import { NextResponse } from 'next/server';

const RECIPIENT = 'owenkdev@gmail.com';
const FROM = 'KTDOC Form <onboarding@resend.dev>';

interface FeedbackBody {
  subject: string;
  body: string;
  isTest?: boolean;
}

export async function POST(request: Request) {
  try {
    const { subject, body, isTest } = (await request.json()) as FeedbackBody;

    if (!subject || !body) {
      return NextResponse.json(
        { success: false, error: 'subject와 body가 필요합니다.' },
        { status: 400 }
      );
    }

    if (body.length > 50000) {
      return NextResponse.json(
        { success: false, error: '본문이 너무 깁니다 (50KB 초과).' },
        { status: 413 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'RESEND_API_KEY가 설정되어 있지 않습니다.',
          hint: 'Vercel 환경변수에 RESEND_API_KEY를 추가하세요. https://resend.com 에서 무료 키 발급 가능.',
        },
        { status: 503 }
      );
    }

    const finalSubject = isTest ? `[테스트] ${subject}` : subject;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [RECIPIENT],
        subject: finalSubject,
        text: body,
        reply_to: RECIPIENT,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Resend API error:', response.status, errText);
      return NextResponse.json(
        {
          success: false,
          error: 'Resend 발송 실패',
          status: response.status,
          details: errText,
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { id?: string };
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류';
    console.error('feedback API error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
