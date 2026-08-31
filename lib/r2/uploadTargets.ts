/**
 * 업로드 권한 — "이 업로드를 할 수 있는 사람인가"
 *
 * 서명 라우트(/api/uploads/sign)는 **스스로 권한 규칙을 만들지 않는다.**
 * 업로드가 마무리될 라우트를 찾아, 그 라우트가 첫 줄에서 쓰는 것과 **같은
 * 판정**을 다시 돌린다. 판정이 두 벌이 되면 언젠가 어긋나고, 어긋난 쪽은 늘
 * 열려 있는 쪽이다.
 *
 * "어디에·어떻게"(폴더·정규화·원본 보관)는 lib/r2/uploadPolicy.ts가 갖는다 —
 * 그쪽은 순수해서 시험으로 잠글 수 있고, 이 파일은 세션을 만지므로 그럴 수 없다.
 */

import type { Session } from 'next-auth';
import { isAdmin, isApproved, isStaff } from '@/lib/isAdmin';
import { hasMenuAccess } from '@/lib/admin/permissions';
import {
  findUploadPolicy,
  uploadPolicyByKey,
  type UploadPolicy,
} from './uploadPolicy';

export type UploadTarget = UploadPolicy & {
  /** 마무리 라우트와 같은 판정 */
  authorize: (session: Session | null) => boolean | Promise<boolean>;
};

/**
 * 정책 키 → 그 라우트의 권한 판정.
 *
 * 라우트의 권한을 고칠 때 여기도 함께 고칠 것. 등록되지 않은 키는 **닫는다**
 * (모르면 열지 않는다 — 빠뜨린 줄이 조용히 통과하면 안 된다).
 */
const AUTHORIZE: Record<string, UploadTarget['authorize']> = {
  'gallery-photos': (s) => isAdmin(s),
  'event-images': (s) => isStaff(s),
  'program-images': (s) => isStaff(s),
  'library-photos': (s) => isApproved(s),
  news: (s) => hasMenuAccess(s, 'news'),
  supplies: (s) => isStaff(s),
  // 본인 프로필 사진 — 승인된 회원이면 누구나(자기 것만 바꾼다)
  profile: (s) => isApproved(s),
  general: (s) => isAdmin(s),
  'mail-attachment': (s) => hasMenuAccess(s, 'forms'),
  // 자료함 파일 — 라우트(app/api/admin/resources/[id]/items)의 첫 줄과 같은 판정
  'resource-items': (s) => isAdmin(s),
};

function withAuthorize(policy: UploadPolicy | null): UploadTarget | null {
  if (!policy) return null;
  const authorize = AUTHORIZE[policy.key];
  if (!authorize) {
    console.error(`[upload] 권한 규칙이 없는 정책: ${policy.key} — 업로드를 막습니다.`);
    return null;
  }
  return { ...policy, authorize };
}

/** 마무리될 라우트 주소로 업로드 대상을 찾는다. */
export function findUploadTarget(target: string): UploadTarget | null {
  return withAuthorize(findUploadPolicy(target));
}

/** 라우트가 자기 자신을 찾을 때 — 경로 변수를 이미 알고 있는 자리용. */
export function uploadTargetByKey(key: string, folder: string): UploadTarget | null {
  return withAuthorize(uploadPolicyByKey(key, folder));
}
