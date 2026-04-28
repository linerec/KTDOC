/**
 * Feedback API - Requirements draft form submission
 * POST /api/feedback
 *
 * Sends form responses to owenkdev@gmail.com via Gmail SMTP.
 * Requires GMAIL_USER and GMAIL_APP_PASSWORD environment variables.
 *
 * App password setup: https://myaccount.google.com/apppasswords
 * (Requires 2-step verification on the Google account.)
 */

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const RECIPIENT = 'owenkdev@gmail.com';

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

    const user = process.env.GMAIL_USER;
    const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');

    if (!user || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gmail 인증정보가 설정되지 않았습니다.',
          hint: 'Vercel 환경변수에 GMAIL_USER, GMAIL_APP_PASSWORD를 추가하세요.',
        },
        { status: 503 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: password },
    });

    const finalSubject = isTest ? `[테스트] ${subject}` : subject;

    const info = await transporter.sendMail({
      from: `"KTDOC 요구사항 폼" <${user}>`,
      to: RECIPIENT,
      replyTo: RECIPIENT,
      subject: finalSubject,
      text: body,
    });

    return NextResponse.json({ success: true, id: info.messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류';
    console.error('feedback API error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
