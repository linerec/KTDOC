# Gallery (공연 아카이브) 요구사항 정의서

## 1. 개요

### 1.1 목적
한국 전통 북 공연 단체 KTDOC의 공연 아카이브 시스템을 구축한다. 2008년부터 현재까지의 공연 기록을 체계적으로 관리하고, 방문자에게 연도별/카테고리별로 쉽게 탐색할 수 있는 갤러리를 제공한다.

### 1.2 범위
- **시간 범위**: 2008년 ~ 현재 (장기 운영)
- **콘텐츠 유형**: 공연 이벤트, 이미지, 영상, 포스터
- **사용자**: 일반 방문자 (열람), 관리자 (CRUD)

### 1.3 참조 디자인
- 디자인 파일: `/docs/design/layouts/gallery.png`

---

## 2. 기능 요구사항

### 2.1 공개 페이지 (방문자용)

#### 2.1.1 갤러리 목록 페이지 (`/gallery`)
| 요구사항 ID | 설명 | 우선순위 |
|------------|------|---------|
| GAL-001 | 연도별 섹션으로 이벤트 표시 (최신 연도가 상단) | 필수 |
| GAL-002 | 연도 필터 드롭다운 제공 | 필수 |
| GAL-003 | 검색 기능 (제목, 설명 검색) | 필수 |
| GAL-004 | 카테고리 필터 (경연대회, 축제, 기업행사 등) | 필수 |
| GAL-005 | 2열 그리드 레이아웃의 이벤트 카드 | 필수 |
| GAL-006 | 이벤트 카드: 썸네일, 날짜, 제목, "Read More" | 필수 |
| GAL-007 | 섹션 사이 피처(대표) 이미지 표시 | 선택 |
| GAL-008 | 무한 스크롤 또는 페이지네이션 | 필수 |
| GAL-009 | 반응형 디자인 (모바일 1열, 태블릿/데스크탑 2열) | 필수 |

#### 2.1.2 이벤트 상세 페이지 (`/gallery/[year]/[slug]`)
| 요구사항 ID | 설명 | 우선순위 |
|------------|------|---------|
| GAL-010 | 이벤트 기본 정보 (제목, 날짜, 카테고리, 설명) | 필수 |
| GAL-011 | 포스터/전단지 이미지 표시 | 필수 |
| GAL-012 | 이미지 갤러리 (그리드 + 라이트박스) | 필수 |
| GAL-013 | YouTube 영상 임베드 | 필수 |
| GAL-014 | 이전/다음 이벤트 네비게이션 | 선택 |
| GAL-015 | 소셜 공유 버튼 | 선택 |
| GAL-016 | 목록으로 돌아가기 링크 | 필수 |

### 2.2 관리자 대시보드

#### 2.2.1 이벤트 목록 (`/admin/gallery`)
| 요구사항 ID | 설명 | 우선순위 |
|------------|------|---------|
| ADM-001 | 모든 이벤트 테이블 뷰 | 필수 |
| ADM-002 | 연도/카테고리/공개상태 필터 | 필수 |
| ADM-003 | 검색 기능 | 필수 |
| ADM-004 | 새 이벤트 추가 버튼 | 필수 |
| ADM-005 | 이벤트별 편집/삭제 액션 | 필수 |
| ADM-006 | 공개/비공개 토글 | 필수 |
| ADM-007 | 피처 이벤트 지정 | 선택 |

#### 2.2.2 이벤트 생성/편집 (`/admin/gallery/new`, `/admin/gallery/[id]`)
| 요구사항 ID | 설명 | 우선순위 |
|------------|------|---------|
| ADM-010 | 기본 정보 입력 (제목, 날짜, 카테고리, 설명) | 필수 |
| ADM-011 | 한국어/영어 이중 입력 필드 | 필수 |
| ADM-012 | 포스터 이미지 업로드 (단일) | 필수 |
| ADM-013 | 갤러리 이미지 대량 업로드 (드래그앤드롭) | 필수 |
| ADM-014 | 이미지 순서 변경 (드래그앤드롭) | 필수 |
| ADM-015 | 이미지 개별 삭제 | 필수 |
| ADM-016 | YouTube URL 입력 (다중) | 필수 |
| ADM-017 | 슬러그 자동 생성 (제목 기반) + 수동 편집 | 필수 |
| ADM-018 | 미리보기 기능 | 선택 |
| ADM-019 | 임시저장 (draft) 기능 | 선택 |

#### 2.2.3 카테고리 관리 (`/admin/gallery/categories`)
| 요구사항 ID | 설명 | 우선순위 |
|------------|------|---------|
| ADM-020 | 카테고리 목록 표시 | 필수 |
| ADM-021 | 카테고리 추가/편집/삭제 | 필수 |
| ADM-022 | 한국어/영어 카테고리명 | 필수 |

