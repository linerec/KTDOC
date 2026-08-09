'use client';

/**
 * useEventForm — 공연 편집 폼의 상태와 저장 절차
 *
 * 저장 버튼 하나가 실제로는 세 가지 일을 한다. 순서와 실패 처리가 중요해 한곳에 모았다:
 *  1) 공연 저장 (실패하면 여기서 끝 — 아래는 시도하지 않는다)
 *  2) AI 패널에서 고른 포스터를 공연 사진으로 등록 (실패해도 저장은 유지)
 *  3) 회원에게 푸시 알림 (실패해도 저장은 유지 — 메시지에만 실패를 덧붙인다)
 *
 * 2·3이 실패해도 1을 되돌리지 않는 이유: 되돌리면 방금 입력한 내용이 통째로 사라진다.
 * 실패한 쪽은 편집 화면에서 다시 할 수 있으므로 저장을 지키는 편이 낫다.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  EventDetail,
  CreateEventInput,
  UpdateEventInput,
  ExtractedEventInfo,
  EventKind,
} from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import type { PickerRow } from '@/components/admin/supplies/SupplyPicker';
import type { SetPickerRow } from '@/components/admin/supplies/SetPicker';
import { uploadImageFiles } from '@/lib/uploadClient';
import { useT } from '@/lib/i18n/useT';
import type { EventFormData, FormChangeHandler, FormPatchHandler } from './types';

interface UseEventFormArgs {
  event?: EventDetail | null;
  isNew: boolean;
  initialSupplies: PickerRow[];
  initialSupplySets: SetPickerRow[];
}

/** AI가 채워도 되는 텍스트 필드 — 여기 없는 값은 추출 결과가 있어도 건드리지 않는다 */
const AI_TEXT_KEYS = [
  'title_ko',
  'title_en',
  'event_date',
  'start_time',
  'end_time',
  'call_time',
  'description_ko',
  'description_en',
  'location',
  'location_address',
  'prep_notes',
] as const;

function initialFormData(event: EventDetail | null | undefined): EventFormData {
  return {
    title_ko: event?.title_ko || '',
    title_en: event?.title_en || '',
    event_date: event?.event_date?.split('T')[0] || '',
    category_id: event?.category_id || '',
    kind: (event?.kind || 'performance') as EventKind,
    description_ko: event?.description_ko || '',
    description_en: event?.description_en || '',
    is_published: event?.is_published === 1,
    is_featured: event?.is_featured === 1,
    is_signature: event?.is_signature === 1,
    signature_order: event?.signature_order ?? 0,
    location: event?.location || '',
    location_url: event?.location_url || '',
    location_address: event?.location_address || '',
    location_lat: event?.location_lat ?? null,
    location_lng: event?.location_lng ?? null,
    call_time: event?.call_time || '',
    start_time: event?.start_time || '',
    end_time: event?.end_time || '',
    prep_notes: event?.prep_notes || '',
  };
}

