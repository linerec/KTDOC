'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuilder } from '@/contexts/BuilderContext';
import IntlObject from '@/components/common/IntlObject';
import { isAdmin } from '@/lib/isAdmin';

const menuItems = [
    { keycode: 'header.home', href: '/', hasDropdown: true },
    { keycode: 'header.about', href: '/about', hasDropdown: true },
    { keycode: 'header.classes', href: '/classes', hasDropdown: true },
    { keycode: 'header.performances', href: '/performances', hasDropdown: true },
    { keycode: 'header.gallery', href: '/gallery', hasDropdown: false },
];

export default function Header() {
    const { data: session, status } = useSession();
    const { locale, changeLanguage, availableLangs } = useLanguage();
    const { isEditMode, toggleEditMode } = useBuilder();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    // 메인 페이지 최상단에서만 로고를 크게 노출하고, 스크롤하거나 다른 페이지로 이동하면 축소
    const isHome = pathname === '/';
    const isLogoExpanded = isHome && !isScrolled;
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
            return (
                <div className="header-auth-actions">
                    {admin && (
                        <>
                            <Link href="/admin" className="auth-btn auth-btn-dashboard" onClick={closeMenu}>
                                Admin
                            </Link>
                            <button
                                type="button"
                                className={`edit-mode-toggle ${isEditMode ? 'active' : ''}`}
                                onClick={handleEditModeToggle}
                                title={isEditMode ? '편집 모드 끄기' : '편집 모드 켜기'}
                            >
                                {isEditMode ? 'Edit ON' : 'Edit'}
                            </button>
                        </>
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
                <div className="header-inner">
                    {/* Logo - Center Top */}
                    <div className="header-logo">
                        <Link href="/">
                            <Image
                                src="/assets/logo/logo_white.png"
                                alt="KTDOC Logo"
                                width={400}
                                height={242}
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