---

## 3. 데이터 모델

### 3.1 ERD 개요
```
event_categories (1) ──< (N) events (1) ──< (N) event_images
                                    │
                                    └──< (N) event_videos
```

### 3.2 테이블 스키마

#### 3.2.1 `event_categories` (이벤트 카테고리)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | INTEGER | PK, AUTO | 고유 ID |
| slug | TEXT | NOT NULL, UNIQUE | URL 슬러그 |
| name_ko | TEXT | NOT NULL | 한국어 카테고리명 |
| name_en | TEXT | NOT NULL | 영어 카테고리명 |
| sort_order | INTEGER | DEFAULT 0 | 정렬 순서 |
| created_at | TEXT | DEFAULT now | 생성일시 |

**초기 카테고리 예시**:
- 경연대회 (Competition)
- 축제 (Festival)
- 기업행사 (Corporate Event)
- 문화행사 (Cultural Event)
- 기타 (Other)

#### 3.2.2 `events` (이벤트/공연)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | INTEGER | PK, AUTO | 고유 ID |
| slug | TEXT | NOT NULL, UNIQUE | URL 슬러그 |
| year | INTEGER | NOT NULL, INDEX | 연도 (필터용) |
| event_date | TEXT | NOT NULL | 이벤트 날짜 (YYYY-MM-DD) |
| title_ko | TEXT | NOT NULL | 한국어 제목 |
| title_en | TEXT | | 영어 제목 |
| description_ko | TEXT | | 한국어 설명 |
| description_en | TEXT | | 영어 설명 |
| category_id | INTEGER | FK → event_categories | 카테고리 |
| poster_url | TEXT | | 포스터 이미지 URL |
| poster_r2_key | TEXT | | 포스터 R2 키 |
| thumbnail_url | TEXT | | 썸네일 URL (목록용) |
| thumbnail_r2_key | TEXT | | 썸네일 R2 키 |
| is_featured | INTEGER | DEFAULT 0 | 피처 이벤트 여부 |
| is_published | INTEGER | DEFAULT 0 | 공개 여부 |
| view_count | INTEGER | DEFAULT 0 | 조회수 |
| created_at | TEXT | DEFAULT now | 생성일시 |
| updated_at | TEXT | DEFAULT now | 수정일시 |

**인덱스**:
- `idx_events_year` ON (year)
- `idx_events_category` ON (category_id)
- `idx_events_published` ON (is_published)
- `idx_events_slug` ON (slug)

#### 3.2.3 `event_images` (이벤트 이미지)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | INTEGER | PK, AUTO | 고유 ID |
| event_id | INTEGER | FK → events, NOT NULL | 이벤트 ID |
| image_url | TEXT | NOT NULL | 이미지 URL |
| r2_key | TEXT | NOT NULL | R2 오브젝트 키 |
| sort_order | INTEGER | DEFAULT 0 | 정렬 순서 |
| caption_ko | TEXT | | 한국어 캡션 |
| caption_en | TEXT | | 영어 캡션 |
| width | INTEGER | | 이미지 너비 |
| height | INTEGER | | 이미지 높이 |
| size | INTEGER | | 파일 크기 (bytes) |
| created_at | TEXT | DEFAULT now | 생성일시 |

**인덱스**:
- `idx_event_images_event` ON (event_id)

#### 3.2.4 `event_videos` (이벤트 영상)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | INTEGER | PK, AUTO | 고유 ID |
| event_id | INTEGER | FK → events, NOT NULL | 이벤트 ID |
| youtube_url | TEXT | NOT NULL | YouTube URL |
| youtube_id | TEXT | NOT NULL | YouTube 영상 ID |
| title | TEXT | | 영상 제목 |
| sort_order | INTEGER | DEFAULT 0 | 정렬 순서 |
| created_at | TEXT | DEFAULT now | 생성일시 |

**인덱스**:
- `idx_event_videos_event` ON (event_id)

### 3.3 D1 마이그레이션 SQL

```sql
-- migrations/0002_gallery.sql

-- 카테고리 테이블
CREATE TABLE IF NOT EXISTS event_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 이벤트 테이블
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  title_ko TEXT NOT NULL,
  title_en TEXT,
  description_ko TEXT,
  description_en TEXT,
  category_id INTEGER REFERENCES event_categories(id),
  poster_url TEXT,
  poster_r2_key TEXT,
  thumbnail_url TEXT,
  thumbnail_r2_key TEXT,
  is_featured INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

-- 이벤트 이미지 테이블
CREATE TABLE IF NOT EXISTS event_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  caption_ko TEXT,
  caption_en TEXT,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_images_event ON event_images(event_id);

-- 이벤트 영상 테이블
CREATE TABLE IF NOT EXISTS event_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  youtube_url TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  title TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_videos_event ON event_videos(event_id);

-- 초기 카테고리 데이터
INSERT INTO event_categories (slug, name_ko, name_en, sort_order) VALUES
  ('competition', '경연대회', 'Competition', 1),
  ('festival', '축제', 'Festival', 2),
  ('corporate', '기업행사', 'Corporate Event', 3),
  ('cultural', '문화행사', 'Cultural Event', 4),
  ('other', '기타', 'Other', 99);
```

