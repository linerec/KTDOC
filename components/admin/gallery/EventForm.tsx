'use client';

/**
 * EventForm Component
 * 이벤트 생성/편집 폼
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EventDetail, EventCategory, CreateEventInput, UpdateEventInput } from '@/types/gallery';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/types/members';
import ImageUploader from './ImageUploader';
import ImageSortable from './ImageSortable';
import VideoManager from './VideoManager';
import LocationPicker from './LocationPicker';
import SupplyPicker, { type PickerRow } from '@/components/admin/supplies/SupplyPicker';
import SetPicker, { type SetPickerRow } from '@/components/admin/supplies/SetPicker';
import type { SupplyItem, SupplySetWithItems } from '@/types/supplies';

interface EventFormProps {
  event?: EventDetail | null;
  categories: EventCategory[];
  isNew?: boolean;
  activeSupplies?: SupplyItem[];
  initialSupplies?: PickerRow[];
  activeSupplySets?: SupplySetWithItems[];
  initialSupplySets?: SetPickerRow[];
}

export default function EventForm({
  event,
  categories,
  isNew = false,
  activeSupplies = [],
  initialSupplies = [],
  activeSupplySets = [],
  initialSupplySets = [],
}: EventFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplies, setSupplies] = useState<PickerRow[]>(initialSupplies);
  const [supplySets, setSupplySets] = useState<SetPickerRow[]>(initialSupplySets);
  // 저장 완료 피드백(편집 시 화면 변화가 없어 명확한 신호가 필요)
  const [saved, setSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // 저장 시 회원에게 푸시 알림(신규는 기본 ON, 공개 상태일 때만 발송)
  const [notify, setNotify] = useState(isNew);
  const [notifyTarget, setNotifyTarget] = useState<'all' | 'role'>('role');
  const [notifyRoles, setNotifyRoles] = useState<MemberRole[]>(['student', 'parent']);
  const toggleNotifyRole = (r: MemberRole) =>
    setNotifyRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  // Form state
  const [formData, setFormData] = useState({
    title_ko: event?.title_ko || '',
    title_en: event?.title_en || '',
    event_date: event?.event_date?.split('T')[0] || '',
    category_id: event?.category_id || '',
    description_ko: event?.description_ko || '',
    description_en: event?.description_en || '',
    is_published: event?.is_published === 1,
    is_featured: event?.is_featured === 1,
    is_signature: event?.is_signature === 1,
    signature_order: event?.signature_order ?? 0,
    // 실행 정보(위치·시간·준비물)
    location: event?.location || '',
    location_url: event?.location_url || '',
    location_address: event?.location_address || '',
    location_lat: event?.location_lat ?? null,
    location_lng: event?.location_lng ?? null,
    call_time: event?.call_time || '',
    start_time: event?.start_time || '',
    end_time: event?.end_time || '',
    prep_notes: event?.prep_notes || '',
  });

  // Images and videos (managed separately)
  const [images, setImages] = useState(event?.images || []);
  const [videos, setVideos] = useState(event?.videos || []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    // 다시 편집하기 시작하면 이전 저장 성공 표시를 지운다(오해 방지).
    if (savedMsg) setSavedMsg('');
    if (saved) setSaved(false);
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg('');
    setSaving(true);

    try {
      const url = isNew
        ? '/api/admin/gallery/events'
        : `/api/admin/gallery/events/${event?.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const body: CreateEventInput | UpdateEventInput = {
        title_ko: formData.title_ko,
        title_en: formData.title_en || undefined,
        event_date: formData.event_date,
        category_id: formData.category_id ? Number(formData.category_id) : undefined,
        description_ko: formData.description_ko || undefined,
        description_en: formData.description_en || undefined,
        is_published: formData.is_published,
        is_featured: formData.is_featured,
        is_signature: formData.is_signature,
        signature_order: Number(formData.signature_order) || 0,
        // 빈 문자열을 보내면 서버가 null로 저장(값 지우기 지원)
        location: formData.location,
        location_url: formData.location_url,
        location_address: formData.location_address,
        location_lat: formData.location_lat,
        location_lng: formData.location_lng,
        call_time: formData.call_time,
        start_time: formData.start_time,
        end_time: formData.end_time,
        prep_notes: formData.prep_notes,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, supplies, supply_sets: supplySets }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '저장에 실패했습니다.');
      }

      // 저장 성공 후, 선택 시 회원에게 푸시 알림(공개 이벤트만). 실패해도 저장은 유지.
      const eventId = isNew ? data.data?.id : event?.id;
      let notifyNote = '';
      if (notify && formData.is_published && eventId) {
        try {
          const when = [formData.event_date, formData.start_time].filter(Boolean).join(' ');
          const loc = formData.location ? ` · ${formData.location}` : '';
          const title = `${isNew ? '[새 일정] ' : '[일정 변경] '}${formData.title_ko}`.slice(0, 200);
          const pushBody = (`${when}${loc}`.trim() || '자세히 보려면 탭하세요.').slice(0, 1000);
          const target =
            notifyTarget === 'all'
              ? { type: 'all' as const }
              : { type: 'role' as const, roles: notifyRoles };
          const pres = await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              body: pushBody,
              url: `/gallery/event/${eventId}`,
              target,
            }),
          });
          const pdata = await pres.json().catch(() => ({}));
          if (!pres.ok || pdata.error) {
            console.warn('알림 발송 실패:', pdata.error);
            notifyNote = ' (알림 발송은 실패했습니다)';
          } else {
            notifyNote = ' · 회원에게 알림을 보냈습니다';
          }
        } catch (err) {
          console.warn('알림 발송 오류:', err);
          notifyNote = ' (알림 발송은 실패했습니다)';
        }
      }

      // 저장 완료를 명확히 알린다.
      if (isNew && data.data?.id) {
        // 신규: 새 이벤트 편집 화면으로 이동(화면 전환 자체가 저장 신호)
        router.push(`/admin/gallery/${data.data.id}`);
      } else {
        // 편집: 화면이 그대로이므로 성공 메시지·버튼 상태로 강하게 표시
        setSaved(true);
        setSavedMsg(`저장되었습니다${notifyNote}.`);
        router.refresh();
        window.setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && (
        <div className="admin-alert admin-alert-error">
          {error}
        </div>
      )}

      <div className="admin-form-grid">
        {/* Basic Info Section */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">이벤트 기본 정보</h3>
          <p className="admin-form-help">
            이 정보가 공개 Gallery의 카드와 이벤트 상세 페이지에 표시됩니다.
          </p>

          <div className="admin-form-group">
            <label htmlFor="title_ko" className="admin-form-label">
              제목 (한글) <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title_ko"
              name="title_ko"
              value={formData.title_ko}
              onChange={handleChange}
              required
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="title_en" className="admin-form-label">
              제목 (영문)
            </label>
            <input
              type="text"
              id="title_en"
              name="title_en"
              value={formData.title_en}
              onChange={handleChange}
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="event_date" className="admin-form-label">
                행사 날짜 <span className="required">*</span>
              </label>
              <input
                type="date"
                id="event_date"
                name="event_date"
                value={formData.event_date}
                onChange={handleChange}
                required
                className="admin-form-input"
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="category_id" className="admin-form-label">
                카테고리
              </label>
              <select
                id="category_id"
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className="admin-form-select"
              >
                <option value="">선택 안함</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_ko}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 실행 정보 — 멤버가 "어디서·언제·무엇을 준비"를 바로 파악 */}
          <LocationPicker
            value={{
              location: formData.location,
              location_address: formData.location_address,
              location_lat: formData.location_lat,
              location_lng: formData.location_lng,
              location_url: formData.location_url,
            }}
            onChange={(patch) => {
              if (savedMsg) setSavedMsg('');
              if (saved) setSaved(false);
              setFormData((prev) => ({ ...prev, ...patch }));
            }}
          />

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="call_time" className="admin-form-label">집합 시간</label>
              <input
                type="time"
                id="call_time"
                name="call_time"
                value={formData.call_time}
                onChange={handleChange}
                className="admin-form-input"
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="start_time" className="admin-form-label">시작 시간</label>
              <input
                type="time"
                id="start_time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                className="admin-form-input"
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="end_time" className="admin-form-label">종료 시간</label>
              <input
                type="time"
                id="end_time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                className="admin-form-input"
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="prep_notes" className="admin-form-label">준비물 · 복장 · 안내</label>
            <textarea
              id="prep_notes"
              name="prep_notes"
              value={formData.prep_notes}
              onChange={handleChange}
              rows={3}
              placeholder="예: 검정 치마저고리 지참, 머리끈, 도시락. 주차는 건물 뒤편."
              className="admin-form-textarea"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">준비물 목록</label>
            <p className="admin-form-help">
              카탈로그에서 준비물을 골라 붙이면, 참가자가 사진·발음과 함께 &lsquo;무엇을 챙길지&rsquo; 확인합니다.
              위 자유 안내와 함께 표시됩니다.
            </p>
            <SupplyPicker items={activeSupplies} value={supplies} onChange={setSupplies} />
            <div className="supply-picker-setblock">
              <span className="admin-form-label">세트</span>
              <SetPicker sets={activeSupplySets} value={supplySets} onChange={setSupplySets} />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="description_ko" className="admin-form-label">
              설명 (한글)
            </label>
            <textarea
              id="description_ko"
              name="description_ko"
              value={formData.description_ko}
              onChange={handleChange}
              rows={4}
              className="admin-form-textarea"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="description_en" className="admin-form-label">
              설명 (영문)
            </label>
            <textarea
              id="description_en"
              name="description_en"
              value={formData.description_en}
              onChange={handleChange}
              rows={4}
              className="admin-form-textarea"
            />
          </div>

          <div className="admin-form-row">
            <div className="admin-form-checkbox">
              <input
                type="checkbox"
                id="is_published"
                name="is_published"
                checked={formData.is_published}
                onChange={handleChange}
              />
              <label htmlFor="is_published">공개 Gallery에 표시</label>
            </div>

            <div className="admin-form-checkbox">
              <input
                type="checkbox"
                id="is_featured"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleChange}
              />
              <label htmlFor="is_featured">추천</label>
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-checkbox">
              <input
                type="checkbox"
                id="is_signature"
                name="is_signature"
                checked={formData.is_signature}
                onChange={handleChange}
              />
              <label htmlFor="is_signature">공연(/performances) 쇼케이스에 표시</label>
            </div>

            <div className="admin-form-group">
              <label htmlFor="signature_order" className="admin-form-label">
                쇼케이스 순서 (작을수록 먼저)
              </label>
              <input
                type="number"
                id="signature_order"
                name="signature_order"
                value={formData.signature_order}
                onChange={handleChange}
                className="admin-form-input"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* 회원에게 알림 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">회원에게 알림</h3>
          <p className="admin-form-help">
            저장할 때 원생·학부모·선생님에게 푸시 알림을 보낼 수 있습니다. 알림을 탭하면 이
            이벤트로 이동해 각자 캘린더에 추가할 수 있습니다.
          </p>

          <div className="admin-form-checkbox">
            <input
              type="checkbox"
              id="notify"
              checked={notify && formData.is_published}
              onChange={(e) => setNotify(e.target.checked)}
              disabled={!formData.is_published}
            />
            <label htmlFor="notify">저장 시 회원에게 알림 보내기</label>
          </div>

          {!formData.is_published && (
            <p className="admin-form-help" style={{ marginTop: 8, borderBottom: 'none', paddingBottom: 0 }}>
              ‘공개 Gallery에 표시’가 켜진 공개 이벤트일 때만 알림을 보낼 수 있습니다.
            </p>
          )}

          {notify && formData.is_published && (
            <div className="admin-form-group" style={{ marginTop: 14 }}>
              <span className="admin-form-label">보낼 대상</span>
              <div className="notify-target-tabs">
                {(
                  [
                    ['all', '전체'],
                    ['role', '역할별'],
                  ] as ['all' | 'role', string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`notify-tab${notifyTarget === val ? ' is-active' : ''}`}
                    onClick={() => setNotifyTarget(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {notifyTarget === 'role' && (
                <div className="notify-roles" style={{ marginTop: 10 }}>
                  {(['student', 'parent', 'teacher', 'admin'] as MemberRole[]).map((r) => (
                    <label key={r} className="notify-role-check">
                      <input
                        type="checkbox"
                        checked={notifyRoles.includes(r)}
                        onChange={() => toggleNotifyRole(r)}
                      />
                      <span>{MEMBER_ROLE_LABELS[r]}</span>
                    </label>
                  ))}
                </div>
              )}

              <p className="admin-form-help" style={{ marginTop: 12, borderBottom: 'none', paddingBottom: 0 }}>
                미리보기:{' '}
                <strong>
                  {isNew ? '[새 일정] ' : '[일정 변경] '}
                  {formData.title_ko || '(제목)'}
                </strong>
                {' — '}
                {[formData.event_date, formData.start_time].filter(Boolean).join(' ') || '(날짜)'}
                {formData.location ? ` · ${formData.location}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Media Section - Only show for existing events */}
        {!isNew && event && (
          <>
            <div className="admin-form-section">
              <h3 className="admin-form-section-title">이 이벤트의 사진</h3>
              <p className="admin-form-help">
                업로드한 사진은 이 이벤트 상세 페이지의 사진 영역에 표시됩니다.
              </p>
              <ImageUploader
                eventId={event.id}
                onUploadComplete={(newImages) => {
                  setImages((prev) => [...prev, ...newImages]);
                }}
              />
              {images.length > 0 && (
                <ImageSortable
                  eventId={event.id}
                  images={images}
                  onReorder={setImages}
                  onDelete={(imageId) => {
                    setImages((prev) => prev.filter((img) => img.id !== imageId));
                  }}
                />
              )}
            </div>

            <div className="admin-form-section">
              <h3 className="admin-form-section-title">이 이벤트의 영상</h3>
              <p className="admin-form-help">
                YouTube 영상 링크를 추가하면 이 이벤트 상세 페이지의 영상 영역에 표시됩니다.
              </p>
              <VideoManager
                eventId={event.id}
                videos={videos}
                onAdd={(video) => setVideos((prev) => [...prev, video])}
                onDelete={(videoId) => {
                  setVideos((prev) => prev.filter((v) => v.id !== videoId));
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="admin-form-actions">
        {/* 저장 결과를 버튼 옆에 바로 보여준다(편집 시 화면 변화가 없어도 명확히) */}
        {savedMsg && (
          <span className="admin-form-saved" role="status">✓ {savedMsg}</span>
        )}
        {error && (
          <span className="admin-form-saved admin-form-saved--error" role="alert">{error}</span>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.back()}
          disabled={saving}
        >
          취소
        </button>
        <button
          type="submit"
          className={`admin-btn ${saved ? 'admin-btn-gold' : 'admin-btn-primary'}`}
          disabled={saving}
        >
          {saving ? '저장 중...' : saved ? '저장됨 ✓' : isNew ? '생성' : '저장'}
        </button>
      </div>
    </form>
  );
}
