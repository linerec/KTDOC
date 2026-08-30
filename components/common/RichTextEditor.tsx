'use client';

/**
 * RichTextEditor — 긴 글을 보이는 대로 쓰는 칸
 *
 * 이 편집기가 생긴 이유는 서식이 아니라 **칸의 개수**다. 원장님 소개는 문단 3개와
 * 목록 6줄이 코드에 박혀 있었다. 칸이 모자라자 한 칸에 엔터로 여러 줄을 우겨 넣으셨고,
 * HTML은 줄바꿈을 공백으로 접으므로 화면에는 네 개의 공연이 한 줄로 이어져 나왔다.
 * 쓰신 분은 칸에 줄을 나눠 넣었으니 나눠 보일 거라 믿을 수밖에 없다.
 *
 * 그래서 여기서는 **엔터가 곧 새 줄**이고, 줄 수에 한계가 없다.
 *
 * 설계에서 지킨 것:
 *
 *  1. **붙여넣는 순간 정리한다.** 워드·한글·구글 문서에서 온 글에는 서체·크기·색이
 *     문단마다 따라온다. 그걸 그대로 두면 그 문단만 테마를 따르지 않아, 붙여넣은
 *     사람의 화면에서는 멀쩡하고 반대 테마에서만 글자가 배경에 묻는다.
 *     정리를 저장할 때가 아니라 붙일 때 하는 이유는, 그래야 **결과를 눈으로 보고**
 *     이상하면 되돌릴(Cmd+Z) 수 있기 때문이다.
 *  2. **React가 글자를 다시 그리지 않는다.** contentEditable을 value로 되돌려 그리면
 *     한 글자 칠 때마다 커서가 맨 앞으로 튄다. 그래서 DOM이 주인이고, 밖에서 온 값이
 *     정말 다를 때만 다시 그린다.
 *
 * execCommand는 표준에서 사라진(deprecated) API다. 그럼에도 쓰는 이유: 선택 영역을
 * 직접 다루는 편집기를 새로 쓰거나 ProseMirror급 의존성을 들이는 것에 비해, 이 화면이
 * 필요로 하는 서식은 굵게·기울임·목록·소제목뿐이다. 모든 브라우저가 여전히 구현하고
 * 있고, 없어지면 그때 같은 자리를 갈아 끼우면 된다 — 이 파일 하나다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { richTextToPlain, sanitizeRichText } from '@/lib/html/richText';

interface RichTextEditorProps {
  /** HTML 문자열 */
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  /** 스크린리더가 읽을 칸 이름 */
  ariaLabel: string;
  /** 칸 위에 붙는 눈에 보이는 이름 */
  label?: string;
  placeholder?: string;
}

/**
 * 툴바에 놓는 것들. 목록은 컴포넌트 밖에 둔다 — 안에서 만들면 버튼마다 클로저가
 * 매 렌더 새로 생기고, 그 클로저가 편집기 ref를 렌더 중에 읽게 된다.
 * 여기서는 '무엇을 누를 수 있는가'만 적고, '무슨 일이 일어나는가'는 누를 때 정한다.
 */
const TOOLS: { id: string; label: string; title: string }[] = [
  { id: 'bold', label: '굵게', title: '굵게 (⌘B)' },
  { id: 'italic', label: '기울임', title: '기울임 (⌘I)' },
  { id: 'h3', label: '소제목', title: '소제목으로' },
  { id: 'p', label: '본문', title: '보통 문단으로' },
  { id: 'ul', label: '· 목록', title: '글머리 목록' },
  { id: 'ol', label: '1. 목록', title: '번호 목록' },
  { id: 'highlight', label: '강조', title: '금색 강조' },
  { id: 'link', label: '링크', title: '링크 걸기' },
  { id: 'clear', label: '서식 지우기', title: '서식 지우기' },
];

/** 선택 영역이 편집기 안에 있는가 — 툴바가 엉뚱한 곳을 건드리지 않게 */
function selectionInside(root: HTMLElement | null): boolean {
  if (!root) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  return root.contains(node.nodeType === 1 ? node : node.parentNode);
}

/** 커서가 들어 있는 금색 강조 조각. 없으면 null */
function highlightAt(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
  while (node && node !== root) {
    if (node.nodeType === 1 && (node as HTMLElement).classList?.contains('highlight')) {
      return node as HTMLElement;
    }
    node = node.parentNode;
  }
  return null;
}

