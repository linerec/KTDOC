/**
 * Gallery Categories API - 카테고리 목록
 * GET /api/gallery/categories
 */

import { NextResponse } from 'next/server';
import { getCategories, getCategoryBySlug } from '@/lib/d1';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (slug) {
      // Get single category by slug
      const category = await getCategoryBySlug(slug);

      if (!category) {
        return NextResponse.json(
          { success: false, error: '카테고리를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: category,
      });
    }

    // Get all categories
    const categories = await getCategories();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Gallery categories fetch error:', error);
    return NextResponse.json(
      { success: false, error: '카테고리 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
