'use client';

/**
 * 신청서 모달 — 버튼은 여러 곳, 모달은 하나
 *
 * 신청하기 버튼이 히어로와 사이드바로 떨어져 있어 한 컴포넌트로 묶을 수 없다.
 * 그래서 페이지를 Provider로 감싸고 버튼들은 <ApplyButton/>으로 같은 모달을
 * 연다. 폼 상태가 하나뿐이라 어느 버튼으로 열든 쓰던 내용이 이어진다.
 *
 *   <ApplyModalProvider programId={…} …>
 *     … <ApplyButton className="btn-ink-primary">신청하기</ApplyButton> …
 *   </ApplyModalProvider>
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Modal from '@/components/common/Modal';
import RegistrationForm from '@/components/classes/RegistrationForm';
import { useT } from '@/lib/i18n/useT';
import type { ProgramType } from '@/types/programs';

const ApplyModalContext = createContext<{ open: () => void } | null>(null);

interface ApplyModalProviderProps {
  programId: number;
  programType: ProgramType;
  programTitleKo: string;
  children: ReactNode;
}

export function ApplyModalProvider({
  programId,
  programType,
  programTitleKo,
  children,
}: ApplyModalProviderProps) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);

  const closeModal = useCallback(() => {
    setOpen(false);
    // #apply 흔적을 지운다 — 남겨 두면 새로고침·뒤로가기 때 또 열린다.
    if (window.location.hash === '#apply') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // 폼이 페이지 아래 있던 시절 공유된 …#apply 링크가 갈 곳을 잃지 않도록,
  // 해시를 달고 들어오면 신청서를 바로 연다.
  useEffect(() => {
    const openIfApplyHash = () => {
      if (window.location.hash === '#apply') setOpen(true);
    };
    openIfApplyHash();
    window.addEventListener('hashchange', openIfApplyHash);
    return () => window.removeEventListener('hashchange', openIfApplyHash);
  }, []);

  return (
    <ApplyModalContext.Provider value={{ open: openModal }}>
      {children}
      <Modal
        open={open}
        onClose={closeModal}
        label={t('register.title', '신청서')}
        className="apply-modal"
      >
        {/* 폼이 자기 제목("신청서")을 갖고 있어 모달에는 제목을 따로 두지 않는다. */}
        <RegistrationForm
          programId={programId}
          programType={programType}
          programTitleKo={programTitleKo}
        />
      </Modal>
    </ApplyModalContext.Provider>
  );
}

interface ApplyButtonProps {
  className?: string;
  children: ReactNode;
}

/** 신청서를 여는 버튼. Provider 밖에서는 아무것도 그리지 않는다. */
export function ApplyButton({ className, children }: ApplyButtonProps) {
  const ctx = useContext(ApplyModalContext);
  if (!ctx) return null;
  return (
    <button type="button" className={className} onClick={ctx.open}>
      {children}
    </button>
  );
}
