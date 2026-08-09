'use client';

/**
 * ProgramTable
 * 관리자용 수업·프로그램·캠프 목록 테이블 (gallery EventTable 패턴).
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ProgramWithMeta } from '@/types/programs';
import { useT } from '@/lib/i18n/useT';
import { programTypeLabel } from '@/lib/i18n/programLabels';

interface ProgramTableProps {
  programs: ProgramWithMeta[];
}

function scheduleSummary(p: ProgramWithMeta): string {
  if (p.program_type === 'camp') {
    if (p.start_date && p.end_date) return `${p.start_date} ~ ${p.end_date}`;
    if (p.start_date) return p.start_date;
    return '-';
  }
  return p.schedule_ko || '-';
}

export default function ProgramTable({ programs }: ProgramTableProps) {
  const router = useRouter();
  const t = useT();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (program: ProgramWithMeta) => {
    if (
      !confirm(
        t('admin.programs.deleteConfirm', '"{title}" 프로그램을 삭제하시겠습니까?', {
          title: program.title_ko,
        })
      )
    )
      return;

    setDeletingId(program.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/programs/${program.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.deleteFailed', '삭제에 실패했습니다.')
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (program: ProgramWithMeta) => {
    setTogglingId(program.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/programs/${program.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !program.is_published }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          data.error || t('admin.common.toggleFailed', '상태 변경에 실패했습니다.')
        );
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.common.toggleFailed', '상태 변경에 실패했습니다.')
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (programs.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>{t('admin.programs.empty', '아직 등록된 프로그램이 없습니다.')}</p>
        <Link href="/admin/programs/new" className="admin-btn admin-btn-primary">
          {t('admin.programs.emptyCta', '첫 프로그램 만들기')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>{t('admin.common.colPhoto', '사진')}</th>
              <th>{t('admin.programs.colTitle', '프로그램명')}</th>
              <th style={{ width: '90px' }}>{t('admin.programs.colType', '종류')}</th>
              <th style={{ width: '150px' }}>{t('admin.programs.colSchedule', '일정')}</th>
              <th style={{ width: '92px' }}>{t('admin.common.colPublished', '공개 상태')}</th>
              <th style={{ width: '280px' }}>{t('admin.common.colActions', '작업')}</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((program) => {
              const thumb = program.thumbnail_url || program.poster_url || program.first_image_url;
              return (
                <tr key={program.id}>
                  <td>
                    <div className="admin-table-thumbnail">
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt={program.title_ko}
                          width={60}
                          height={40}
                          className="admin-table-thumb-img"
                        />
                      ) : (
                        <div className="admin-table-thumb-placeholder">-</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <Link href={`/admin/programs/${program.id}`} className="admin-table-link">
                      <span className="admin-table-title">{program.title_ko}</span>
                      {program.title_en && (
                        <span className="admin-table-subtitle">{program.title_en}</span>
                      )}
                    </Link>
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge-${program.program_type}`}>
                      {programTypeLabel(t, program.program_type)}
                    </span>
                  </td>
                  <td>{scheduleSummary(program)}</td>
                  <td>
                    <button
                      type="button"
                      className={`admin-badge ${
                        program.is_published ? 'admin-badge-success' : 'admin-badge-muted'
                      }`}
                      onClick={() => handleTogglePublish(program)}
                      disabled={togglingId === program.id}
                    >
                      {togglingId === program.id
                        ? '...'
                        : program.is_published
                          ? t('admin.common.published', '공개')
                          : t('admin.common.unpublished', '비공개')}
                    </button>
                  </td>
                  <td>
                    <div className="admin-table-actions">
                      <Link
                        href={`/admin/programs/${program.id}`}
                        className="admin-btn admin-btn-sm"
                      >
                        {t('admin.common.edit', '편집')}
                      </Link>
                      {program.is_published && (
                        <Link
                          href={`/classes/${program.slug}`}
                          target="_blank"
                          className="admin-btn admin-btn-sm admin-btn-outline"
                        >
                          {t('admin.common.publicPage', '공개 페이지')}
                        </Link>
                      )}
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleDelete(program)}
                        disabled={deletingId === program.id}
                      >
                        {deletingId === program.id ? '...' : t('admin.common.delete', '삭제')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
