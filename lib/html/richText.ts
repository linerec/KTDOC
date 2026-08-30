/**
 * richText — 위지윅으로 쓴 글을 화면에 올려도 되는 HTML로 깎는다
 *
 * IntlObject는 번역 문자열을 `dangerouslySetInnerHTML`로 그린다. 그래서 편집기가
 * 뱉은 것이 그대로 페이지 마크업이 된다 — **여기가 유일한 문지기다.**
 *
 * 막으려는 것이 스크립트가 아니라는 점이 중요하다. 편집은 관리자만 하고, 관리자는
 * 어차피 원하는 것을 넣을 수 있다. 실제로 일어나는 사고는 이쪽이다:
 *
 *   워드·한글·구글 문서에서 복사해 붙이면 `<span style="font-family:Malgun Gothic;
 *   font-size:11pt; color:#333">` 같은 것이 문단마다 따라 들어온다. 그러면 그 문단만
 *   본문 서체·색을 잃고, 라이트/다크 전환에서 글자가 배경에 묻는다. 붙여넣은 사람은
 *   화면이 그대로라고 생각한다 — 자기 테마에서는 멀쩡해 보이니까.
 *
 * 그래서 규칙은 "위험한 것을 지운다"가 아니라 **"아는 것만 남긴다"**이다.
 * 태그도 속성도 허용 목록이고, 목록에 없으면 껍데기만 벗기고 글은 살린다
 * (통째로 버리면 붙여넣은 사람은 글이 사라진 이유를 알 수 없다).
 *
 * DOM 없이 돈다 — 저장 경로가 Cloudflare Workers 위이고, 붙여넣기 경로는
 * 브라우저다. 두 곳에서 **같은 답**이 나와야 미리보기와 저장본이 어긋나지 않는다.
 */

/** 남길 블록 태그. 여기 없는 블록은 <p>로 눕히거나 껍데기를 벗긴다. */
const BLOCK_TAGS = new Set(['p', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote']);

/** 다른 블록을 품을 수 있는 블록 — 새 블록이 열려도 닫으면 안 된다. */
const BLOCK_CONTAINERS = new Set(['ul', 'ol', 'li', 'blockquote']);

/** 글자가 직접 들어갈 수 있는 블록. 이것 없이 글자가 나오면 <p>를 열어 준다. */
const TEXT_CONTAINERS = new Set(['p', 'h3', 'h4', 'li', 'blockquote']);

/** 남길 인라인 태그. */
const INLINE_TAGS = new Set(['strong', 'em', 'u', 's', 'a', 'span', 'br', 'wbr']);

/** 닫는 태그가 없는 것들. */
const VOID_TAGS = new Set(['br', 'wbr']);

/**
 * 뜻이 같은 다른 이름은 하나로 모은다. 편집기·워드·구글 문서가 저마다 다른 태그를
 * 쓰는데 화면에서는 같은 것이어야 한다(`<b>`와 `<strong>`이 섞이면 CSS가 둘 다
 * 따라다녀야 한다).
 *
 * 제목을 h3·h4 둘로 접는 이유: 이 글은 페이지 한 조각이지 문서가 아니다. 페이지에
 * 이미 h1(로고)과 h2(섹션 제목)가 있어서, 글 안에서 h1·h2를 쓰면 문서 개요가
 * 뒤집힌다. 워드에서 '제목 1'로 붙여 넣어도 여기서 h3으로 내려앉는다.
 */
const TAG_ALIASES: Record<string, string> = {
  b: 'strong',
  i: 'em',
  strike: 's',
  del: 's',
  div: 'p',
  h1: 'h3',
  h2: 'h3',
  h5: 'h4',
  h6: 'h4',
};

/**
 * 안에 든 것까지 통째로 버릴 태그. 나머지 모르는 태그는 껍데기만 벗기고 글은
 * 남기지만, 이것들의 '글'은 글이 아니라 코드·스타일 시트다 — 화면에 쏟아지면
 * 붙여넣기 사고가 된다(워드는 `<style>` 블록을 통째로 딸려 보낸다).
 */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'head',
  'title',
  'meta',
  'link',
  'noscript',
  'iframe',
  'object',
  'embed',
  'template',
]);

