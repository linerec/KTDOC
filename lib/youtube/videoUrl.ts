/**
 * lib/youtube/videoUrl.ts — 유튜브 주소 한 벌의 해석
 *
 * **왜 이 파일이 있나.** 선생님들은 유튜브 앱에서 '공유 → 링크 복사'를 누른다.
 * 그렇게 나오는 주소는 하나가 아니다 — 일반 영상이면 `youtu.be/ID?si=…`, 쇼츠면
 * `youtube.com/shorts/ID`, 라이브였던 영상이면 `youtube.com/live/ID`, PC 주소창에서
 * 긁으면 `youtube.com/watch?v=ID&t=617s`. 카톡에서 옮기면 제목이 앞에 붙어 오기도 한다.
 * 예전 파서는 이 중 **세 가지만** 알았고, 쇼츠를 붙여넣은 선생님은
 * "유효하지 않은 YouTube URL입니다"만 봤다. 무엇이 잘못됐는지 알 길이 없는 문장이다.
 *
 * 그래서 이 파일의 원칙은 하나다: **사람이 어떻게 가져왔든 받아들인다.**
 * 거절은 정말 유튜브 영상 주소가 아닐 때뿐이고, 그때도 '무엇을 붙여넣었는지'를
 * 말할 수 있게 이유를 함께 돌려준다(재생목록·채널은 영상이 아니다).
 *
 * 순수 함수다(네트워크 없음). 화면·서버·시험이 같은 함수를 쓴다.
 * 영상이 실제로 있는지, 퍼가기가 허용됐는지는 lib/youtube.ts가 유튜브에 물어본다.
 */

/** 유튜브 영상 ID는 11자 [A-Za-z0-9_-] 이다. 이 모양이 아니면 ID가 아니다. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * ID 모양이지만 ID가 아닌 유튜브 예약어.
 * `/embed/videoseries?list=…`는 재생목록 퍼가기 주소인데 'videoseries'가 공교롭게 11자다.
 */
const RESERVED_SEGMENTS = new Set(['videoseries']);

/** 유튜브가 쓰는 호스트들 — 모바일(m)·음악(music)·프라이버시(-nocookie)·국가별(www.youtube.co.kr) 포함 */
function isYouTubeHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');
  return (
    h === 'youtu.be' ||
    h === 'youtube.com' ||
    h === 'youtube-nocookie.com' ||
    h.endsWith('.youtube.com') ||
    h.endsWith('.youtube-nocookie.com')
  );
}

export interface YouTubeRef {
  videoId: string;
  /**
   * 붙여넣은 주소가 쇼츠(세로) 모양이었나.
   *
   * 유튜브 API는 "이 영상이 쇼츠인가"를 알려 주지 않는다 — 썸네일은 쇼츠도 16:9로
   * 내려오고, 길이로도 가를 수 없다(짧은 가로 영상이 있고, 긴 쇼츠도 있다).
   * 확실한 근거는 두 가지뿐이다: 사람이 쇼츠 주소를 가져왔다는 사실과,
   * `youtube.com/shorts/ID`가 303으로 튕기지 않는다는 사실(lib/youtube.ts의 probeIsShort).
   * 이 값은 앞의 근거다.
   */
  isShort: boolean;
}

export type YouTubeParseFailure = 'empty' | 'notYouTube' | 'playlist' | 'channel' | 'noVideoId';

export type YouTubeParse =
  | { ok: true; ref: YouTubeRef }
  | { ok: false; reason: YouTubeParseFailure };

