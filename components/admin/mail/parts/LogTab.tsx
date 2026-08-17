'use client';

/**
 * 탭 4 · 발송 내역 — 사용량 게이지, 검색, 그리고 실제로 나간 본문
 *
 * 건너뛴 것과 한도에 막힌 것까지 보여준다. "왜 안 왔지"의 답이 대부분
 * 거기 있기 때문이다 — 성공만 보이면 그 질문에 답할 수 없다.
 */

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import { MAIL_EVENTS } from '@/lib/mail/events';
import type { MailLogRow, MailLogStatus, MailUsage } from '@/types/mail';

interface Props {
  usage: MailUsage;
  dailyLimit: number;
  monthlyLimit: number;
  warnAtPercent: number;
  onReload: () => void;
}

const STATUS_LABEL: Record<MailLogStatus, string> = {
  sent: '보냄',
  failed: '실패',
  skipped: '건너뜀',
  quota_blocked: '한도 초과',
};

const SKIP_REASON: Record<string, string> = {
  'switch-off': '설정에서 꺼둠',
  'opted-out': '회원이 수신 거부',
  'no-address': '이메일 주소 없음',
  'invalid-address': '주소 형식 오류',
  'daily-limit': '하루 한도 초과',
  'monthly-limit': '한 달 한도 초과',
};

function eventLabel(key: string): string {
  return MAIL_EVENTS.find((e) => e.key === key)?.label ?? key;
}

function pct(sent: number, limit: number): number {
  if (!limit || limit <= 0) return 100;
  return Math.min(100, Math.round((sent / limit) * 100));
}

