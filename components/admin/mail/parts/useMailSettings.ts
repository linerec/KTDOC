'use client';

/**
 * 메일 설정 화면의 상태 — 불러오기·부분 저장·테스트 발송
 *
 * 저장은 항상 "그 탭이 건드린 키만" 보낸다(부분 업데이트). 전체를 보내면
 * 다른 탭에서 방금 바꾼 값이 화면의 낡은 사본으로 되돌아간다.
 *
 * 시크릿 입력칸은 값을 서버에서 받지 못한다(마스킹). 그래서 빈 칸으로 두면
 * 서버가 기존 값을 유지하고, 지우려면 명시적인 clear 플래그를 보낸다.
 */

import { useCallback, useEffect, useState } from 'react';
import type { MailUsage, PublicMailConfig } from '@/types/mail';

export interface EffectiveState {
  ready: boolean;
  reason?: string;
  provider?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

interface LoadResponse {
  success: boolean;
  config?: PublicMailConfig;
  usage?: MailUsage;
  effective?: EffectiveState;
  error?: string;
}

export function useMailSettings() {
  const [config, setConfig] = useState<PublicMailConfig | null>(null);
  const [usage, setUsage] = useState<MailUsage>({ dailySent: 0, monthlySent: 0 });
  const [effective, setEffective] = useState<EffectiveState>({ ready: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/mail', { cache: 'no-store' });
      const json = (await res.json()) as LoadResponse;
      if (!json.success || !json.config) {
        setError(json.error ?? '설정을 불러오지 못했습니다.');
        return;
      }
      setConfig(json.config);
      if (json.usage) setUsage(json.usage);
      if (json.effective) setEffective(json.effective);
      setError('');
    } catch {
      setError('설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 부분 저장. 성공하면 서버가 돌려준 설정으로 화면을 맞춘다. */
  const save = useCallback(
    async (patch: Record<string, unknown>, successMessage: string) => {
      setSaving(true);
      setError('');
      setNotice('');
      try {
        const res = await fetch('/api/admin/mail', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const json = (await res.json()) as LoadResponse;
        if (!res.ok || !json.success || !json.config) {
          setError(json.error ?? '저장에 실패했습니다.');
          return false;
        }
        setConfig(json.config);
        setNotice(successMessage);
        // 발신 정보를 바꾸면 "지금 실제로 나가는 경로"도 달라진다
        void load();
        return true;
      } catch {
        setError('저장에 실패했습니다.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  return {
    config,
    usage,
    effective,
    loading,
    saving,
    error,
    notice,
    setError,
    setNotice,
    save,
    reload: load,
  };
}

export interface TestSendResult {
  ok: boolean;
  message: string;
  detail?: string;
}

/** 테스트 발송 — 저장본을 대상으로 한다(화면의 미저장 값을 보내지 않는다). */
export async function sendTestMail(to: string): Promise<TestSendResult> {
  try {
    const res = await fetch('/api/admin/mail/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    const json = (await res.json()) as {
      success: boolean;
      error?: string;
      detail?: string;
      to?: string;
      provider?: string;
    };
    if (!res.ok || !json.success) {
      return {
        ok: false,
        message: json.error ?? '발송에 실패했습니다.',
        detail: json.detail,
      };
    }
    return {
      ok: true,
      message: `${json.to} 주소로 보냈습니다 (${json.provider}). 받은편지함을 확인해 주세요.`,
    };
  } catch {
    return { ok: false, message: '발송 요청 중 오류가 발생했습니다.' };
  }
}