/** 문자열 어딘가에서 첫 번째 유튜브 주소를 건져 낸다(카톡·메모에서 옮기면 앞뒤에 글자가 붙는다). */
function findUrlLike(text: string): string | null {
  // 퍼가기 코드(<iframe src="…">)를 통째로 붙여넣는 분이 있다. src만 뽑는다.
  const iframe = text.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframe) return iframe[1];

  // http(s)로 시작하는 주소, 또는 스킴 없이 youtube.com/…·youtu.be/… 로 시작하는 주소
  const withScheme = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (withScheme) return withScheme[0];
  const bare = text.match(/(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s"'<>]*/i);
  if (bare) return `https://${bare[0]}`;
  return null;
}

/** 경로에서 ID를 꺼낸다. `/shorts/ID`, `/live/ID`, `/embed/ID`, `/v/ID`, `/e/ID`, `youtu.be/ID` */
function idFromPath(segments: string[], prefix: string | null): string | null {
  const first = prefix ? segments[1] : segments[0];
  if (!first || RESERVED_SEGMENTS.has(first.toLowerCase())) return null;
  // `/embed/ID?start=10` 처럼 뒤에 붙은 것은 URL이 이미 걷어 냈다. 남은 조각만 본다.
  return ID_RE.test(first) ? first : null;
}

/**
 * 붙여넣은 것에서 영상을 읽어 낸다.
 *
 * 받는 모양(모두 실제로 들어온 적이 있거나, 유튜브가 만들어 주는 것이다):
 *   https://www.youtube.com/watch?v=ID          PC 주소창
 *   https://youtu.be/ID?si=…                    앱 '공유 → 링크 복사'
 *   https://www.youtube.com/shorts/ID           쇼츠
 *   https://www.youtube.com/live/ID             라이브였던 영상
 *   https://www.youtube.com/embed/ID            퍼가기 주소
 *   https://m.youtube.com/watch?v=ID            모바일 웹
 *   <iframe src="https://www.youtube.com/embed/ID" …>   퍼가기 코드 통째로
 *   제목 https://youtu.be/ID                     카톡에서 옮겨 온 경우
 *   ID                                          ID만 아는 경우
 */
export function parseYouTube(raw: string): YouTubeParse {
  const text = (raw ?? '').trim();
  if (!text) return { ok: false, reason: 'empty' };

  const urlLike = findUrlLike(text);

  if (!urlLike) {
    // 주소가 전혀 없다. 통째로 ID 하나인가?
    //   'performance'처럼 11글자 영단어를 ID로 오인하지 않으려고, 숫자·기호·대소문자
    //   섞임 중 하나는 있어야 한다고 본다(유튜브 ID는 사실상 늘 그렇다).
    const looksLikeId = ID_RE.test(text) && /[0-9_-]/.test(text);
    const looksLikeWord = ID_RE.test(text) && text === text.toLowerCase();
    if (looksLikeId || (ID_RE.test(text) && !looksLikeWord)) {
      return { ok: true, ref: { videoId: text, isShort: false } };
    }
    return { ok: false, reason: 'notYouTube' };
  }

  let url: URL;
  try {
    url = new URL(urlLike);
  } catch {
    return { ok: false, reason: 'notYouTube' };
  }
  if (!isYouTubeHost(url.hostname)) return { ok: false, reason: 'notYouTube' };

  // 일부 앱이 만드는 우회 주소: /attribution_link?u=%2Fwatch%3Fv%3DID
  const forwarded = url.searchParams.get('u');
  if (forwarded) {
    const inner = parseYouTube(
      forwarded.startsWith('http') ? forwarded : `https://www.youtube.com${forwarded}`
    );
    if (inner.ok) return inner;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const head = segments[0]?.toLowerCase() ?? '';
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  // youtu.be/ID — 경로 첫 조각이 곧 ID
  if (host === 'youtu.be') {
    const id = idFromPath(segments, null);
    return id ? { ok: true, ref: { videoId: id, isShort: false } } : { ok: false, reason: 'noVideoId' };
  }

  if (head === 'shorts') {
    const id = idFromPath(segments, 'shorts');
    return id ? { ok: true, ref: { videoId: id, isShort: true } } : { ok: false, reason: 'noVideoId' };
  }

  if (head === 'live' || head === 'embed' || head === 'v' || head === 'e') {
    const id = idFromPath(segments, head);
    if (id) return { ok: true, ref: { videoId: id, isShort: false } };
    // /embed/videoseries?list=… 는 재생목록이지 영상이 아니다
    if (url.searchParams.get('list')) return { ok: false, reason: 'playlist' };
    return { ok: false, reason: 'noVideoId' };
  }

  // /watch?v=ID (…&t=617s, &list=…, &app=desktop 이 붙어 있어도 v만 본다)
  const v = url.searchParams.get('v');
  if (v && ID_RE.test(v)) return { ok: true, ref: { videoId: v, isShort: false } };

  if (head === 'playlist' || url.searchParams.get('list')) {
    return { ok: false, reason: 'playlist' };
  }
  if (head.startsWith('@') || head === 'channel' || head === 'c' || head === 'user') {
    return { ok: false, reason: 'channel' };
  }
  return { ok: false, reason: 'noVideoId' };
}

/** 편의 — 성공하면 참조, 아니면 null. */
export function parseYouTubeRef(raw: string): YouTubeRef | null {
  const r = parseYouTube(raw);
  return r.ok ? r.ref : null;
}

/**
 * 옛 이름. types/gallery.ts가 내보내던 함수와 같은 계약(문자열 → ID | null)이라
 * 기존 호출부가 그대로 돌아간다. 새 코드는 parseYouTube를 쓸 것.
 */
export function extractYouTubeId(raw: string): string | null {
  return parseYouTubeRef(raw)?.videoId ?? null;
}

/**
 * 저장·표시용 정규 주소.
 *
 * **쇼츠는 쇼츠 주소로 남긴다.** 세로/가로는 화면 비율을 가르는데, 그걸 아는 유일한
 * 근거가 "사람이 쇼츠 주소를 가져왔다"는 사실이기 때문이다. watch 주소로 통일해 버리면
 * 그 사실이 지워지고, 세로 영상이 16:9 상자 안에서 양옆에 검은 띠를 달고 나온다.
 * 중복 판정은 주소가 아니라 **영상 ID**로 해야 한다(같은 영상의 두 주소가 존재한다).
 */
export function canonicalYouTubeUrl(videoId: string, isShort = false): string {
  return isShort
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * 퍼가기 주소.
 *
 * **youtube.com을 쓴다. youtube-nocookie.com은 쓰지 않는다.**
 *
 * nocookie는 추적 쿠키를 심지 않아 먼저 골랐던 도메인인데, **재생을 누르는 순간**
 * 유튜브가 "로그인하여 봇이 아님을 확인하세요"로 막는다. 쿠키가 없어 세션을 알 수
 * 없으니 기계로 보는 것이다. 썸네일까지는 멀쩡히 나오기 때문에 **관리자 눈에는
 * 아무 문제가 없어 보인다** — 방문자만 막힌 화면을 본다(2026-09-20 실측:
 * 같은 페이지·같은 영상·같은 브라우저·같은 순간에 도메인만 바꿔 재현. 자동재생
 * 여부와 무관했다).
 *
 * 프라이버시의 실익은 이미 다른 데서 얻는다: 재생기는 **썸네일을 눌러야** 끼워지므로
 * (VideoEmbed의 facade) 누르기 전에는 유튜브를 전혀 부르지 않는다. 쿠키가 생기는
 * 시점은 방문자가 보겠다고 결정한 뒤다.
 */
export function youtubeEmbedUrl(
  videoId: string,
  opts: { autoplay?: boolean; start?: number } = {}
): string {
  const params = new URLSearchParams();
  if (opts.autoplay) params.set('autoplay', '1');
  if (opts.start) params.set('start', String(opts.start));
  // 재생이 끝난 뒤 남의 채널 영상을 들이밀지 않는다(rel=0은 '같은 채널 우선'이다).
  params.set('rel', '0');
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** 썸네일. hqdefault는 어떤 영상에도 있다(maxres는 없는 영상이 많아 깨진 이미지가 된다). */
export function youtubeThumbnail(videoId: string, quality: 'hq' | 'mq' | 'maxres' = 'hq'): string {
  const file = quality === 'maxres' ? 'maxresdefault' : quality === 'mq' ? 'mqdefault' : 'hqdefault';
  return `https://i.ytimg.com/vi/${videoId}/${file}.jpg`;
}

/** 저장된 주소가 세로(쇼츠)인가 — 표시 비율의 근거. */
export function isShortUrl(url: string | null | undefined): boolean {
  return parseYouTubeRef(url || '')?.isShort ?? false;
}

/** 사람이 볼 수 있는 실패 사유. 화면은 이 키로 안내 문구를 고른다. */
/**
 * 사람이 볼 수 있는 실패 사유 — **화면과 서버가 같은 문장을 쓴다.**
 * 값은 locale/ko.json의 `admin.youtube.parse.*`와 같다(화면은 번역이 있으면 그쪽을 쓴다).
 * 무엇을 붙여넣었는지에 따라 말이 달라야 한다 — "유튜브 링크가 아닙니다" 한 줄로는
 * 재생목록을 넣었는지 채널을 넣었는지 본인도 알 수 없다.
 */
export const YOUTUBE_PARSE_MESSAGES: Record<YouTubeParseFailure, string> = {
  empty: "링크를 붙여넣어 주세요.",
  notYouTube:
    "유튜브 링크가 아닙니다. 아래 ‘링크를 어떻게 가져오나요?’를 눌러 보세요.",
  playlist: "재생목록 링크입니다. 영상 하나를 열어서 그 링크를 가져와 주세요.",
  channel: "채널 링크입니다. 올리고 싶은 영상을 열어서 그 링크를 가져와 주세요.",
  noVideoId:
    "이 링크에서 영상을 찾지 못했습니다. 유튜브에서 영상을 열고 다시 복사해 주세요.",
};

/**
 * 링크 확인 결과 — 화면이 "이 영상 맞습니까?"를 그림으로 보여 주는 데 필요한 전부.
 * 값을 채우는 일은 서버(lib/youtube.ts의 resolveYouTubeVideo)가 한다. 모양만 여기 둔다 —
 * 클라이언트 컴포넌트가 서버 모듈을 끌어오지 않게 하기 위해서다.
 */
export interface ResolvedYouTubeVideo {
  videoId: string;
  canonicalUrl: string;
  title: string;
  channelTitle: string | null;
  publishedAt: string | null;
  thumbnail: string;
  /** 세로 영상(쇼츠)인가 — 표시 비율을 가른다 */
  isShort: boolean;
  /** 우리 사이트에 퍼갈 수 있는가. 확인 못 했으면 null. */
  embeddable: boolean | null;
}
