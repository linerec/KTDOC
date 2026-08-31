/**
 * 업로드 정책 — "이 주소로 마무리될 업로드는 어디에, 어떻게" (순수 함수)
 *
 * 파일이 Vercel을 지나지 않게 되면서 업로드는 두 걸음이 됐다:
 *
 *   ① 서명 받기   POST /api/uploads/sign   { target, files }
 *   ② R2에 직접 올리고, 원래 라우트(target)에 "올렸습니다"를 알린다
 *
 * ①은 곧 "이 버킷에 써도 좋다"는 허가라, 아무 주소에나 내줄 수 없다. 여기서
 * **등록된 주소인지**를 판정하고 폴더를 만든다. 폴더를 클라이언트가 정하게 두면
 * 남의 폴더에 쓸 수 있으므로, 경로에서 뽑아 서버가 만든다.
 *
 * 누가 할 수 있는가(권한)는 여기 없다 — lib/r2/uploadTargets.ts가 각 라우트의
 * 판정 함수를 그대로 붙인다. 이 파일을 순수하게 두는 이유는 주소 판정의 의도를
 * 시험으로 잠그기 위해서다(uploadPolicy.test.ts).
 */

// 상대 import에 확장자를 붙인다 — 이 모듈은 node --test로 직접 실행된다.
import { MAX_ATTACHMENT_BYTES } from '../mail/attachments.ts';
import { MAX_UPLOAD_FILE_BYTES } from '../uploadLimits.ts';

export interface UploadPolicy {
  /** 등록소 키. 티켓 서명에 함께 묶여, 다른 용도로 돌려쓸 수 없게 한다. */
  key: string;
  /** R2 폴더(원본은 이 앞에 originals/가 붙는다) */
  folder: string;
  /**
   * 원본을 남길 것인가.
   *
   * 사진 보관함(공연 사진·학생 제출)은 **학원의 기록**이라 원본을 남긴다.
   * 반면 뉴스 썸네일·준비물 사진·프로필처럼 화면을 위해 올리는 이미지는
   * 표시용 한 장이면 충분하다 — 남겨봐야 아무도 찾지 않는 5MB가 쌓인다.
   */
  keepOriginal: boolean;
  /**
   * 이미지 정규화(장변 2000·WebP·EXIF 제거)를 돌릴 것인가.
   * 메일 첨부처럼 이미지가 아닌 파일은 손대지 않는다.
   */
  processImage: boolean;
  /** 한 건 최대 크기 */
  maxBytes: number;
  /** 이미지만 받는 자리인가 */
  imagesOnly: boolean;
  /**
   * 받아 줄 Content-Type 접두사. 비우면 제한 없음(기존 규칙의 동작 유지).
   *
   * imagesOnly가 "이미지만/아무거나" 두 갈래뿐이라 생겼다. 메일 첨부는 아무거나
   * 받아도 되지만 자료함은 음원·PDF·이미지만 받아야 한다 — 그 사이가 없었다.
   */
  allowedTypePrefixes?: string[];
}

interface PolicyRule {
  key: string;
  match: RegExp;
  folder: (m: RegExpMatchArray) => string;
  keepOriginal?: boolean;
  processImage?: boolean;
  maxBytes?: number;
  imagesOnly?: boolean;
  allowedTypePrefixes?: string[];
}