---

## 4. API 설계

### 4.1 공개 API (인증 불필요)

#### GET `/api/gallery/events`
이벤트 목록 조회

**Query Parameters**:
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| year | number | 연도 필터 |
| category | string | 카테고리 슬러그 |
| search | string | 검색어 |
| page | number | 페이지 번호 (기본: 1) |
| limit | number | 페이지당 항목 (기본: 20) |
| featured | boolean | 피처 이벤트만 |

**Response**:
```json
{
  "success": true,
  "data": {
    "events": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    },
    "years": [2025, 2024, 2023, ...]
  }
}
```

#### GET `/api/gallery/events/[id]`
이벤트 상세 조회 (id 또는 slug)

**Response**:
```json
{
  "success": true,
  "data": {
    "event": {
      "id": 1,
      "slug": "72nd-korea-us-alliance",
      "year": 2025,
      "event_date": "2025-01-01",
      "title_ko": "제72회 한미동맹 기념행사",
      "title_en": "72nd Korea-US Alliance Anniversary",
      "description_ko": "...",
      "description_en": "...",
      "category": {
        "id": 1,
        "slug": "cultural",
        "name_ko": "문화행사",
        "name_en": "Cultural Event"
      },
      "poster_url": "https://...",
      "thumbnail_url": "https://...",
      "images": [...],
      "videos": [...]
    }
  }
}
```

#### GET `/api/gallery/categories`
카테고리 목록 조회

### 4.2 관리자 API (인증 필요)

#### POST `/api/admin/gallery/events`
이벤트 생성

**Request Body**:
```json
{
  "title_ko": "제72회 한미동맹 기념행사",
  "title_en": "72nd Korea-US Alliance Anniversary",
  "event_date": "2025-01-01",
  "category_id": 1,
  "description_ko": "...",
  "description_en": "...",
  "is_published": true
}
```

#### PUT `/api/admin/gallery/events/[id]`
이벤트 수정

#### DELETE `/api/admin/gallery/events/[id]`
이벤트 삭제 (연관 이미지도 R2에서 삭제)

#### POST `/api/admin/gallery/events/[id]/images`
이미지 대량 업로드

**Request**: `multipart/form-data`
- files[]: 이미지 파일들 (다중)

**Response**:
```json
{
  "success": true,
  "data": {
    "uploaded": 15,
    "failed": 0,
    "images": [...]
  }
}
```

#### PUT `/api/admin/gallery/events/[id]/images/order`
이미지 순서 변경

**Request Body**:
```json
{
  "order": [3, 1, 2, 5, 4]
}
```

#### DELETE `/api/admin/gallery/events/[id]/images/[imageId]`
이미지 개별 삭제

#### POST `/api/admin/gallery/events/[id]/videos`
YouTube 영상 추가

**Request Body**:
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=xxxxx",
  "title": "공연 영상"
}
```

#### DELETE `/api/admin/gallery/events/[id]/videos/[videoId]`
영상 삭제

#### CRUD `/api/admin/gallery/categories`
카테고리 관리

---

## 5. 페이지/컴포넌트 구조

### 5.1 라우트 구조
```
app/
├── (public)/
│   └── gallery/
│       ├── page.tsx              # 갤러리 목록
│       └── [year]/
│           └── [slug]/
│               └── page.tsx      # 이벤트 상세
├── admin/
│   └── gallery/
│       ├── page.tsx              # 이벤트 관리 목록
│       ├── new/
│       │   └── page.tsx          # 이벤트 생성
│       ├── [id]/
│       │   └── page.tsx          # 이벤트 편집
│       └── categories/
│           └── page.tsx          # 카테고리 관리
└── api/
    ├── gallery/
    │   ├── events/
    │   │   ├── route.ts          # GET 목록
    │   │   └── [id]/
    │   │       └── route.ts      # GET 상세
    │   └── categories/
    │       └── route.ts          # GET 카테고리
    └── admin/
        └── gallery/
            ├── events/
            │   ├── route.ts      # POST 생성
            │   └── [id]/
            │       ├── route.ts  # PUT/DELETE
            │       ├── images/
            │       │   └── route.ts  # 이미지 관리
            │       └── videos/
            │           └── route.ts  # 영상 관리
            └── categories/
                └── route.ts      # 카테고리 CRUD
