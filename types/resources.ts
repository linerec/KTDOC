/**
 * 공연 자료함 도메인 타입.
 *
 * `ResourceItem`과 `ResourceItemPublic`을 **일부러 갈라 둔다.** 공개 화면으로
 * 내려가는 모양에는 `r2Key`가 없다 — 타입이 그것을 막는다. 버킷이 공개라
 * 키 하나가 새면 비밀번호가 무의미해진다.
 */

export type ResourceAccessAction =
  | 'unlock'
  | 'unlock_fail'
  | 'link_open'
  | 'play'
  | 'download'
  | 'email_sent'
  | 'passcode_view';

export interface ResourceVault {
  id: number;
  code: string;
  title: string;
  note: string | null;
  /** 암호문 그대로. 화면으로 보내기 전에 반드시 벗겨 내거나 복호할 것 */
  passcodeEnc: string;
  eventId: number | null;
  allowDownload: boolean;
  allowEmail: boolean;
  active: boolean;
  expiresAt: string | null;
  linkEpoch: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 목록 한 줄 — 비밀번호를 담지 않는다 */
export interface ResourceVaultSummary {
  id: number;
  code: string;
  title: string;
  eventId: number | null;
  eventTitle: string | null;
  allowDownload: boolean;
  allowEmail: boolean;
  active: boolean;
  expiresAt: string | null;
  itemCount: number;
  totalBytes: number;
  lastOpenedAt: string | null;
  recentFailCount: number;
  createdAt: string;
}

export interface ResourceItem {
  id: number;
  vaultId: number;
  title: string;
  r2Key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  sortOrder: number;
  createdAt: string;
}

/** 브라우저로 내려가는 모양 — r2Key가 없다 */
export interface ResourceItemPublic {
  id: number;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  sortOrder: number;
}

export interface ResourceAccessEntry {
  id: number;
  vaultId: number | null;
  code: string | null;
  action: ResourceAccessAction;
  itemId: number | null;
  ipHash: string | null;
  userAgent: string | null;
  detail: string | null;
  createdAt: string;
}

/** 새 자료함을 만들 때 받는 값 */
export interface CreateVaultInput {
  title: string;
  note?: string | null;
  /** 이미 암호화된 값 — 평문이 이 경계를 넘지 않는다 */
  passcodeEnc: string;
  eventId?: number | null;
  allowDownload?: boolean;
  allowEmail?: boolean;
  expiresAt?: string | null;
  createdBy?: string | null;
}

/** 자료함 수정 — 준 것만 바뀐다 */
export interface UpdateVaultInput {
  title?: string;
  note?: string | null;
  passcodeEnc?: string;
  eventId?: number | null;
  allowDownload?: boolean;
  allowEmail?: boolean;
  active?: boolean;
  expiresAt?: string | null;
}

/** 업로드가 끝난 파일 한 건을 자료함에 붙일 때 */
export interface NewResourceItem {
  title: string;
  r2Key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
}

/** ResourceItem에서 공개용으로 깎는다 — 이 함수를 지나지 않고 내보내지 말 것 */
export function toPublicItem(item: ResourceItem): ResourceItemPublic {
  return {
    id: item.id,
    title: item.title,
    fileName: item.fileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    durationSeconds: item.durationSeconds,
    sortOrder: item.sortOrder,
  };
}
