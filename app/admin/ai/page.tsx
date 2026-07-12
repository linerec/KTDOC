/**
 * Admin AI 설정 — /admin/ai (admin 전용)
 *
 * LLM 제공자 API 키(D1 저장) · 모델 목록 최신화 · 용도별 모델 지정.
 * 사이트 기능들은 lib/ai의 askAI('용도키', …)로 여기 지정된 모델을 사용한다.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import AiSettingsManager from '@/components/admin/ai/AiSettingsManager';

export const metadata = {
  title: 'AI 설정 | KTDOC Admin',
};

export default async function AdminAiPage() {
  const session = await auth();
  await requireMenuAccess(session, 'settings.ai');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>AI 설정</span>
          </div>
          <h1 className="admin-title">AI 설정</h1>
          <p className="admin-subtitle">
            사이트가 사용할 AI(LLM)를 설정합니다. 제공자 API 키를 저장하고, 모델 목록을
            최신화한 뒤, 기능(용도)별로 어떤 모델을 쓸지 지정하세요.
          </p>
        </div>
      </div>

      <AiSettingsManager />
    </div>
  );
}