/**
 * 붙여넣은 자리에 눌어붙은 서식을 그 자리에서 걷어낸다.
 *
 * 정화기를 통과시킨 뒤에도 필요하다 — 크롬의 insertHTML은 **넣는 순간 다시**
 * `style="font-size: 0.85rem"` 같은 것을 붙인다(넣기 전 모양을 지켜 준다는 뜻이다).
 * 그러면 그 문단만 글자 크기가 못이 박혀서, 나중에 본문 크기를 바꿔도 따라오지 않는다.
 *
 * innerHTML을 통째로 갈아 끼우지 않는 이유는 커서다. 속성만 떼면 커서는 제자리에
 * 있고, 남은 빈 `<span>`은 아무 일도 하지 않다가 칸을 떠날 때 정화기가 벗긴다.
 */
function scrubInPlace(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>('[style]')) {
    el.removeAttribute('style');
  }
  for (const el of root.querySelectorAll<HTMLElement>('[class]')) {
    if (!el.classList.contains('highlight')) el.removeAttribute('class');
  }
}

/** 강조 껍데기를 벗기고 글자만 남긴다 */
function unwrap(el: HTMLElement) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  label,
  placeholder,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  /**
   * 우리가 마지막으로 밖에 내보낸 HTML. 밖에서 온 value가 이것과 같으면 "내가 낸
   * 변경이 돌아온 것"이므로 다시 그리지 않는다 — 그리면 커서가 맨 앞으로 튄다.
   */
  const emitted = useRef<string>('');

  /** 링크 입력줄이 열려 있는 동안 잡아 두는 선택 영역 */
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  /**
   * 안내문을 띄울까 — 상태가 아니라 값에서 바로 읽는다. 상태로 들고 있으면 값과
   * 어긋날 때가 생기고(붙여넣기·되돌리기), 안내문이 글 위에 겹친다.
   * 빈 <li>만 있는 목록은 '쓰기 시작한 상태'라 안내문을 내리지 않는다.
   */
  const blank = richTextToPlain(value) === '' && !value.includes('<li');

  // 밖에서 온 값 반영 — 다를 때만.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === emitted.current) return;
    el.innerHTML = value || '<p><br /></p>';
    emitted.current = value;
  }, [value]);

  // 엔터가 <div>가 아니라 <p>를 만들게, 굵게가 <span style>가 아니라 <b>를 쓰게.
  // 브라우저마다 기본값이 달라서 문서 모양이 갈린다.
  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
      document.execCommand('styleWithCSS', false, 'false');
    } catch {
      /* 지원하지 않는 브라우저라면 기본값 그대로 쓴다 */
    }
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 변경이 어디서 왔든(타이핑·붙여넣기·툴바) 눌어붙은 서식은 여기서 걷힌다.
    // 경로마다 챙기면 언젠가 한 곳을 빠뜨린다.
    scrubInPlace(el);
    const html = el.innerHTML;
    emitted.current = html;
    onChange(html);
  }, [onChange]);

  /** 서식 명령 하나 — 실행 전에 편집기로 초점을 되돌린다(툴바를 누르면 초점이 나간다) */
  const exec = useCallback(
    (command: string, arg?: string) => {
      const el = ref.current;
      if (!el || disabled) return;
      el.focus();
      if (!selectionInside(el)) {
        // 초점만 준 직후에는 선택 영역이 없을 수 있다 — 맨 끝에 커서를 둔다
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      document.execCommand(command, false, arg);
      emit();
    },
    [disabled, emit]
  );

  /** 금색 강조 — 켜고 끄기. execCommand에 없는 서식이라 직접 감싸고 벗긴다. */
  const toggleHighlight = useCallback(() => {
    const el = ref.current;
    if (!el || disabled) return;
    el.focus();
    const existing = highlightAt(el);
    if (existing) {
      unwrap(existing);
      emit();
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return; // 고른 글자가 없으면 할 일이 없다
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'highlight';
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      // 감싼 뒤 그 안쪽을 고른 상태로 둔다 — 한 번 더 누르면 풀린다
      const after = document.createRange();
      after.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(after);
    } catch {
      /* 여러 블록에 걸친 선택은 감쌀 수 없다 — 조용히 넘긴다 */
    }
    emit();
  }, [disabled, emit]);

  /** 서식 지우기 — 굵게·링크·강조를 한 번에 벗긴다 */
  const clearFormat = useCallback(() => {
    const el = ref.current;
    if (!el || disabled) return;
    el.focus();
    document.execCommand('removeFormat');
    document.execCommand('unlink');
    const hl = highlightAt(el);
    if (hl) unwrap(hl);
    emit();
  }, [disabled, emit]);

  const openLink = useCallback(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !selectionInside(el)) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    setLinkUrl('https://');
    setLinkOpen(true);
  }, [disabled]);

  const applyLink = useCallback(() => {
    const el = ref.current;
    const range = savedRange.current;
    setLinkOpen(false);
    if (!el || !range) return;
    el.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const url = linkUrl.trim();
    if (url && url !== 'https://') document.execCommand('createLink', false, url);
    savedRange.current = null;
    emit();
  }, [linkUrl, emit]);

  /**
   * 붙여넣기 — 서식은 살리되 서체·색·크기는 버린다.
   * 정리한 결과를 그대로 넣으므로 이상하면 Cmd+Z로 되돌릴 수 있다.
   */
  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      const cleaned = html
        ? sanitizeRichText(html)
        : // 서식 없는 글은 줄 단위로 문단을 만든다 — 엑셀·메모장에서 온 목록이 한 줄로
          // 이어지지 않게. (한 줄짜리는 문단을 만들지 않고 커서 자리에 그대로 넣는다.)
          text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
            .join('');
      document.execCommand('insertHTML', false, cleaned || '');
      emit();
    },
    [disabled, emit]
  );

  /** 밖에서 끌어다 놓은 것도 같은 문을 지나게 한다 */
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  /**
   * 칸을 떠날 때 한 번 정리해서 눈에 보이게 한다.
   * 초점이 이미 나갔으므로 커서가 튈 걱정이 없고, "저장하면 이렇게 된다"를 저장 전에
   * 보여 줄 수 있는 유일한 순간이다.
   */
  const onBlur = useCallback(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const clean = sanitizeRichText(el.innerHTML);
    if (clean !== el.innerHTML) {
      el.innerHTML = clean || '<p><br /></p>';
    }
    emitted.current = clean;
    onChange(clean);
  }, [disabled, onChange]);

  const runTool = useCallback(
    (id: string) => {
      switch (id) {
        case 'bold':
          return exec('bold');
        case 'italic':
          return exec('italic');
        case 'h3':
          return exec('formatBlock', 'h3');
        case 'p':
          return exec('formatBlock', 'p');
        case 'ul':
          return exec('insertUnorderedList');
        case 'ol':
          return exec('insertOrderedList');
        case 'highlight':
          return toggleHighlight();
        case 'link':
          return openLink();
        case 'clear':
          return clearFormat();
      }
    },
    [exec, toggleHighlight, openLink, clearFormat]
  );

  return (
    <div className="rt-editor">
      {label && <span className="rt-label">{label}</span>}

      <div className="rt-toolbar" role="toolbar" aria-label={`${ariaLabel} 서식`}>
        {TOOLS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`rt-tool rt-tool--${c.id}`}
            title={c.title}
            // 눌러도 편집기의 선택 영역이 풀리지 않게 — 이게 없으면 툴바를 누르는
            // 순간 고른 글자가 사라져서 서식이 엉뚱한 데 걸린다
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTool(c.id)}
            disabled={disabled}
          >
            {c.label}
          </button>
        ))}
      </div>

      {linkOpen && (
        <div className="rt-linkbar">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
              if (e.key === 'Escape') setLinkOpen(false);
            }}
            placeholder="https://…"
            aria-label="링크 주소"
            autoFocus
          />
          <button type="button" className="rt-tool" onMouseDown={(e) => e.preventDefault()} onClick={applyLink}>
            걸기
          </button>
          <button type="button" className="rt-tool" onClick={() => setLinkOpen(false)}>
            취소
          </button>
        </div>
      )}

      <div
        ref={ref}
        className={`rt-surface${blank ? ' is-empty' : ''}`}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder={placeholder ?? '여기에 내용을 쓰세요'}
        onInput={emit}
        onPaste={onPaste}
        onDrop={onDrop}
        onBlur={onBlur}
      />
    </div>
  );
}