/**
 * span에 남길 수 있는 유일한 class. 편집기의 '금색 강조'가 이걸 붙인다.
 * 임의 class를 허용하면 페이지의 다른 컴포넌트 스타일을 글 안에서 불러다 쓸 수
 * 있게 되어, 나중에 그 CSS를 고치는 사람이 소개글이 깨지는 것을 예상하지 못한다.
 */
const ALLOWED_SPAN_CLASSES = new Set(['highlight']);

/** 링크로 허용하는 스킴. javascript: 는 물론이고 data: 도 뺀다. */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

/** 이미 엔티티인 &는 건드리지 않는다 — 두 번 이스케이프하면 `&amp;amp;`가 보인다. */
const BARE_AMP = /&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]{1,31};)/g;

function escapeText(text: string): string {
  return text.replace(BARE_AMP, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value.replace(BARE_AMP, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** 속성 문자열을 이름→값으로. 값이 없는 속성(`disabled`)은 빈 문자열이 된다. */
function parseAttrs(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.set(m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

/**
 * 살아남은 태그가 가져갈 속성을 만든다. 빈 문자열이면 속성 없음.
 * null은 "이 태그는 껍데기를 벗긴다"는 뜻이다 — 글자는 남는다.
 */
function keepAttrs(tag: string, attrs: Map<string, string>): string | null {
  if (tag === 'a') {
    const href = (attrs.get('href') ?? '').trim();
    // 주소가 없거나 수상한 링크는 껍데기만 벗긴다.
    if (!href || !SAFE_URL.test(href)) return null;
    // 바깥으로 나가는 링크만 새 탭이다. 사이트 안 링크까지 새 탭으로 열면
    // 뒤로 가기가 죽는다.
    return /^https?:\/\//i.test(href)
      ? ` href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer"`
      : ` href="${escapeAttr(href)}"`;
  }

  if (tag === 'span') {
    const cls = (attrs.get('class') ?? '').split(/\s+/).filter((c) => ALLOWED_SPAN_CLASSES.has(c));
    // class 없는 span은 워드가 서체를 실어 보내는 껍데기다. 벗긴다.
    if (cls.length === 0) return null;
    return ` class="${cls.join(' ')}"`;
  }

  return '';
}

interface OpenTag {
  /** 실제로 출력한 태그 이름. 껍데기를 벗겼으면 null */
  name: string | null;
  /** 닫는 짝을 찾기 위한 원래 이름 — 껍데기도 `</a>`로 닫혀야 한다 */
  src: string;
}

/**
 * 블록이 비었는지 — 공백과 <br>뿐인 문단은 버린다.
 *
 * contentEditable은 빈 줄을 `<p><br></p>`로 남기고, 워드 붙여넣기는 이것을 문단마다
 * 흘린다. 남겨 두면 문단 사이가 두 배로 벌어지는데, 쓴 사람은 "왜 여기만 떨어지지"를
 * 화면에서 알아낼 방법이 없다(마크업이 안 보이니까).
 */
function isEmptyBlock(inner: string): boolean {
  return inner.replace(/<br\s*\/?>|<wbr\s*\/?>|&nbsp;|\s/g, '') === '';
}

/**
 * 글자 사이 공백을 HTML이 실제로 그리는 모양으로 미리 접는다.
 *
 * ` `(줄바꿈 없는 공백)를 보통 공백으로 바꾸는 것이 핵심이다 — 워드에서 온 글은
 * 이것으로 가득한데, 눈에는 공백과 똑같아 보이면서 줄바꿈만 막는다. 그대로 두면
 * 좁은 화면에서 문단이 통째로 가로로 삐져나가고, 원인이 보이지 않는다.
 *
 * **글자(U+00A0)와 엔티티(`&nbsp;`) 둘 다** 접어야 한다. 클립보드는 보통 글자로
 * 주지만 워드의 text/html은 엔티티로 준다 — 한쪽만 접으면 출처에 따라 결과가
 * 갈리고, 갈렸다는 사실은 좁은 화면에서만 드러난다.
 */
function collapseSpace(text: string): string {
  return text
    .replace(/ |&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/[ \t\r\n\f]+/g, ' ');
}

/**
 * 위지윅으로 쓴 글을 화면에 올릴 수 있는 HTML로 깎는다.
 * 허용 목록에 없는 것은 전부 사라지고, 글자는 남는다.
 */
export function sanitizeRichText(input: string): string {
  if (!input) return '';

  const out: string[] = [];
  const stack: OpenTag[] = [];
  /** 열려 있는 블록의 출력 시작 위치 — 닫을 때 "비었는가"를 보고 되돌리기 위해 */
  const blockStart: number[] = [];

  const topName = (): string | null | undefined =>
    stack.length > 0 ? stack[stack.length - 1].name : undefined;

  const openTag = (name: string, attrSuffix: string, src = name) => {
    if (BLOCK_TAGS.has(name)) blockStart.push(out.length);
    out.push(`<${name}${attrSuffix}>`);
    stack.push({ name, src });
  };

  const closeTop = () => {
    const top = stack.pop();
    if (!top || top.name === null) return;
    if (BLOCK_TAGS.has(top.name)) {
      const start = blockStart.pop() ?? out.length;
      // li 는 비어도 남긴다 — 지우려던 줄이 아니라 아직 안 쓴 줄일 수 있다.
      if (top.name !== 'li' && isEmptyBlock(out.slice(start + 1).join(''))) {
        out.length = start;
        return;
      }
    }
    out.push(`</${top.name}>`);
  };

  /** 새 블록이 열릴 자리를 만든다 — 품을 수 있는 블록을 만날 때까지 닫는다. */
  const closeToContainer = () => {
    for (;;) {
      const top = topName();
      if (top === undefined) return;
      if (top !== null && BLOCK_CONTAINERS.has(top)) return;
      closeTop();
    }
  };

  /** 글자가 직접 들어갈 블록이 열려 있게 만든다. `<ul>` 바로 아래면 `<li>`를 연다. */
  const ensureTextContainer = () => {
    for (let n = stack.length - 1; n >= 0; n--) {
      const name = stack[n].name;
      // 껍데기와 인라인 태그는 투명하다 — `<strong>` 안에 `<p>`를 열면 안 된다
      if (name === null || INLINE_TAGS.has(name)) continue;
      if (TEXT_CONTAINERS.has(name)) return;
      break; // ul / ol — 글자를 직접 담을 수 없다
    }
    openTag(topName() === 'ul' || topName() === 'ol' ? 'li' : 'p', '');
  };

  const src = String(input);
  let i = 0;

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const chunk = lt === -1 ? src.slice(i) : src.slice(i, lt);

    if (chunk) {
      const text = collapseSpace(chunk);
      // 블록 사이의 들여쓰기·줄바꿈만으로 문단을 열지는 않는다.
      if (text.trim()) {
        ensureTextContainer();
        out.push(escapeText(text));
      } else if (stack.some((s) => s.name !== null && TEXT_CONTAINERS.has(s.name))) {
        out.push(escapeText(text));
      }
    }

    if (lt === -1) break;
    i = lt;

    // 주석·DOCTYPE·CDATA — 통째로 건너뛴다
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith('<!', i) || src.startsWith('<?', i)) {
      const end = src.indexOf('>', i);
      i = end === -1 ? src.length : end + 1;
      continue;
    }

    const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9:_-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(src.slice(i));

    // `<` 가 태그가 아니라 글자였다(예: "5 < 10"). 글자로 되돌린다.
    if (!tag) {
      ensureTextContainer();
      out.push('&lt;');
      i += 1;
      continue;
    }

    const [full, slash, rawName, rawAttrs] = tag;
    i += full.length;

    // 워드의 `<o:p>` 처럼 네임스페이스가 붙은 것은 이름만 떼어 본다
    const bare = rawName.toLowerCase().replace(/^[a-z0-9]+:/, '');
    const name = TAG_ALIASES[bare] ?? bare;

    if (DROP_WITH_CONTENT.has(bare)) {
      if (!slash) {
        const close = new RegExp(`</${bare}\\s*>`, 'i').exec(src.slice(i));
        i = close ? i + close.index + close[0].length : src.length;
      }
      continue;
    }

    const known = BLOCK_TAGS.has(name) || INLINE_TAGS.has(name);

    if (slash) {
      if (VOID_TAGS.has(name)) continue;
      // 짝이 맞는 데까지 닫는다. 껍데기(name === null)도 원래 이름으로 찾아 닫는다.
      const back = [...stack].reverse().findIndex((s) => s.src === name);
      if (back === -1) continue; // 떠도는 닫는 태그
      for (let n = 0; n <= back; n++) closeTop();
      continue;
    }

    if (!known) continue; // 모르는 태그 — 껍데기만 벗기고 안의 글은 계속 읽는다

    if (VOID_TAGS.has(name)) {
      ensureTextContainer();
      out.push(`<${name} />`);
      continue;
    }

    if (name === 'li') {
      // 앞의 <li>가 안 닫혔으면 닫고, 목록 밖이면 목록을 하나 열어 준다
      // (붙여넣기에서 흔하다. 조용히 버리면 줄이 사라진다).
      for (;;) {
        const top = topName();
        if (top === undefined || top === 'ul' || top === 'ol') break;
        closeTop();
      }
      if (topName() !== 'ul' && topName() !== 'ol') openTag('ul', '');
    } else if (BLOCK_TAGS.has(name)) {
      closeToContainer();
    } else {
      ensureTextContainer();
    }

    const attrSuffix = keepAttrs(name, parseAttrs(rawAttrs));
    if (attrSuffix === null) {
      // 쓸 수 있는 속성이 없어 껍데기가 된 태그(주소 없는 <a>, class 없는 <span>).
      // 닫는 짝을 맞추기 위해 스택에는 올리되 출력은 하지 않는다.
      stack.push({ name: null, src: name });
      continue;
    }

    openTag(name, attrSuffix);
  }

  while (stack.length > 0) closeTop();

  return out.join('').trim();
}

/**
 * 순수한 글만 남긴다 — 요약·길이 재기·검색용.
 * 블록 경계는 공백으로 남긴다(문단이 붙어 한 단어가 되지 않게).
 */
export function richTextToPlain(html: string): string {
  return String(html ?? '')
    .replace(/<(br|wbr)\s*\/?>/gi, ' ')
    .replace(/<\/(p|h3|h4|li|ul|ol|blockquote)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 줄글(옛 번역값)을 리치 텍스트로 올린다.
 *
 * 옛 키들은 한 칸에 여러 줄을 우겨 넣은 상태로 쌓여 있다 — 칸이 모자라면 사람은
 * 엔터를 친다. 그런데 HTML은 줄바꿈을 공백으로 접으므로 화면에서는 여러 줄이
 * 한 줄로 이어져 보였다. 옮길 때 그 줄들을 다시 갈라 놓는 것이 이 함수의 일이다.
 */
export function splitCrammedLines(text: string): string[] {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/[\/·]+$/, '').trim())
    .filter(Boolean);
}

/** 줄글을 문단들로 — 빈 줄이 문단 경계다. */
export function plainToRichText(text: string): string {
  const blocks = splitCrammedLines(text);
  return blocks.map((b) => `<p>${escapeText(collapseSpace(b))}</p>`).join('');
}