export function useEventForm({
  event,
  isNew,
  initialSupplies,
  initialSupplySets,
}: UseEventFormArgs) {
  const router = useRouter();
  const t = useT();

  const [formData, setFormData] = useState<EventFormData>(() => initialFormData(event));
  const [images, setImages] = useState(event?.images || []);
  const [videos, setVideos] = useState(event?.videos || []);
  const [supplies, setSupplies] = useState<PickerRow[]>(initialSupplies);
  const [supplySets, setSupplySets] = useState<SetPickerRow[]>(initialSupplySets);

  const [saving, setSaving] = useState(false);
  const [publishSaving, setPublishSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 저장 완료 피드백(편집 시 화면 변화가 없어 명확한 신호가 필요)
  const [saved, setSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // AI 추출값 적용 안내(검토 유도) + AI 패널의 포스터(체크 시 저장 후 사진으로 등록)
  const [aiNote, setAiNote] = useState('');
  const [poster, setPoster] = useState<{ file: File | null; attach: boolean }>({
    file: null,
    attach: false,
  });

  // 저장 시 회원에게 푸시 알림(신규는 기본 ON, 공개 상태일 때만 발송)
  const [notify, setNotify] = useState(isNew);
  const [notifyTarget, setNotifyTarget] = useState<'all' | 'role'>('role');
  const [notifyRoles, setNotifyRoles] = useState<MemberRole[]>(['student', 'parent']);
  const toggleNotifyRole = (r: MemberRole) =>
    setNotifyRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  /** 다시 편집하기 시작하면 이전 저장 성공 표시를 지운다(오해 방지). */
  const clearSavedMark = () => {
    if (savedMsg) setSavedMsg('');
    if (saved) setSaved(false);
  };

  const handleChange: FormChangeHandler = (e) => {
    const { name, value, type } = e.target;
    clearSavedMark();
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const patchForm: FormPatchHandler = (patch) => {
    clearSavedMark();
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  /**
   * AI 추출 결과를 폼에 채운다 — null 필드는 건드리지 않는다(부분 성공 허용).
   * 값은 초안일 뿐이며, 관리자가 검토·수정한 뒤 저장 버튼으로 확정한다.
   */
  const applyAiExtract = (data: ExtractedEventInfo) => {
    setFormData((prev) => {
      const patch: Record<string, string> = {};
      for (const key of AI_TEXT_KEYS) {
        const value = data[key];
        if (value) patch[key] = value;
      }
      if (data.category_id) patch.category_id = String(data.category_id);
      return { ...prev, ...patch };
    });
    setAiNote(
      t(
        'admin.events.aiApplied',
        'AI가 추출한 값을 폼에 채웠습니다. 내용을 검토하고 필요한 곳을 수정한 뒤 저장하세요.'
      )
    );
  };

  // '저장 및 공개' 버튼의 의도 전달 — submit 버튼으로 두어 네이티브 필수값
  // 검증을 그대로 태우고, 클릭 시 이 ref만 세운다(각 버튼 onClick에서 확정).
  const publishIntentRef = useRef(false);
  const setPublishIntent = (v: boolean) => {
    publishIntentRef.current = v;
  };

  /** 저장된 공연을 알림으로 알린다. 성공/실패를 저장 메시지에 덧붙일 문구로 돌려준다. */
  async function sendNotification(eventId: number): Promise<string> {
    try {
      const when = [formData.event_date, formData.start_time].filter(Boolean).join(' ');
      const loc = formData.location ? ` · ${formData.location}` : '';
      const prefix = isNew
        ? t('admin.events.pushNew', '[새 일정] ')
        : t('admin.events.pushChanged', '[일정 변경] ');
      const title = `${prefix}${formData.title_ko}`.slice(0, 200);
      const pushBody = (
        `${when}${loc}`.trim() || t('admin.events.pushFallback', '자세히 보려면 탭하세요.')
      ).slice(0, 1000);
      const target =
        notifyTarget === 'all'
          ? { type: 'all' as const }
          : { type: 'role' as const, roles: notifyRoles };

      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: pushBody, url: `/gallery/event/${eventId}`, target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        console.warn('알림 발송 실패:', data.error);
        return t('admin.events.notifyFailedNote', ' (알림 발송은 실패했습니다)');
      }
      return t('admin.events.notifySentNote', ' · 회원에게 알림을 보냈습니다');
    } catch (err) {
      console.warn('알림 발송 오류:', err);
      return t('admin.events.notifyFailedNote', ' (알림 발송은 실패했습니다)');
    }
  }

  /** AI 패널에서 고른 포스터를 새 공연의 사진으로 등록(신규 저장 직후에만). */
  async function attachPoster(eventId: number) {
    try {
      await uploadImageFiles(`/api/admin/gallery/events/${eventId}/images`, [poster.file!]);
    } catch (uploadErr) {
      console.warn('포스터 이미지 등록 실패:', uploadErr);
      window.alert(
        t(
          'admin.events.posterAttachFailed',
          '공연은 저장되었지만 포스터 이미지 등록에 실패했습니다. 편집 화면에서 직접 추가해 주세요.'
        )
      );
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const publish = publishIntentRef.current;
    publishIntentRef.current = false;
    // '저장 및 공개'면 체크박스 상태와 무관하게 공개로 저장한다
    const effectivePublished = publish || formData.is_published;

    setError(null);
    setSavedMsg('');
    setSaving(true);
    setPublishSaving(publish);

    try {
      const url = isNew ? '/api/admin/gallery/events' : `/api/admin/gallery/events/${event?.id}`;
      const body: CreateEventInput | UpdateEventInput = {
        title_ko: formData.title_ko,
        title_en: formData.title_en || undefined,
        event_date: formData.event_date,
        category_id: formData.category_id ? Number(formData.category_id) : undefined,
        kind: formData.kind,
        description_ko: formData.description_ko || undefined,
        description_en: formData.description_en || undefined,
        is_published: effectivePublished,
        is_featured: formData.is_featured,
        // 학내 행사는 공연 쇼케이스 대상이 아니다 — 폼에서 숨긴 값이 남아 있어도 강제로 끈다
        is_signature: formData.kind === 'school' ? false : formData.is_signature,
        signature_order: formData.kind === 'school' ? 0 : Number(formData.signature_order) || 0,
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
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, supplies, supply_sets: supplySets }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'));
      }

      const eventId: number | undefined = isNew ? data.data?.id : event?.id;

      if (isNew && eventId && poster.attach && poster.file) {
        await attachPoster(eventId);
      }

      const notifyNote =
        notify && effectivePublished && eventId ? await sendNotification(eventId) : '';

      if (isNew && data.data?.id) {
        // 신규: 새 공연 편집 화면으로 이동(화면 전환 자체가 저장 신호)
        router.push(`/admin/gallery/${data.data.id}`);
      } else {
        // 편집: 화면이 그대로이므로 성공 메시지·버튼 상태로 강하게 표시
        // '저장 및 공개'로 저장했다면 공개 체크박스에도 반영한다
        if (publish) setFormData((prev) => ({ ...prev, is_published: true }));
        setSaved(true);
        setSavedMsg(
          publish
            ? t('admin.events.savedPublic', '공개 상태로 저장되었습니다{note}.', {
                note: notifyNote,
              })
            : t('admin.events.saved', '저장되었습니다{note}.', { note: notifyNote })
        );
        router.refresh();
        window.setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.saveFailed', '저장에 실패했습니다.')
      );
    } finally {
      setSaving(false);
      setPublishSaving(false);
    }
  };

  return {
    formData,
    handleChange,
    patchForm,
    images,
    setImages,
    videos,
    setVideos,
    supplies,
    setSupplies,
    supplySets,
    setSupplySets,
    saving,
    publishSaving,
    error,
    saved,
    savedMsg,
    aiNote,
    applyAiExtract,
    setPoster,
    notify,
    setNotify,
    notifyTarget,
    setNotifyTarget,
    notifyRoles,
    toggleNotifyRole,
    setPublishIntent,
    handleSubmit,
    goBack: () => router.back(),
  };
}
