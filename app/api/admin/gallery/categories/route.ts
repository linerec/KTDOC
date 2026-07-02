/**
 * Admin Gallery Categories API
 * GET /api/admin/gallery/categories - 카테고리 목록
 * POST /api/admin/gallery/categories - 카테고리 생성
 * PUT /api/admin/gallery/categories - 카테고리 수정
 * DELETE /api/admin/gallery/categories?id=xxx - 카테고리 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  countEventsInCategory,
} from '@/lib/d1';
import type { CreateCategoryInput } from '@/types/gallery';

// GET - 카테고리 목록
export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const categories = await getCategories();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Admin gallery categories fetch error:', error);
    return NextResponse.json(
      { success: false, error: '카테고리 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST - 카테고리 생성
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
    const { slug, name_ko, name_en, sort_order } = body;

    if (!slug || !name_ko || !name_en) {
      return NextResponse.json(
        { success: false, error: '슬러그, 한글명, 영문명은 필수입니다.' },
        { status: 400 }
      );
    }

    const input: CreateCategoryInput = {
      slug,
      name_ko,
      name_en,
      sort_order: sort_order ?? 0,
    };

    const categoryId = await createCategory(input);

    return NextResponse.json({
      success: true,
      data: { id: categoryId },
    });
  } catch (error) {
    console.error('Admin gallery category create error:', error);
    return NextResponse.json(
      { success: false, error: '카테고리 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT - 카테고리 수정
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, slug, name_ko, name_en, sort_order } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '카테고리 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const category = await getCategoryById(id);
    if (!category) {
      return NextResponse.json(
        { success: false, error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const input: Partial<CreateCategoryInput> = {};
    if (slug !== undefined) input.slug = slug;
    if (name_ko !== undefined) input.name_ko = name_ko;
    if (name_en !== undefined) input.name_en = name_en;
    if (sort_order !== undefined) input.sort_order = sort_order;

    await updateCategory(id, input);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin gallery category update error:', error);
    return NextResponse.json(
      { success: false, error: '카테고리 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - 카테고리 삭제
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '카테고리 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const categoryId = parseInt(id);
    const category = await getCategoryById(categoryId);

    if (!category) {
      return NextResponse.json(
        { success: false, error: '카테고리를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // FK(NO ACTION) 위반으로 불친절한 500이 나기 전에, 사용 중이면 명확히 안내한다
    const inUse = await countEventsInCategory(categoryId);
    if (inUse > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `이 카테고리를 사용하는 이벤트가 ${inUse}개 있습니다. 먼저 해당 이벤트의 카테고리를 변경한 뒤 삭제해주세요.`,
        },
        { status: 409 }
      );
    }

    await deleteCategory(categoryId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin gallery category delete error:', error);
    return NextResponse.json(
      { success: false, error: '카테고리 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