```

### 5.2 컴포넌트 구조
```
components/
├── gallery/
│   ├── GalleryList.tsx           # 목록 페이지 메인
│   ├── YearSection.tsx           # 연도별 섹션
│   ├── EventCard.tsx             # 이벤트 카드
│   ├── EventDetail.tsx           # 상세 페이지 메인
│   ├── ImageGallery.tsx          # 이미지 갤러리 (라이트박스)
│   ├── VideoEmbed.tsx            # YouTube 임베드
│   ├── GalleryFilter.tsx         # 필터 (연도, 카테고리, 검색)
│   └── GalleryPagination.tsx     # 페이지네이션
└── admin/
    └── gallery/
        ├── EventForm.tsx         # 이벤트 생성/편집 폼
        ├── ImageUploader.tsx     # 대량 이미지 업로더
        ├── ImageSortable.tsx     # 이미지 순서 변경
        ├── VideoManager.tsx      # YouTube 영상 관리
        ├── CategoryManager.tsx   # 카테고리 관리
        └── EventTable.tsx        # 이벤트 목록 테이블
```

---

## 6. UI/UX 요구사항

### 6.1 디자인 시스템
- 기존 디자인 시스템 활용
- 다크 테마 (--color-primary: #0a0a0a)
- 액센트 컬러: 한국 빨강 (#c4302b), 골드 (#d4a017)

### 6.2 반응형 브레이크포인트
| 디바이스 | 너비 | 그리드 |
|----------|------|--------|
| 모바일 | < 768px | 1열 |
| 태블릿 | 768px ~ 1024px | 2열 |
| 데스크탑 | > 1024px | 2열 |

### 6.3 인터랙션
- **이미지 라이트박스**: 클릭 시 전체화면, 좌우 스와이프/화살표 키
- **무한 스크롤**: 또는 "더 보기" 버튼으로 추가 로드
- **필터 URL 동기화**: 필터 변경 시 URL 파라미터 업데이트 (공유 가능)
- **관리자 이미지 업로드**: 드래그앤드롭 + 진행률 표시
- **이미지 순서 변경**: 드래그앤드롭으로 순서 조정

---

## 7. 비기능 요구사항

### 7.1 성능
- 이미지 지연 로딩 (Lazy Loading)
- 썸네일 자동 생성 또는 R2 이미지 리사이징
- 목록 페이지 캐싱 (ISR 또는 SWR)
- 이미지 최적화 (WebP 변환, Next.js Image 컴포넌트)

### 7.2 접근성
- 이미지 대체 텍스트 (alt) - 다국어 지원
- 키보드 네비게이션 (Tab, Enter, Escape)
- 라이트박스 ESC 닫기, 화살표 키 네비게이션
- 스크린 리더 호환성

### 7.3 보안
- 관리자 API 인증 필수 (NextAuth 세션)
- 업로드 파일 검증 (타입: JPEG/PNG/GIF/WebP, 크기: 10MB)
- Rate Limiting (대량 업로드 시)
- CSRF 보호

### 7.4 확장성
- 연도별 데이터 증가에 대응 (인덱스 최적화)
- 이미지 저장소 용량 모니터링
- API 페이지네이션으로 대용량 데이터 처리

---

## 8. 구현 우선순위

### Phase 1: 기본 기능 (MVP)
1. 데이터베이스 마이그레이션 (`migrations/0002_gallery.sql`)
2. 공개 갤러리 목록 페이지 (`/gallery`)
3. 공개 이벤트 상세 페이지 (`/gallery/[year]/[slug]`)
4. 관리자 이벤트 CRUD (`/admin/gallery/*`)
5. 기본 이미지 업로드 (단일)

### Phase 2: 향상 기능
1. 대량 이미지 업로드 (드래그앤드롭, 다중 파일)
2. 이미지 순서 변경 (드래그앤드롭)
3. YouTube 영상 관리
4. 카테고리 관리 UI
5. 필터 및 검색 기능

### Phase 3: 최적화
1. 이미지 최적화 (썸네일 자동 생성, WebP)
2. 무한 스크롤 / 페이지네이션
3. 검색 기능 개선 (자동완성)
4. 캐싱 전략 (ISR, SWR)
5. SEO 최적화 (메타태그, 구조화된 데이터)

---

## 9. 참고 자료

- 디자인 파일: `/docs/design/layouts/gallery.png`
- R2 설정: `/docs/cloudflare-r2-setup.md`
- D1 설정: `/docs/cloudflare-d1-setup.md`
- 이미지 시스템: `/docs/IMAGE_OBJECT_GUIDE.md`
