/**
 * 공유·QR 공용 로직
 *
 * 화면(ShareQrCard)에서 그리기만 떼어 낸 순수 로직이다. 브라우저 API는 전부
 * 인자로 주입받으므로 node --test로 분기를 전부 확인할 수 있다(qrShare.test.ts).
 *
 * 왜 분기가 이렇게 많은가 — 공유와 클립보드는 브라우저마다 되는 것이 다르다.
 *  - navigator.share: 모바일에는 있고 데스크톱 브라우저 상당수에는 없다
 *  - ClipboardItem(이미지 복사): 사파리·파이어폭스에서 없거나 거부된다
 *  - 사파리는 사용자 제스처가 끝난 뒤 시작된 write()를 거부한다
 * 그래서 "되는 길을 위에서부터 시도하고, 무엇이 일어났는지 사용자에게 알린다"가
 * 이 모듈의 전부다. 어느 길로 갔는지는 ShareOutcome이 말해 준다.
 */

/** 무슨 일이 일어났는지 — 화면은 이걸 보고 안내 문구를 고른다. */
export type ShareOutcome =
  | 'shared' // OS 공유 시트로 넘겼다
  | 'link-copied' // 공유 시트가 없어 주소를 복사했다
  | 'qr-copied' // QR 그림을 클립보드에 넣었다
  | 'qr-downloaded' // 클립보드가 막혀 파일로 내려받았다
  | 'cancelled' // 사용자가 공유 시트를 닫았다 (실패가 아니다)
  | 'failed';

/* ── 공유할 주소 ───────────────────────────────────────────────────────── */

/**
 * 공유·QR에 넣을 절대 주소를 만든다.
 *
 * QR은 사람이 아니라 스캐너가 읽으므로 한글 경로는 반드시 퍼센트 인코딩돼야
 * 한다. WHATWG URL이 그 일을 해 주므로 여기서 직접 인코딩하지 않는다.
 * 주소가 망가져 있어도 던지지 않는다 — QR 자리가 비는 것보다 첫 화면이 낫다.
 */
export function toShareUrl(input: string | null | undefined, origin: string): string {
  const home = () => {
    try {
      return new URL('/', origin).href;
    } catch {
      return origin;
    }
  };
  if (!input) return home();
  try {
    return new URL(input, origin).href;
  } catch {
    return home();
  }
}

/* ── 내려받을 파일 이름 ────────────────────────────────────────────────── */

