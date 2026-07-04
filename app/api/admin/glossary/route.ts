/**
 * Admin Glossary API (말모이)
 * GET  /api/admin/glossary - 용어 목록 (관리자용, 비공개 포함)
 * POST /api/admin/glossary - 용어 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getGlossaryTerms, createGlossaryTerm } from '@/lib/d1';
import type { CreateGlossaryTermInput } from '@/types/glossary';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const result = await getGlossaryTerms({
      categoryId: categoryParam ? parseInt(categoryParam) || undefined : undefined,
      search: searchParams.get('search') || undefined,
      published: 'all',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin glossary fetch error:', error);
    return NextResponse.json(
      { success: false, error: '용어 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (!body.term_ko) {
      return NextResponse.json(
        { success: false, error: '용어(한글)는 필수입니다.' },
        { status: 400 }
      );
    }

    const input: CreateGlossaryTermInput = {
      term_ko: body.term_ko,
      term_en: body.term_en,
      romanization: body.romanization,
      pronunciation: body.pronunciation,
      definition_ko: body.definition_ko,
      definition_en: body.definition_en,
      example_ko: body.example_ko,
      example_en: body.example_en,
      category_id: body.category_id ?? null,
      is_published: body.is_published ?? true,
      sort_order: body.sort_order,
      slug: body.slug,
    };

    const id = await createGlossaryTerm(input);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin glossary create error:', error);
    return NextResponse.json(
      { success: false, error: '용어 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
