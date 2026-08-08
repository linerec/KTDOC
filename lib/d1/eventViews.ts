/**
 * lib/d1/eventViews.ts — 이벤트 목록을 '관점'으로 부른다
 *
 * 왜 이 파일이 있나: getEvents()의 원시 필터를 페이지마다 직접 조립하다 보니
 * 같은 판단이 여러 곳에 복사됐고, 조건이 빠져도 아무도 몰랐다. 실제로 상세
 * 페이지의 이전/다음에 kind 조건이 없어서, 공연을 보다가 학내 행사로 넘어가는데
 * 그 행사는 정작 /performances 목록에는 없는 상태가 한동안 있었다.
 *
 * 그래서 필터가 아니라 **이름 붙은 관점**을 공유한다. 각 관점은 "누가 무엇을 보는
 * 자리인가"를 이름으로 말하고, 조건의 근거를 주석으로 남긴다. 새 페이지를 만드는
 * 사람은 조건을 조립하지 말고 여기서 고르면 된다. 여기 없는 관점이 필요하면
 * 그건 새 관점이므로 이 파일에 추가하고 근거를 적는다.
 *
 * 이 파일은 **필터만** 만든다(순수 함수). 질의는 getEvents()가 한다 —
 * 그래야 D1 없이도 의도를 시험으로 잠글 수 있다(eventViews.test.ts).
 */

import type { EventFilters } from '@/types/gallery';

/** 목록 화면에서 흔히 넘기는 사용자 입력(연도·카테고리·검색·페이지) */
export interface BrowseParams {
  year?: number;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * 공개 공연 목록 (/performances)
 *
 * - 학내 행사는 레퍼토리가 아니므로 제외한다.
 * - **예정 공연도 포함한다.** 이 페이지는 지난 기록이 아니라 "이런 공연을 합니다"를
 *   보여주는 자리다(2026-08-08 확인). 지난 것만 보여주는 자리는 홈의 '최근의 기록'.
 * - showcase=true면 큐레이션된 대표 공연(is_signature)만. 없으면 호출부가 폴백한다.
 */
export function publicPerformances(opts: { showcase?: boolean; limit?: number } = {}): EventFilters {
  return {
    published: true,
    kind: 'performance',
    ...(opts.showcase ? { showcase: true } : {}),
    limit: opts.limit ?? 50,
  };
}

/**
 * 공개 아카이브 (/gallery)
 *
 * 종류는 방문자가 필터로 고른다. 알 수 없는 값이 오면 거르지 않고 전체를 보여준다 —
 * 잘못된 쿼리스트링 때문에 빈 화면이 나오는 것보다 낫다.
 */
export function publicArchive(params: BrowseParams & { kind?: string }): EventFilters {
  const kind = params.kind === 'performance' || params.kind === 'school' ? params.kind : undefined;
  return {
    published: true,
    ...(kind ? { kind } : {}),
    year: params.year,
    category: params.category,
    search: params.search,
    page: params.page ?? 1,
    limit: params.limit ?? 100,
  };
}

/**
 * 종류를 섞어 시간순으로 보는 자리 (/timeline, 캘린더 구독 피드, 운영 캘린더)
 *
 * **종류를 섞는 것이 의도다.** 연혁과 일정은 공연이든 학내 행사든 다 함께 보여야
 * 하나의 흐름으로 읽힌다. 여기에 kind 조건을 넣으면 안 된다.
 */
export function allKindsChronological(opts: { limit?: number } = {}): EventFilters {
  return {
    published: true,
    limit: opts.limit ?? 500,
  };
}

/**
 * 회원 화면 (/admin/library 둘러보기, /admin/schedule 캘린더)
 *
 * - **종류를 섞는 것이 의도다**(2026-08-08 확인). 원생·학부모는 자기가 참여한 공연과
 *   학내 행사를 함께 본다.
 * - 비공개 이벤트는 회원(원생·학부모)에게만 보인다. 이 판단이 페이지마다 복사돼
 *   있었는데(`memberView ? 'all' : true`), 한쪽만 고치면 어긋나므로 여기로 모았다.
 */
export function memberLibrary(
  params: BrowseParams & { canSeeUnpublished: boolean }
): EventFilters {
  return {
    published: params.canSeeUnpublished ? 'all' : true,
    year: params.year,
    category: params.category,
    search: params.search,
    page: params.page,
    limit: params.limit ?? 100,
  };
}

/**
 * 운영 화면 (/admin/gallery, /admin/faq, 관리 API)
 *
 * 게시·미게시를 모두 본다 — 운영자는 아직 안 연 것도 관리해야 한다.
 * 종류도 섞는다(관리 대상 전부).
 */
export function adminAllEvents(params: BrowseParams = {}): EventFilters {
  return {
    published: 'all',
    year: params.year,
    category: params.category,
    search: params.search,
    page: params.page ?? 1,
    limit: params.limit ?? 50,
  };
}