/** 파일 이름에 쓸 수 없는 글자(윈도·맥 공통). */
const FORBIDDEN_IN_FILENAME = /[\\/:*?"<>|]/g;
/** 확장자를 뺀 본문 최대 길이 — 너무 길면 OS가 잘라 버린다. */
const MAX_STEM = 50;

/**
 * 제목에서 내려받기 파일 이름을 만든다. 한글은 그대로 둔다(요즘 OS는 받는다).
 * 남는 글자가 없으면 'qr.png'.
 */
export function qrDownloadFileName(title: string | null | undefined): string {
  const stem = (title ?? '')
    .replace(FORBIDDEN_IN_FILENAME, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_STEM)
    .replace(/-+$/, '');
  return stem ? `${stem}-qr.png` : 'qr.png';
}

/* ── 공유 버튼 ─────────────────────────────────────────────────────────── */

export interface ShareLinkDeps {
  /** navigator.share — 없으면 주소 복사로 내려간다. */
  share?: (data: { title?: string; url: string }) => Promise<void>;
  /** navigator.clipboard.writeText */
  writeText?: (text: string) => Promise<void>;
}

/** 공유 시트를 닫은 것인가? 이건 실패로 다루면 안 된다. */
function isCancellation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * 주소를 공유한다. 공유 시트 → 주소 복사 순으로 되는 길을 찾는다.
 * 사용자가 시트를 닫으면 'cancelled'을 돌려주고 복사로 넘어가지 않는다
 * (닫았는데 몰래 클립보드가 바뀌면 그것대로 이상하다).
 */
export async function shareLink(
  url: string,
  title: string | undefined,
  deps: ShareLinkDeps
): Promise<ShareOutcome> {
  if (deps.share) {
    try {
      await deps.share(title ? { title, url } : { url });
      return 'shared';
    } catch (err) {
      if (isCancellation(err)) return 'cancelled';
      // 취소가 아닌 실패(권한·미지원)는 아래 복사로 넘어간다.
    }
  }
  if (deps.writeText) {
    try {
      await deps.writeText(url);
      return 'link-copied';
    } catch {
      // 아래에서 실패로 알린다.
    }
  }
  return 'failed';
}

/* ── QR 복사 버튼 ──────────────────────────────────────────────────────── */

export interface CopyQrDeps {
  /** new ClipboardItem({'image/png': blobPromise}) */
  createItem?: (blob: Promise<Blob>) => ClipboardItem;
  /** navigator.clipboard.write */
  write?: (items: ClipboardItem[]) => Promise<void>;
  /** 클립보드가 막혔을 때의 마지막 수단 */
  download?: (blob: Blob, filename: string) => void;
}

/**
 * QR 그림을 클립보드에 넣는다. 막혀 있으면 파일로 내려받는다.
 *
 * getBlob은 한 번만 부른다 — 두 번 그리면 느릴 뿐 아니라, 클립보드에 넣은 것과
 * 내려받은 것이 다른 그림일 수 있다.
 */
export async function copyQrImage(
  getBlob: () => Promise<Blob | null>,
  filename: string,
  deps: CopyQrDeps
): Promise<ShareOutcome> {
  const pending = getBlob().then((blob) => {
    if (!blob) throw new Error('QR 그림을 만들지 못했다');
    return blob;
  });
  // 아래에서 반드시 다시 확인하므로, 여기서는 처리되지 않은 거부만 막아 둔다.
  pending.catch(() => {});

  if (deps.createItem && deps.write) {
    try {
      // 사파리는 제스처가 끝난 뒤 시작된 write를 거부한다. blob을 기다렸다가
      // 넘기지 말고 약속(Promise)째로 넘겨야 제스처 안에서 시작된 것이 된다.
      await deps.write([deps.createItem(pending)]);
      await pending; // 그림이 실제로 만들어졌는지 확인(가짜 성공 방지)
      return 'qr-copied';
    } catch {
      // 클립보드가 거부했다 — 내려받기로 넘어간다.
    }
  }

  const blob = await pending.catch(() => null);
  if (!blob) return 'failed';
  if (deps.download) {
    deps.download(blob, filename);
    return 'qr-downloaded';
  }
  return 'failed';
}

/* ── 브라우저에서 쓸 기본 배선 ─────────────────────────────────────────── */

/** 지금 이 브라우저가 할 수 있는 것만 담아 공유 deps를 만든다. */
export function browserShareDeps(): ShareLinkDeps {
  if (typeof navigator === 'undefined') return {};
  const deps: ShareLinkDeps = {};
  if (typeof navigator.share === 'function') {
    deps.share = (data) => navigator.share(data);
  }
  if (navigator.clipboard?.writeText) {
    deps.writeText = (text) => navigator.clipboard.writeText(text);
  }
  return deps;
}

/** 지금 이 브라우저가 할 수 있는 것만 담아 QR 복사 deps를 만든다. */
export function browserCopyQrDeps(): CopyQrDeps {
  const deps: CopyQrDeps = { download: downloadBlob };
  if (typeof window === 'undefined') return deps;
  if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
    deps.createItem = (blob) => new ClipboardItem({ 'image/png': blob });
    deps.write = (items) => navigator.clipboard.write(items);
  }
  return deps;
}

/** blob을 파일로 내려받게 한다. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 즉시 해제하면 사파리에서 내려받기가 취소되는 일이 있어 한 박자 뒤에 푼다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
