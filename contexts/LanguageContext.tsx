'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

import koMessages from '@/locale/ko.json';
import enMessages from '@/locale/en.json';

type Locale = 'ko' | 'en';
type Messages = Record<string, string>;
type AllMessages = Record<Locale, Messages>;
const AVAILABLE_LANGS: Locale[] = ['ko', 'en'];

interface LanguageContextType {
  locale: Locale;
  messages: Messages;
  allMessages: AllMessages;
  availableLangs: Locale[];
  isLoading: boolean;
  changeLanguage: (newLocale: Locale) => void;
  isKorean: boolean;
  isEnglish: boolean;
  refreshMessages: () => Promise<void>;
}

const defaultMessages: AllMessages = {
  ko: koMessages,
  en: enMessages,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [locale, setLocale] = useState<Locale>('ko');
  const [allMessages, setAllMessages] = useState<AllMessages>(defaultMessages);
  const [isLoading, setIsLoading] = useState(true);
  const availableLangs = AVAILABLE_LANGS;

  const fetchLocaleData = useCallback(async () => {
    try {
      const response = await fetch('/api/locale');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          setAllMessages({
            ko: { ...defaultMessages.ko, ...data.messages.ko },
            en: { ...defaultMessages.en, ...data.messages.en },
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch locale from API:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Get saved locale from localStorage
    const savedLocale = typeof window !== 'undefined'
      ? (localStorage.getItem('lang') as Locale) || 'ko'
      : 'ko';
    setLocale(savedLocale);

    // Fetch locale data from API
    fetchLocaleData();
  }, [fetchLocaleData]);

  const changeLanguage = useCallback((newLocale: Locale) => {
    if (newLocale === locale) return;
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', newLocale);
    }
  }, [locale]);

  const refreshMessages = useCallback(async () => {
    setIsLoading(true);
    await fetchLocaleData();
  }, [fetchLocaleData]);

  const messages = useMemo(() => allMessages[locale], [allMessages, locale]);

  const value = useMemo(() => ({
    locale,
    messages,
    allMessages,
    availableLangs,
    isLoading,
    changeLanguage,
    isKorean: locale === 'ko',
    isEnglish: locale === 'en',
    refreshMessages,
  }), [locale, messages, allMessages, availableLangs, isLoading, changeLanguage, refreshMessages]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
