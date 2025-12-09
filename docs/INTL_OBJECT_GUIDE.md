# IntlObject 다국어 지원 시스템 가이드

이 가이드는 IntlObject 컴포넌트와 연동 시스템을 다른 Next.js/React 프로젝트에서 사용하는 방법을 설명합니다.

## 목차

1. [개요](#개요)
2. [시스템 구조](#시스템-구조)
3. [데이터베이스 스키마](#데이터베이스-스키마)
4. [프론트엔드 설정](#프론트엔드-설정)
5. [백엔드 API 설정](#백엔드-api-설정)
6. [IntlObject 컴포넌트](#intlobject-컴포넌트)
7. [사용 예시](#사용-예시)

---

## 개요

IntlObject는 다음과 같은 특징을 가진 다국어 지원 시스템입니다:

- **실시간 편집**: 로그인한 관리자가 Edit Mode에서 직접 텍스트를 클릭하여 수정 가능
- **다중 언어 지원**: 한국어(ko), 영어(en) 등 다양한 언어 지원
- **하이브리드 방식**: 로컬 JSON 파일 + 데이터베이스 기반 동적 번역 병합
- **멤버별 커스터마이징**: 전역 번역과 멤버별 커스텀 번역 지원
- **react-intl 기반**: FormatJS의 react-intl 라이브러리 활용

---

## 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        프론트엔드                                │
├─────────────────────────────────────────────────────────────────┤
│  src/                                                           │
│  ├── locale/                                                    │
│  │   ├── ko.json          # 기본 한국어 번역 (정적)              │
│  │   └── en.json          # 기본 영어 번역 (정적)                │
│  ├── contexts/                                                  │
│  │   └── LanguageContext.js    # 언어 상태 관리                  │
│  ├── components/Common/                                         │
│  │   └── IntlObject.js    # 편집 가능한 다국어 컴포넌트          │
│  └── services/CommonServices/                                   │
│      └── index.js         # API 호출 함수                        │
├─────────────────────────────────────────────────────────────────┤
│                        백엔드 API                                │
├─────────────────────────────────────────────────────────────────┤
│  GET  /getLocale          # 전체 번역 데이터 조회                │
│  GET  /fetch-locale       # 특정 키코드 번역 조회                │
│  POST /save-locale        # 번역 저장/업데이트                   │
│  DELETE /delete-locale    # 번역 삭제                           │
├─────────────────────────────────────────────────────────────────┤
│                        데이터베이스                              │
├─────────────────────────────────────────────────────────────────┤
│  locale 테이블            # 다국어 번역 저장                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 데이터베이스 스키마

### 데이터베이스 종류에 독립적인 스키마 정의

아래는 다양한 데이터베이스에서 사용할 수 있는 범용 스키마입니다.

#### 논리적 스키마

**테이블명**: `locale` (또는 프로젝트에 맞게 `{project}_locale`)

| 컬럼명 | 데이터 타입 | 제약조건 | 설명 |
|--------|-------------|----------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | 고유 식별자 |
| `member_id` | INTEGER | NULLABLE, INDEX | 멤버별 커스텀 번역 시 멤버 ID. NULL이면 전역 번역 |
| `code` | VARCHAR(100) | NOT NULL | 번역 키코드 (예: "common.ok", "header.title") |
| `ko` | TEXT | NULLABLE | 한국어 번역 |
| `en` | TEXT | NULLABLE | 영어 번역 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 생성 일시 |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | 수정 일시 |

**인덱스/제약조건**:
- UNIQUE KEY on (`member_id`, `code`) - 동일 멤버에 대해 중복 코드 방지
- INDEX on `member_id` - 멤버별 조회 최적화
- INDEX on `code` - 키코드 검색 최적화

---

### MySQL 구현

```sql
CREATE TABLE locale (
  id INT NOT NULL AUTO_INCREMENT,
  member_id INT DEFAULT NULL,
  code VARCHAR(100) NOT NULL,
  ko MEDIUMTEXT,
  en MEDIUMTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_member_code (member_id, code),
  INDEX idx_member_id (member_id),
  INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### PostgreSQL 구현 (Supabase 포함)

```sql
CREATE TABLE locale (
  id SERIAL PRIMARY KEY,
  member_id INTEGER DEFAULT NULL,
  code VARCHAR(100) NOT NULL,
  ko TEXT,
  en TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_member_code UNIQUE (member_id, code)
);

CREATE INDEX idx_locale_member_id ON locale(member_id);
CREATE INDEX idx_locale_code ON locale(code);

-- updated_at 자동 업데이트를 위한 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_locale_updated_at
    BEFORE UPDATE ON locale
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

### SQLite 구현

```sql
CREATE TABLE locale (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER DEFAULT NULL,
  code TEXT NOT NULL,
  ko TEXT,
  en TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX uq_member_code ON locale(member_id, code);
CREATE INDEX idx_locale_member_id ON locale(member_id);
CREATE INDEX idx_locale_code ON locale(code);
```

---

### 추가 언어 지원 확장

더 많은 언어를 지원하려면 컬럼을 추가하거나, 정규화된 구조를 사용합니다.

#### 방법 1: 컬럼 추가 (단순)

```sql
ALTER TABLE locale ADD COLUMN ja TEXT;  -- 일본어
ALTER TABLE locale ADD COLUMN zh TEXT;  -- 중국어
ALTER TABLE locale ADD COLUMN es TEXT;  -- 스페인어
```

#### 방법 2: 정규화 구조 (유연)

```sql
-- 번역 키 테이블
CREATE TABLE locale_keys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  member_id INT DEFAULT NULL,
  code VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_member_code (member_id, code)
);

-- 번역 값 테이블
CREATE TABLE locale_translations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  locale_key_id INT NOT NULL,
  lang VARCHAR(10) NOT NULL,  -- 'ko', 'en', 'ja', 'zh', etc.
  value TEXT,
  FOREIGN KEY (locale_key_id) REFERENCES locale_keys(id) ON DELETE CASCADE,
  UNIQUE KEY uq_key_lang (locale_key_id, lang)
);
```

---

## 프론트엔드 설정

### 1. 패키지 설치

```bash
npm install react-intl styled-components prop-types axios
```

### 2. 기본 번역 파일 생성

**src/locale/ko.json**
```json
{
  "common.ok": "확인",
  "common.cancel": "취소",
  "common.save": "저장",
  "common.edit": "편집",
  "header.title": "사이트 제목",
  "footer.copyright": "All rights reserved."
}
```

**src/locale/en.json**
```json
{
  "common.ok": "OK",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.edit": "Edit",
  "header.title": "Site Title",
  "footer.copyright": "All rights reserved."
}
```

### 3. LanguageContext 생성

**src/contexts/LanguageContext.js**
```javascript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getLocale } from '../services/api';

// 로컬 기본 번역 파일 import
import koMessages from '../locale/ko.json';
import enMessages from '../locale/en.json';

const LanguageContext = createContext();

// 기본 메시지 (로컬 파일 기반)
const defaultMessages = {
  ko: koMessages,
  en: enMessages,
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children, memberId }) => {
  const [locale, setLocale] = useState(() => localStorage.getItem('lang') || 'ko');
  const [messages, setMessages] = useState(defaultMessages['ko']);
  const [allMessages, setAllMessages] = useState(defaultMessages);
  const [availableLangs, setAvailableLangs] = useState(['ko', 'en']);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 먼저 로컬 메시지로 초기화
    setMessages(defaultMessages[locale] || defaultMessages['ko']);

    // memberId가 없으면 로컬 메시지만 사용
    if (!memberId) {
      setIsLoading(false);
      return;
    }

    // API에서 추가/커스텀 메시지 가져오기
    getLocale(memberId)
      .then((result) => {
        if (result.data.success && result.data.messages) {
          // API 메시지를 로컬 메시지와 병합 (API가 우선)
          const mergedMessages = {
            ko: { ...defaultMessages.ko, ...result.data.messages.ko },
            en: { ...defaultMessages.en, ...result.data.messages.en },
          };

          if (result.data.langs) {
            setAvailableLangs(result.data.langs);
          }
          setAllMessages(mergedMessages);
          setMessages(mergedMessages[locale] || mergedMessages['ko']);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch locale from API, using local messages:', err);
        setIsLoading(false);
      });
  }, [memberId]);

  useEffect(() => {
    if (Object.keys(allMessages).length > 0) {
      setMessages(allMessages[locale] || allMessages['ko']);
    }
  }, [locale, allMessages]);

  const changeLanguage = useCallback((newLocale) => {
    if (newLocale === locale) return;
    setLocale(newLocale);
    localStorage.setItem('lang', newLocale);
  }, [locale]);

  return (
    <LanguageContext.Provider value={{
      locale,
      messages,
      availableLangs,
      isLoading,
      changeLanguage,
      isKorean: locale === 'ko',
      isEnglish: locale === 'en',
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
```

### 4. 앱 루트에서 Provider 설정

**src/App.js 또는 src/index.js**
```javascript
import { IntlProvider } from 'react-intl';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

function AppWithIntl({ children }) {
  const { locale, messages, isLoading } = useLanguage();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <IntlProvider locale={locale} messages={messages}>
      {children}
    </IntlProvider>
  );
}

function App() {
  const memberId = 'your-member-id'; // 실제 멤버 ID로 대체

  return (
    <LanguageProvider memberId={memberId}>
      <AppWithIntl>
        {/* 앱 컴포넌트 */}
      </AppWithIntl>
    </LanguageProvider>
  );
}
```

---

## 백엔드 API 설정

### 필수 API 엔드포인트

#### 1. GET /getLocale

전체 번역 데이터를 조회합니다.

**요청 파라미터**:
- `member_id`: 멤버 ID (optional)
- `langs`: 언어 배열 (default: ['ko', 'en'])

**응답 예시**:
```json
{
  "success": true,
  "messages": {
    "ko": {
      "common.ok": "확인",
      "header.title": "사이트 제목"
    },
    "en": {
      "common.ok": "OK",
      "header.title": "Site Title"
    }
  },
  "langs": ["ko", "en"]
}
```

**구현 예시 (Node.js/Express)**:
```javascript
app.get('/getLocale', async (req, res) => {
  const { member_id, langs = ['ko', 'en'] } = req.query;

  try {
    // 전역 번역 + 멤버별 번역 조회
    const rows = await db.query(`
      SELECT code, ko, en FROM locale
      WHERE member_id IS NULL OR member_id = ?
      ORDER BY member_id ASC
    `, [member_id]);

    const messages = { ko: {}, en: {} };

    rows.forEach(row => {
      if (row.ko) messages.ko[row.code] = row.ko;
      if (row.en) messages.en[row.code] = row.en;
    });

    res.json({ success: true, messages, langs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### 2. GET /fetch-locale

특정 키코드의 번역을 조회합니다 (편집 모달용).

**요청 파라미터**:
- `member_id`: 멤버 ID
- `keycode`: 번역 키코드

**응답 예시**:
```json
{
  "success": true,
  "messages": {
    "ko": { "header.title": "사이트 제목" },
    "en": { "header.title": "Site Title" }
  }
}
```

#### 3. POST /save-locale

번역을 저장하거나 업데이트합니다.

**요청 바디**:
```json
{
  "member_id": 1,
  "keycode": "header.title",
  "localeData": {
    "ko": "새로운 제목",
    "en": "New Title"
  }
}
```

**구현 예시 (Node.js/Express)**:
```javascript
app.post('/save-locale', async (req, res) => {
  const { member_id, keycode, localeData } = req.body;

  try {
    // UPSERT (INSERT or UPDATE)
    await db.query(`
      INSERT INTO locale (member_id, code, ko, en)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ko = VALUES(ko),
        en = VALUES(en),
        updated_at = CURRENT_TIMESTAMP
    `, [member_id, keycode, localeData.ko, localeData.en]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## IntlObject 컴포넌트

### 핵심 기능

1. **기본 표시**: `react-intl`의 `formatMessage`를 사용하여 현재 언어의 번역 표시
2. **편집 모드**: 로그인 + Edit Mode 활성화 시 클릭하면 편집 모달 표시
3. **다중 HTML 태그 지원**: div, span, p, label 등 다양한 HTML 요소로 렌더링

### 기본 사용법

```jsx
import IntlObject from './components/Common/IntlObject';

// 기본 사용 (div로 렌더링)
<IntlObject keycode="header.title" />

// span으로 렌더링
<IntlObject keycode="common.ok" returnType="span" />

// p 태그로 렌더링
<IntlObject keycode="footer.description" returnType="p" />

// 라벨로 렌더링
<IntlObject keycode="form.email.label" returnType="label" />
```

### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `keycode` | string | (필수) | 번역 키코드 |
| `returnType` | 'div' \| 'span' \| 'p' \| 'label' | 'div' | 렌더링할 HTML 태그 |
| `isLogin` | boolean | undefined | 편집 가능 여부 강제 설정. undefined면 자동 감지 |
| `containerClass` | string | '' | 편집 모달 컨테이너 추가 클래스 |
| `containerStyle` | object | {} | 편집 모달 컨테이너 추가 스타일 |

### 의존성 Context

IntlObject가 제대로 동작하려면 다음 Context들이 필요합니다:

1. **BuilderContext**: Edit Mode 상태 관리
2. **InstanceContext**: 멤버 ID 제공
3. **Auth Hook**: 로그인 상태 확인

#### BuilderContext 예시

```javascript
// src/contexts/BuilderContext.js
import React, { createContext, useState, useContext, useCallback } from 'react';

const BuilderContext = createContext();

export const useBuilder = () => useContext(BuilderContext);

export const BuilderProvider = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  return (
    <BuilderContext.Provider value={{ isEditMode, toggleEditMode }}>
      {children}
    </BuilderContext.Provider>
  );
};
```

---

## 사용 예시

### 1. 기본적인 다국어 텍스트 표시

```jsx
// 헤더 제목
<IntlObject keycode="header.title" />

// 버튼 텍스트
<button>
  <IntlObject keycode="common.save" returnType="span" />
</button>

// 폼 라벨
<IntlObject keycode="form.email.label" returnType="label" />
<input type="email" />
```

### 2. 조건부 편집 가능 설정

```jsx
// 관리자만 편집 가능
<IntlObject
  keycode="header.title"
  isLogin={user?.role === 'admin'}
/>

// 편집 비활성화
<IntlObject
  keycode="footer.copyright"
  isLogin={false}
/>
```

### 3. HTML 컨텐츠가 포함된 번역

번역 파일에서 HTML을 포함할 수 있습니다:

```json
{
  "welcome.message": "<strong>환영합니다!</strong> 저희 서비스를 이용해 주셔서 감사합니다."
}
```

IntlObject는 `dangerouslySetInnerHTML`을 사용하여 HTML을 렌더링합니다.

### 4. 언어 전환

```jsx
import { useLanguage } from './contexts/LanguageContext';

function LanguageSwitcher() {
  const { locale, changeLanguage, availableLangs } = useLanguage();

  return (
    <div>
      {availableLangs.map(lang => (
        <button
          key={lang}
          onClick={() => changeLanguage(lang)}
          style={{ fontWeight: locale === lang ? 'bold' : 'normal' }}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

---

## 마이그레이션 체크리스트

다른 프로젝트에 IntlObject 시스템을 도입할 때 확인해야 할 항목:

### 프론트엔드

- [ ] `react-intl`, `styled-components`, `prop-types`, `axios` 설치
- [ ] `src/locale/` 디렉토리에 기본 번역 JSON 파일 생성
- [ ] `LanguageContext.js` 생성 및 Provider 설정
- [ ] `BuilderContext.js` 생성 (Edit Mode 관리)
- [ ] `useAuth` 훅 또는 로그인 상태 관리 구현
- [ ] API 서비스 함수 구현 (`getLocale`, `fetchLocale`, `saveLocale`)
- [ ] `IntlObject.js` 컴포넌트 복사 및 import 경로 수정
- [ ] 앱 루트에서 필요한 Provider들로 감싸기

### 백엔드

- [ ] `locale` 테이블 생성 (사용하는 DB에 맞게)
- [ ] GET `/getLocale` API 구현
- [ ] GET `/fetch-locale` API 구현
- [ ] POST `/save-locale` API 구현
- [ ] DELETE `/delete-locale` API 구현 (선택)

### 운영

- [ ] 초기 번역 데이터 마이그레이션 (기존 JSON → DB)
- [ ] Edit Mode 활성화 UI 구현 (관리자용)
- [ ] 언어 전환 UI 구현

---

## 주의사항

1. **XSS 방지**: IntlObject는 `dangerouslySetInnerHTML`을 사용합니다. 데이터베이스에 저장되는 번역 값이 신뢰할 수 있는 소스에서만 입력되도록 하세요.

2. **성능**: 많은 IntlObject가 한 페이지에 있으면 Edit Mode 토글 시 모두 다시 렌더링됩니다. 필요시 `React.memo`를 활용하세요.

3. **SEO**: 서버사이드 렌더링(SSR)을 사용하는 경우, 초기 로드 시 로컬 JSON 파일의 번역이 사용됩니다. API에서 가져온 커스텀 번역은 클라이언트에서 hydration 후 적용됩니다.

4. **캐싱**: API 응답을 캐싱하여 불필요한 요청을 줄이는 것을 권장합니다.

---

## 라이선스

이 코드는 bubanc-site 프로젝트의 일부로, 동일한 라이선스가 적용됩니다.
