/**
 * 공연 모집(회람) 페이지 — /rsvp/[id]
 *
 * 카톡 단체방의 수기 명단(공지 복사 → 이름 덧붙여 회신)을 대체한다.
 * 공지 내용(일시·모이는 시간·장소·안내)과 참여 명단을 보여주고,
 * 로그인한 정회원은 본인(원생) 또는 자녀(학부모)의 참여를 버튼으로
 * 추가/취소한다(기존 체크인 시스템 재사용). 링크는 공연 관리 목록에서 공유.
 *
 * - 비공개 공연도 접근 가능 — 링크를 아는 사람 대상의 회람이며,
 *   참여 명단·응답은 정회원 로그인 뒤에만 보인다(개인정보 보호).
 * - 비로그인 방문자는 공지 내용만 보고 로그인으로 유도한다
 *   (로그인 후 callbackUrl로 이 페이지에 복귀).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RsvpView, { type RsvpParticipant, type RsvpTarget } from '@/components/rsvp/RsvpView';
import { getEventById, getEventCheckins } from '@/lib/d1';
import { getGuardianChildren, getUserNamesByIds } from '@/lib/members';
import { isApproved } from '@/lib/isAdmin';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function loadEvent(idRaw: string) {
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getEventById(id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await loadEvent(id);
  if (!event) return { title: '모집 공고' };

  const when = [event.event_date?.split('T')[0], event.start_time].filter(Boolean).join(' ');
  const description =
    [when, event.location].filter(Boolean).join(' · ') || '참여 여부를 알려주세요.';
  const poster = event.images[0]?.image_url;

  return {
    title: `[모집] ${event.title_ko}`,
    description,
    // 회원 대상 회람 — 검색 노출은 막되 카톡 등 링크 미리보기는 동작한다
    robots: { index: false, follow: false },
    openGraph: {
      title: `[모집] ${event.title_ko}`,
      description,
      ...(poster ? { images: [poster] } : {}),
    },
  };
}

export default async function RsvpPage({ params }: PageProps) {
  const { id } = await params;
  const event = await loadEvent(id);
  if (!event) notFound();

  const session = await auth();
  const viewer: 'guest' | 'pending' | 'active' = !session?.user
    ? 'guest'
    : isApproved(session)
      ? 'active'
      : 'pending';

  // 참여 명단·내 응답 대상은 정회원에게만 (개인정보 보호)
  let participants: RsvpParticipant[] = [];
  let targets: RsvpTarget[] = [];
  if (viewer === 'active' && session?.user) {
    const checkins = await getEventCheckins(event.id);
    const names = await getUserNamesByIds(checkins.map((c) => c.user_id));

    // 내 응답 대상: 원생·운영진은 본인, 학부모는 연결 확정된 자녀들
    const role = session.user.role;
    if (role === 'parent') {
      const children = await getGuardianChildren(session.user.id);
      targets = children.map((c) => ({
        userId: c.studentId,
        name: c.studentName || '(이름 미상)',
      }));
    } else {
      targets = [{ userId: session.user.id, name: session.user.name || '(이름 미상)' }];
    }

    const mine = new Set(targets.map((t) => t.userId));
    const joined = new Set(checkins.map((c) => c.user_id));
    participants = checkins.map((c) => ({
      userId: c.user_id,
      name: names.get(c.user_id) || '이름 미상',
      isMine: mine.has(c.user_id),
    }));
    targets = targets.map((t) => ({ ...t, joined: joined.has(t.userId) }));
  }

  return (
    <>
      <Header />
      <main className="rsvp-page">
        <RsvpView
          event={{
            id: event.id,
            title_ko: event.title_ko,
            title_en: event.title_en,
            event_date: event.event_date?.split('T')[0] ?? '',
            start_time: event.start_time,
            end_time: event.end_time,
            call_time: event.call_time,
            location: event.location,
            location_address: event.location_address,
            location_url: event.location_url,
            description_ko: event.description_ko,
            description_en: event.description_en,
            prep_notes: event.prep_notes,
            posterUrl: event.images[0]?.image_url ?? null,
          }}
          viewer={viewer}
          participants={participants}
          targets={targets}
        />
      </main>
      <Footer />
    </>
  );
}
