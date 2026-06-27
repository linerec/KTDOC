'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuilder } from '@/contexts/BuilderContext';
import { useHeaderSettings } from '@/contexts/HeaderSettingsContext';
import IntlObject from '@/components/common/IntlObject';
import HeaderBackgroundEditor from '@/components/HeaderBackgroundEditor';
import { isAdmin, canEnterAdmin } from '@/lib/isAdmin';
import { headerLogoAsset } from '@/lib/headerBackground';

const menuItems = [
    { keycode: 'header.home', href: '/', hasDropdown: true },
    { keycode: 'header.about', href: '/about', hasDropdown: true },
    { keycode: 'header.classes', href: '/classes', hasDropdown: true },
    { keycode: 'header.performances', href: '/performances', hasDropdown: true },
    { keycode: 'header.gallery', href: '/gallery', hasDropdown: false },
    { keycode: 'header.students', href: '/students', hasDropdown: false },
];

export default function Header() {
    const { data: session, status } = useSession();
    const { locale, changeLanguage, availableLangs } = useLanguage();
    const { isEditMode, toggleEditMode } = useBuilder();
    const { logo } = useHeaderSettings();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    // 모든 페이지에서 최상단일 때 로고를 크게 노출하고, 스크롤하면 축소
    const isLogoExpanded = !isScrolled;
    // 로고 변형도 배경과 동일하게 최상단/스크롤 후 상태별로 적용
    const logoAsset = headerLogoAsset(isScrolled ? logo.scrolled : logo.top);
    const headerClassName = [isScrolled && 'scrolled', isLogoExpanded && 'logo-expanded']
        .filter(Boolean)
        .join(' ');

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
                            Admin
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
            <header id="main-header" className={headerClassName}>
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
                    <div className={`header-auth ${session ? 'is-signed-in' : 'is-signed-out'}`}>
                        {renderLanguageSwitcher()}
                        {renderAuthActions()}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className={`mobile-menu-btn ${isMenuOpen ? 'active' : ''}`}
                        aria-label="Toggle Menu"
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