const RULES: PolicyRule[] = [
  {
    // 사진 보관함 — 운영진이 올리는 공연/행사 사진. 학원의 기록이므로 원본 보관.
    key: 'gallery-photos',
    match: /^\/api\/admin\/gallery\/photos$/,
    folder: () => 'gallery/photos',
    keepOriginal: true,
  },
  {
    // 공연 상세의 사진들 — 역시 기록이다
    key: 'event-images',
    match: /^\/api\/admin\/gallery\/events\/(\d+)\/images$/,
    folder: (m) => `gallery/${m[1]}`,
    keepOriginal: true,
  },
  {
    key: 'program-images',
    match: /^\/api\/admin\/programs\/(\d+)\/images$/,
    folder: (m) => `programs/${m[1]}`,
  },
  {
    // 학생·학부모가 제출하는 사진 — 보관함으로 들어가므로 원본 보관
    key: 'library-photos',
    match: /^\/api\/library\/photos$/,
    folder: () => 'gallery/submissions',
    keepOriginal: true,
  },
  {
    key: 'news',
    match: /^\/api\/admin\/news\/upload$/,
    folder: () => 'news',
  },
  {
    key: 'supplies',
    match: /^\/api\/admin\/supplies\/upload$/,
    folder: () => 'supplies',
  },
  {
    key: 'profile',
    match: /^\/api\/admin\/profile\/photo$/,
    folder: () => 'profiles',
  },
  {
    // 편집 모드의 범용 이미지 교체(ImageObject)
    key: 'general',
    match: /^\/api\/upload$/,
    folder: () => 'images',
  },
  {
    /**
     * 신청 상세에서 보내는 메일의 첨부.
     *
     * 이미지가 아니어도 되고(PDF·한글 문서·zip), 손대지 않는다. 보낸 뒤에는
     * 서버가 이 임시 파일을 지운다 — 첨부가 공개 주소에 남지 않아야 한다.
     */
    key: 'mail-attachment',
    match: /^\/api\/admin\/forms\/(\d+)\/responses\/(\d+)\/messages$/,
    folder: () => 'mail-attachments',
    processImage: false,
    imagesOnly: false,
    maxBytes: MAX_ATTACHMENT_BYTES,
  },
  {
    /**
     * 공연 자료함의 파일 — 음원이 주인이다.
     *
     * processImage를 끄는 이유는 자명하지만(mp3를 WebP로 바꿀 수 없다) 이미지도
     * 손대지 않는다: 자료함의 이미지는 화면에 걸 썸네일이 아니라 **현장에서 보는
     * 큐시트·동선도**라, 장변 2000으로 줄이면 글씨가 뭉갠다.
     *
     * keepOriginal이 false인 것은 원본을 버린다는 뜻이 아니다 — processImage가
     * 꺼져 있으면 올라온 객체 자체가 결과이고, 사본을 하나 더 만들지 않는다.
     */
    key: 'resource-items',
    match: /^\/api\/admin\/resources\/(\d+)\/items$/,
    folder: (m) => `resources/${m[1]}`,
    processImage: false,
    imagesOnly: false,
    maxBytes: 100 * 1024 * 1024,
    allowedTypePrefixes: ['audio/', 'image/', 'application/pdf'],
  },
];

function toPolicy(rule: PolicyRule, folder: string): UploadPolicy {
  return {
    key: rule.key,
    folder,
    keepOriginal: rule.keepOriginal ?? false,
    processImage: rule.processImage ?? true,
    maxBytes: rule.maxBytes ?? MAX_UPLOAD_FILE_BYTES,
    imagesOnly: rule.imagesOnly ?? true,
    allowedTypePrefixes: rule.allowedTypePrefixes,
  };
}

/**
 * 마무리될 라우트 주소로 정책을 찾는다. 등록되지 않은 주소면 null —
 * 서명 라우트는 그 자리에서 거절한다("모르는 곳에는 서명하지 않는다").
 */
export function findUploadPolicy(target: string): UploadPolicy | null {
  let path = typeof target === 'string' ? target.trim() : '';
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  // 쿼리·해시는 대상 판정에 쓰지 않는다
  path = path.split(/[?#]/)[0];
  // 끝의 슬래시는 같은 라우트로 본다(/api/upload/ === /api/upload)
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  for (const rule of RULES) {
    const m = path.match(rule.match);
    if (m) return toPolicy(rule, rule.folder(m));
  }
  return null;
}

/** 라우트가 자기 자신을 찾을 때 — 경로 변수를 이미 알고 있는 자리용. */
export function uploadPolicyByKey(key: string, folder: string): UploadPolicy | null {
  const rule = RULES.find((r) => r.key === key);
  return rule ? toPolicy(rule, folder) : null;
}