function formatWhen(iso: string): string {
  // D1은 'YYYY-MM-DD HH:MM:SS'(UTC)로 준다 — 브라우저 지역 시간으로 보여준다.
  const d = new Date(`${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LogTab({
  usage,
  dailyLimit,
  monthlyLimit,
  warnAtPercent,
  onReload,
}: Props) {
  const t = useT();
  const [rows, setRows] = useState<MailLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    eventKey: '',
    status: '',
    q: '',
  });
  const [detail, setDetail] = useState<{
    row: MailLogRow;
    redacted: boolean;
  } | null>(null);

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`/api/admin/mail/log?${params}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        success: boolean;
        rows?: MailLogRow[];
        total?: number;
      };
      if (json.success) {
        setRows(json.rows ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: number) => {
    const res = await fetch(`/api/admin/mail/log?id=${id}`, { cache: 'no-store' });
    const json = (await res.json()) as {
      success: boolean;
      row?: MailLogRow;
      redacted?: boolean;
    };
    if (json.success && json.row) {
      setDetail({ row: json.row, redacted: json.redacted === true });
    }
  };

  const dailyPct = pct(usage.dailySent, dailyLimit);
  const monthlyPct = pct(usage.monthlySent, monthlyLimit);

  return (
    <div className="mail-tab">
      <section className="admin-form-section mail-section">
        <h3 className="admin-form-section-title">
          {t('admin.mail.usage.title', '얼마나 보냈나')}
        </h3>

        <div className="mail-gauges">
          <div className="mail-gauge">
            <div className="mail-gauge-head">
              <span>{t('admin.mail.usage.today', '오늘')}</span>
              <strong>
                {usage.dailySent.toLocaleString()} / {dailyLimit.toLocaleString()}
              </strong>
            </div>
            <div
              className={`mail-gauge-bar${dailyPct >= warnAtPercent ? ' is-warn' : ''}`}
              role="progressbar"
              aria-valuenow={usage.dailySent}
              aria-valuemin={0}
              aria-valuemax={dailyLimit}
            >
              <span style={{ width: `${dailyPct}%` }} />
            </div>
          </div>

          <div className="mail-gauge">
            <div className="mail-gauge-head">
              <span>{t('admin.mail.usage.month', '이번 달')}</span>
              <strong>
                {usage.monthlySent.toLocaleString()} /{' '}
                {monthlyLimit.toLocaleString()}
              </strong>
            </div>
            <div
              className={`mail-gauge-bar${monthlyPct >= warnAtPercent ? ' is-warn' : ''}`}
              role="progressbar"
              aria-valuenow={usage.monthlySent}
              aria-valuemin={0}
              aria-valuemax={monthlyLimit}
            >
              <span style={{ width: `${monthlyPct}%` }} />
            </div>
          </div>
        </div>

        <p className="admin-form-help">
          {t(
            'admin.mail.usage.help',
            '보낸 사람 수로 셉니다. 여러 명에게 한 번에 보내면 사람 수만큼 늘어납니다.'
          )}{' '}
          <button
            type="button"
            className="mail-link-btn"
            onClick={() => {
              onReload();
              void load();
            }}
          >
            {t('admin.mail.usage.refresh', '새로고침')}
          </button>
        </p>
      </section>

      <section className="admin-form-section mail-section">
        <h3 className="admin-form-section-title">
          {t('admin.mail.log.title', '보낸 내역')}
        </h3>

        <div className="mail-log-filters">
          <input
            type="date"
            value={filters.from}
            aria-label={t('admin.mail.log.from', '시작일')}
            onChange={(e) => {
              setPage(1);
              setFilters((p) => ({ ...p, from: e.target.value }));
            }}
          />
          <span className="mail-filter-sep">~</span>
          <input
            type="date"
            value={filters.to}
            aria-label={t('admin.mail.log.to', '종료일')}
            onChange={(e) => {
              setPage(1);
              setFilters((p) => ({ ...p, to: e.target.value }));
            }}
          />
          <select
            value={filters.eventKey}
            aria-label={t('admin.mail.log.event', '알림 종류')}
            onChange={(e) => {
              setPage(1);
              setFilters((p) => ({ ...p, eventKey: e.target.value }));
            }}
          >
            <option value="">{t('admin.mail.log.allEvents', '전체 종류')}</option>
            {MAIL_EVENTS.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            aria-label={t('admin.mail.log.status', '상태')}
            onChange={(e) => {
              setPage(1);
              setFilters((p) => ({ ...p, status: e.target.value }));
            }}
          >
            <option value="">{t('admin.mail.log.allStatus', '전체 상태')}</option>
            {(Object.keys(STATUS_LABEL) as MailLogStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <input
            type="search"
            className="mail-log-search"
            value={filters.q}
            placeholder={t(
              'admin.mail.log.search',
              '이메일 주소 또는 제목으로 검색'
            )}
            onChange={(e) => {
              setPage(1);
              setFilters((p) => ({ ...p, q: e.target.value }));
            }}
          />
        </div>

        {loading ? (
          <p className="admin-empty-state">
            {t('admin.mail.log.loading', '불러오는 중…')}
          </p>
        ) : rows.length === 0 ? (
          <p className="admin-empty-state">
            {t('admin.mail.log.empty', '아직 보낸 메일이 없습니다.')}
          </p>
        ) : (
          <>
            <div className="mail-log-table-wrap">
              <table className="mail-log-table">
                <thead>
                  <tr>
                    <th scope="col">{t('admin.mail.log.colWhen', '시각')}</th>
                    <th scope="col">{t('admin.mail.log.colEvent', '종류')}</th>
                    <th scope="col">{t('admin.mail.log.colTo', '받는 사람')}</th>
                    <th scope="col">{t('admin.mail.log.colSubject', '제목')}</th>
                    <th scope="col">{t('admin.mail.log.colStatus', '상태')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="mail-log-row"
                      onClick={() => void openDetail(row.id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void openDetail(row.id);
                        }
                      }}
                    >
                      <td className="mail-log-when">{formatWhen(row.created_at)}</td>
                      <td>
                        {eventLabel(row.event_key)}
                        {row.batch_id && (
                          <span className="mail-batch-tag">
                            {t('admin.mail.log.batch', '단체')}
                          </span>
                        )}
                      </td>
                      <td className="mail-log-to">{row.to_address}</td>
                      <td className="mail-log-subject">{row.subject}</td>
                      <td>
                        <span className={`mail-status mail-status-${row.status}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                        {row.detail && (
                          <div className="mail-log-detail">
                            {SKIP_REASON[row.detail] ?? row.detail}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mail-pagination">
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('admin.mail.log.prev', '이전')}
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('admin.mail.log.next', '다음')}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {detail && (
        <div
          className="mail-detail-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.mail.log.detailTitle', '보낸 메일 내용')}
          onClick={() => setDetail(null)}
        >
          <div className="mail-detail" onClick={(e) => e.stopPropagation()}>
            <div className="mail-detail-head">
              <h4>{detail.row.subject}</h4>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setDetail(null)}
              >
                {t('admin.mail.log.close', '닫기')}
              </button>
            </div>
            <dl className="mail-detail-meta">
              <dt>{t('admin.mail.log.colWhen', '시각')}</dt>
              <dd>{formatWhen(detail.row.created_at)}</dd>
              <dt>{t('admin.mail.log.colTo', '받는 사람')}</dt>
              <dd>{detail.row.to_address}</dd>
              <dt>{t('admin.mail.log.colStatus', '상태')}</dt>
              <dd>
                {STATUS_LABEL[detail.row.status]}
                {detail.row.detail
                  ? ` — ${SKIP_REASON[detail.row.detail] ?? detail.row.detail}`
                  : ''}
              </dd>
            </dl>
            {detail.row.body ? (
              <pre className="mail-detail-body">{detail.row.body}</pre>
            ) : (
              <p className="mail-detail-redacted">
                {detail.redacted
                  ? t(
                      'admin.mail.log.redacted',
                      '보안을 위해 본문을 저장하지 않는 메일입니다(비밀번호가 들어 있습니다).'
                    )
                  : t('admin.mail.log.noBody', '저장된 본문이 없습니다.')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
