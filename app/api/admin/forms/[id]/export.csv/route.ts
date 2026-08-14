/**
 * GET /api/admin/forms/[id]/export.csv — 응답 내보내기
 *
 * 민감 열(의료정보)은 기본으로 빠진다. `?include_sensitive=1` 로 넣을 수 있지만
 * **관리 권한이 있어야 하고, 각 응답에 열람 기록이 남는다.**
 * 실수로 알레르기 정보가 실린 스프레드시트는 되돌릴 방법이 없다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getFormById, getResponsesForExport, recordSensitiveView } from '@/lib/d1';
import { buildCsv } from '@/lib/forms/csv';
import type { FormSchema } from '@/types/forms';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const formId = Number(id);
    if (!Number.isInteger(formId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const form = await getFormById(formId);
    if (!form) {
      return NextResponse.json({ success: false, error: '신청서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const wantsSensitive = new URL(request.url).searchParams.get('include_sensitive') === '1';
    const viewerId = session?.user?.id ?? null;
    // 민감 열은 관리 권한 + 로그인 신원이 확인될 때만. 기록을 남길 수 없으면 넣지 않는다.
    const includeSensitive =
      wantsSensitive && session?.user?.isAdmin === true && viewerId != null;

    const rows = await getResponsesForExport(formId);

    if (includeSensitive) {
      for (const r of rows.filter((x) => x.has_medical === 1)) {
        await recordSensitiveView({
          responseId: r.id,
          viewerId: viewerId!,
          viewerName: session?.user?.name ?? null,
          context: 'csv',
        });
      }
    }

    const csv = buildCsv({
      schema: JSON.parse(form.schema_json) as FormSchema,
      rows,
      includeSensitive,
    });

    const filename = `${form.season ?? form.slug}-응답.csv`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Admin form export error:', error);
    return NextResponse.json({ success: false, error: '내보내지 못했습니다.' }, { status: 500 });
  }
}
