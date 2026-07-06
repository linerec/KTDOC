'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuilder } from '@/contexts/BuilderContext';
import { useHeaderSettings } from '@/contexts/HeaderSettingsContext';
import IntlObject from '@/components/common/IntlObject';
import HeaderBackgroundEditor from '@/components/HeaderBackgroundEditor';
import HeaderWaves from '@/components/HeaderWaves';
import { isAdmin, canEnterAdmin } from '@/lib/isAdmin';
import { headerLogoAsset } from '@/lib/headerBackground';

const menuItems = [
    { keycode: 'header.home', href: '/', hasDropdown: true },
    { keycode: 'header.about', href: '/about', hasDropdown: true },
    { keycode: 'header.classes', href: '/classes', hasDropdown: true },
    { keycode: 'header.performances', href: '/performances', hasDropdown: true },
    { keycode: 'header.gallery', href: '/gallery', hasDropdown: false },
    { keycode: 'header.media', href: '/media', hasDropdown: false },
    { keycode: 'header.timeline', href: '/timeline', hasDropdown: false },
    { keycode: 'header.students', href: '/students', hasDropdown: false },
    { keycode: 'header.glossary', href: '/glossary', hasDropdown: false },
];

export default function Header() {
    const { data: session, status } = useSession();
    const { locale, changeLanguage, availableLangs } = useLanguage();
    const { isEditMode, toggleEditMode } = useBuilder();
    const { logo, align } = useHeaderSettings();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const headerRef = useRef<HTMLElement>(null);
    const authRef = useRef<HTMLDivElement>(null);

    // 모든 페이지에서 최상단일 때 로고를 크게 노출하고, 스크롤하면 축소
    const isLogoExpanded = !isScrolled;
    // 로고 변형도 배경과 동일하게 최상단/스크롤 후 상태별로 적용
    const logoAsset = headerLogoAsset(isScrolled ? logo.scrolled : logo.top);
    const headerClassName = [
        isScrolled && 'scrolled',
        isLogoExpanded && 'logo-expanded',
        // Top Bar 설정의 로고·메뉴 정렬(기본 center는 클래스 없음)
        align === 'left' && 'align-left',
    ]
        .filter(Boolean)
        .join(' ');
    // 헤더 Top Bar의 한국적 선 인터랙션. ink-ambient와 동일하게 환경변수로 끌 수 있다.
    const headerWaves = process.env.NEXT_PUBLIC_HEADER_WAVES !== 'off';

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // 우측 툴바 실측 폭을 CSS 변수(--header-auth-w)로 헤더에 기록.
    // 스크롤 고정 상태에서 메뉴가 이 폭만큼 좌우 대칭으로 물러나 겹침을 차단한다.
    // 툴바 폭은 로그인 상태·로케일·이름 길이에 따라 달라지므로 실측이 필요하다.
    useEffect(() => {
        const header = headerRef.current;
        const authEl = authRef.current;
        if (!header || !authEl || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(([entry]) => {
            const width = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
            header.style.setProperty('--header-auth-w', `${Math.ceil(width)}px`);
        });
        observer.observe(authEl);
        return () => observer.disconnect();
    }, []);

    // 헤더 실높이를 문서 루트 CSS 변수로 발행 — 페이지 상단 오프셋의 단일 기준.
    // 헤더 높이는 콘텐츠(로고·메뉴·안전영역 패딩)로 결정되는 유동값이라 실측이 필요하다.
    // 실측값에는 env(safe-area-inset-top) 패딩이 포함되므로 iOS 홈 화면 설치(standalone)
    // 상태에서도 콘텐츠가 Top Bar에 가리지 않는다.
    // 최상단(logo-expanded) 높이만 --header-offset으로 발행한다: 페이지 오프셋은 로드 시점
    // (=최상단) 헤더 기준이어야 하고, 스크롤 축소 때 값이 바뀌면 콘텐츠가 출렁이기 때문.
    // 스크롤 후 높이는 --header-h-scrolled로 발행해 sticky·anchor 보정에 쓴다.
    useEffect(() => {
        const header = headerRef.current;
        if (!header || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(([entry]) => {
            const height = Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
            if (height <= 0) return;
            const root = document.documentElement;
            // 상태 전환(0.7s transition) 중간값 오염을 피하려고 클래스로 현재 상태를 판별:
            // 전환이 진행되는 동안에도 마지막 콜백이 최종 높이로 수렴한다.
            if (header.classList.contains('logo-expanded')) {
                root.style.setProperty('--header-offset', `${height}px`);
            } else if (header.classList.contains('scrolled')) {
                root.style.setProperty('--header-h-scrolled', `${height}px`);
            }
        });
        observer.observe(header);
        return () => observer.disconnect();
    }, []);

    // 드로어 열림 동안: 뒤 페이지 스크롤 잠금 + ESC 닫기 + 데스크톱 폭 전환 시 자동 닫기
    useEffect(() => {
        if (!isMenuOpen) return;

        document.body.style.overflow = 'hidden';
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsMenuOpen(false);
        };
        const desktop = window.matchMedia('(min-width: 1101px)');
        const handleDesktop = (e: MediaQueryListEvent) => {
            if (e.matches) setIsMenuOpen(false);
        };
        window.addEventListener('keydown', handleKey);
        desktop.addEventListener('change', handleDesktop);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKey);
            desktop.removeEventListener('change', handleDesktop);
        };
    }, [isMenuOpen]);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    const handleEditModeToggle = () => {
        toggleEditMode();
        closeMenu();
    };

    const handleSignOut = () => {
        closeMenu();
        signOut({ callbackUrl: '/' });
    };

    const renderLanguageSwitcher = (className = 'language-switcher') => (
        <div className={className} aria-label="Language">
            {availableLangs.map((lang) => (
                <button
                    key={lang}
                    type="button"
                    className={`lang-btn ${locale === lang ? 'active' : ''}`}
                    onClick={() => changeLanguage(lang)}
                >
                    {lang}
                </button>
            ))}
        </div>
    );

    const renderAuthActions = () => {
        if (status === 'loading') {
            return <span className="auth-loading">...</span>;
        }

        if (session) {
            const admin = isAdmin(session);
            // 관리 콘솔 진입: 권한(RBAC)이 있는 모든 역할(원생·학부모·선생님·관리자).
            // 편집 모드는 사이트 콘텐츠 수정이라 관리자 전용으로 유지한다.
            const canEnter = canEnterAdmin(session);
            return (
                <div className="header-auth-actions">
                    {canEnter && (
                        <Link href="/admin" className="auth-btn auth-btn-dashboard" onClick={closeMenu}>
                            <IntlObject keycode={admin ? 'auth.dashboard.admin' : 'auth.dashboard.member'} />
                        </Link>
                    )}
                    {admin && (
                        <button
                            type="button"
                            className={`edit-mode-toggle ${isEditMode ? 'active' : ''}`}
                            onClick={handleEditModeToggle}
                            title={isEditMode ? '편집 모드 끄기' : '편집 모드 켜기'}
                        >
                            {isEditMode ? 'Edit ON' : 'Edit'}
                        </button>
                    )}
                    <span className="auth-user">{session.user?.name || session.user?.email}</span>
                    <button type="button" className="auth-btn auth-btn-logout" onClick={handleSignOut}>
                        <IntlObject keycode="auth.logout" />
                    </button>
                </div>
            );
        }

        return (
            <div className="header-auth-actions">
                <Link href="/login" className="auth-btn" onClick={closeMenu}><IntlObject keycode="auth.login" /></Link>
                <Link href="/register" className="auth-btn auth-btn-primary" onClick={closeMenu}><IntlObject keycode="auth.register" /></Link>
            </div>
        );
    };

    return (
        <>
            {/* 드로어 열림 시 페이지 dim — 바깥 탭으로 닫기 */}
            <div
                className={`nav-overlay ${isMenuOpen ? 'active' : ''}`}
                onClick={closeMenu}
                aria-hidden="true"
            />
            <header id="main-header" className={headerClassName} ref={headerRef}>
                {/* 한국적·단아한 선 인터랙션(canvas) — header-inner 뒤에 깔린다 */}
                {headerWaves && <HeaderWaves />}
                {/* Top Bar 섹션 설정 진입 버튼 — 헤더 영역 좌하단. 편집 모드 관리자에게만 노출 */}
                {session && isAdmin(session) && isEditMode && <HeaderBackgroundEditor />}
                <div className="header-inner">
                    {/* Logo - Center Top */}
                    <div className="header-logo">
                        <Link href="/">
                            <Image
                                src={logoAsset.src}
                                alt="KTDOC Logo"
                                width={logoAsset.width}
                                height={logoAsset.height}
                                style={{ width: 'auto' }}
                                priority
                            />
                        </Link>
                    </div>

                    {/* Navigation - Below Logo */}
                    <nav id="main-nav" className={isMenuOpen ? 'active' : ''}>
                        <ul>
                            {menuItems.map((item) => (
                                <li key={item.keycode}>
                                    <Link href={item.href} onClick={closeMenu}>
                                        <IntlObject keycode={item.keycode} />
                                        {item.hasDropdown && <span className="dropdown-arrow">▾</span>}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <div className="mobile-nav-auth">
                            {renderAuthActions()}
                        </div>
                    </nav>

                    {/* Auth Section */}
                    <div className={`header-auth ${session ? 'is-signed-in' : 'is-signed-out'}`} ref={authRef}>
                        {renderLanguageSwitcher()}
                        {renderAuthActions()}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className={`mobile-menu-btn ${isMenuOpen ? 'active' : ''}`}
                        aria-label="Toggle Menu"
                        aria-expanded={isMenuOpen}
                        onClick={toggleMenu}
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </header>
            <div className="mobile-language-float">
                {renderLanguageSwitcher('language-switcher mobile-language-switcher')}
            </div>
        </>
    );
}
