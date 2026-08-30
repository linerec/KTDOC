'use client';

/**
 * ConsoleNotice — 콘솔 홈에 한 번 띄우는 짧은 알림
 *
 * "무엇이 달라졌으니 한 번 봐 주세요" 같은 말은 메일로 보내기엔 사소하고,
 * 아무 데도 쓰지 않으면 아무도 모른다. 그래서 들어오면 보이는 자리에 두되,
 * **읽고 닫으면 다시 뜨지 않게** 한다 — 닫히지 않는 공지는 며칠 뒤부터
 * 화면의 일부가 되어 아무도 읽지 않는다.
 *
 * 닫은 사실은 그 브라우저에만 남는다(localStorage). 서버에 표를 만들지 않는
 * 이유는 이 알림의 수명이 짧기 때문이다 — 다들 확인하고 나면 코드에서 지운다.
 * 새 공지를 띄울 때는 `id`를 바꾼다(예전 것을 닫았어도 새 것은 다시 뜬다).
 *
 * 읽기를 useEffect가 아니라 useSyncExternalStore로 하는 이유는 둘이다:
 * 서버에는 localStorage가 없으므로 **서버 스냅샷을 '이미 닫힘'으로 두어**
 * 이미 닫은 사람의 화면에서 공지가 번쩍였다 사라지지 않게 하고, 탭을 여러 개
 * 띄워 둔 선생님이 한쪽에서 닫으면 다른 쪽도 같이 닫히게 하기 위해서다.
 */

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';

/** 같은 탭 안의 다른 공지들에게 "닫혔다"를 알리는 구독자 목록 */
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // 다른 탭에서 닫으면 storage 이벤트로 이 탭도 따라 닫힌다
  window.addEventListener('storage', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

function readDismissed(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === 'done';
  } catch {
    // 저장 공간이 막힌 브라우저(사생활 보호 모드 등)에서는 그냥 보여 준다
    return false;
  }
}

interface ConsoleNoticeProps {
  /** 이 공지의 이름. 바뀌면 다시 뜬다. */
  id: string;
  title: string;
  body: string;
  /** 확인하러 갈 곳(선택) */
  href?: string;
  linkLabel?: string;
  dismissLabel?: string;
}

export default function ConsoleNotice({
  id,
  title,
  body,
  href,
  linkLabel = '보러 가기',
  dismissLabel = '확인했습니다',
}: ConsoleNoticeProps) {
  const storageKey = `ktdoc.notice.${id}`;

  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(storageKey),
    // 서버 스냅샷 — 하이드레이션 전에는 그리지 않는다
    () => true
  );
  /** 저장에 실패하는 브라우저에서도 이번 화면에서는 닫히게 하는 최후 수단 */
  const [hiddenNow, setHiddenNow] = useState(false);

  if (dismissed || hiddenNow) return null;

  const dismiss = () => {
    setHiddenNow(true);
    try {
      window.localStorage.setItem(storageKey, 'done');
    } catch {
      /* 기억하지 못해도 이번에는 닫힌다 */
    }
    for (const notify of listeners) notify();
  };

  return (
    <section className="admin-callout console-notice" role="status">
      <div className="console-notice-body">
        <p className="console-notice-title">{title}</p>
        <p className="console-notice-text">{body}</p>
      </div>
      <div className="console-notice-actions">
        {href && (
          <Link href={href} className="admin-btn admin-btn-gold" onClick={dismiss}>
            {linkLabel}
          </Link>
        )}
        <button type="button" className="admin-btn admin-btn-outline" onClick={dismiss}>
          {dismissLabel}
        </button>
      </div>
    </section>
  );
}
