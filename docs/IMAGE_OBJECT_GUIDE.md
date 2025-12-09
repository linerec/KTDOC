# ImageObject 이미지 관리 시스템 가이드

이 가이드는 ImageObject 컴포넌트와 Cloudflare R2 연동 시스템을 다른 Next.js/React 프로젝트에서 사용하는 방법을 설명합니다.

## 목차

1. [개요](#개요)
2. [시스템 구조](#시스템-구조)
3. [데이터베이스 스키마](#데이터베이스-스키마)
4. [프론트엔드 설정](#프론트엔드-설정)
5. [백엔드 API 설정](#백엔드-api-설정)
6. [ImageObject 컴포넌트](#imageobject-컴포넌트)
7. [사용 예시](#사용-예시)

---

## 개요

ImageObject는 다음과 같은 특징을 가진 이미지 관리 시스템입니다:

- **실시간 편집**: 로그인한 관리자가 Edit Mode에서 직접 이미지를 클릭하여 교체 가능
- **Cloudflare R2 저장**: S3 호환 오브젝트 스토리지로 비용 효율적인 이미지 호스팅
- **키코드 기반 관리**: IntlObject와 동일한 방식으로 이미지를 키코드로 관리
- **반응형 지원**: Next.js Image 컴포넌트 기반으로 최적화된 이미지 제공
- **Fallback 이미지**: 이미지가 없을 경우 기본 이미지 또는 플레이스홀더 표시

---

## 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        프론트엔드                                │
├─────────────────────────────────────────────────────────────────┤
│  src/                                                           │
│  ├── lib/r2/                                                    │
│  │   ├── client.ts          # R2 클라이언트 설정                 │
│  │   ├── upload.ts          # 업로드 유틸리티 함수               │
│  │   └── index.ts           # Export 정리                       │
│  ├── contexts/                                                  │
│  │   └── BuilderContext.tsx # Edit Mode 상태 관리               │
│  ├── components/common/                                         │
│  │   └── ImageObject.tsx    # 편집 가능한 이미지 컴포넌트        │
│  └── app/api/                                                   │
│      ├── upload/route.ts    # 이미지 업로드 API                  │
│      └── images/route.ts    # 이미지 메타데이터 CRUD API         │
├─────────────────────────────────────────────────────────────────┤
│                        외부 서비스                               │
├─────────────────────────────────────────────────────────────────┤
│  Cloudflare R2             # 이미지 파일 저장소                   │
│  └── Public URL            # CDN을 통한 이미지 제공              │
├─────────────────────────────────────────────────────────────────┤
│                        데이터베이스                              │
├─────────────────────────────────────────────────────────────────┤
│  images 테이블             # 이미지 메타데이터 저장               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 데이터베이스 스키마

### 논리적 스키마

**테이블명**: `images` (또는 프로젝트에 맞게 `{project}_images`)

| 컬럼명 | 데이터 타입 | 제약조건 | 설명 |
|--------|-------------|----------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | 고유 식별자 |
| `keycode` | VARCHAR(100) | NOT NULL, UNIQUE | 이미지 키코드 (예: "hero.main", "about.banner") |
| `url` | TEXT | NOT NULL | R2 Public URL |
| `r2_key` | VARCHAR(255) | NOT NULL | R2 오브젝트 키 (삭제 시 필요) |
| `alt_ko` | VARCHAR(255) | NULLABLE | 한국어 대체 텍스트 |
| `alt_en` | VARCHAR(255) | NULLABLE | 영어 대체 텍스트 |
| `width` | INTEGER | NULLABLE | 이미지 원본 너비 |
| `height` | INTEGER | NULLABLE | 이미지 원본 높이 |
| `size` | INTEGER | NULLABLE | 파일 크기 (bytes) |
| `content_type` | VARCHAR(50) | NULLABLE | MIME 타입 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 생성 일시 |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | 수정 일시 |

**인덱스/제약조건**:
- UNIQUE KEY on `keycode` - 중복 키코드 방지
- INDEX on `keycode` - 키코드 검색 최적화

---

### MySQL 구현

```sql
CREATE TABLE images (
  id INT NOT NULL AUTO_INCREMENT,
  keycode VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  r2_key VARCHAR(255) NOT NULL,
  alt_ko VARCHAR(255) DEFAULT NULL,
  alt_en VARCHAR(255) DEFAULT NULL,
  width INT DEFAULT NULL,
  height INT DEFAULT NULL,
  size INT DEFAULT NULL,
  content_type VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_keycode (keycode),
  INDEX idx_keycode (keycode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### Cloudflare D1 (SQLite) 구현

```sql
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keycode TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  alt_ko TEXT,
  alt_en TEXT,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  content_type TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_images_keycode ON images(keycode);
```

---

### PostgreSQL 구현

```sql
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  keycode VARCHAR(100) NOT NULL UNIQUE,
  url TEXT NOT NULL,
  r2_key VARCHAR(255) NOT NULL,
  alt_ko VARCHAR(255),
  alt_en VARCHAR(255),
  width INTEGER,
  height INTEGER,
  size INTEGER,
  content_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_images_keycode ON images(keycode);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_images_updated_at
    BEFORE UPDATE ON images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 프론트엔드 설정

### 1. 환경 변수 설정

**.env.local**
```env
# Cloudflare R2 Configuration
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

### 2. R2 클라이언트 설정

**lib/r2/client.ts**
```typescript
import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;
```

### 3. 업로드 유틸리티

**lib/r2/upload.ts**
```typescript
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from './client';

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export async function uploadToR2(
  buffer: Buffer,
  filename: string,
  folder: string = 'images'
): Promise<UploadResult> {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${folder}/${timestamp}-${sanitizedFilename}`;

  const contentType = getContentType(filename);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
    size: buffer.length,
    contentType,
  };
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return types[ext || ''] || 'application/octet-stream';
}
```

### 4. 이미지 타입 정의

**types/image.ts**
```typescript
export interface ImageData {
  id: number;
  keycode: string;
  url: string;
  r2_key: string;
  alt_ko: string | null;
  alt_en: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  content_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImageObjectProps {
  keycode: string;
  alt?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  fallbackSrc?: string;
  isLogin?: boolean;
}
```

---

## 백엔드 API 설정

### 1. 이미지 업로드 API

**app/api/upload/route.ts**
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { uploadToR2 } from '@/lib/r2';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'images';

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: '파일 크기가 10MB를 초과합니다.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToR2(buffer, file.name, folder);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: '업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

### 2. 이미지 메타데이터 CRUD API

**app/api/images/route.ts**
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { queryD1, executeD1 } from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';

interface ImageRow {
  id: number;
  keycode: string;
  url: string;
  r2_key: string;
  alt_ko: string | null;
  alt_en: string | null;
  width: number | null;
  height: number | null;
}

// GET - 이미지 데이터 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keycode = searchParams.get('keycode');

    if (keycode) {
      // 단일 이미지 조회
      const results = await queryD1<ImageRow>(
        'SELECT * FROM images WHERE keycode = ?',
        [keycode]
      );

      return NextResponse.json({
        success: true,
        data: results[0] || null,
      });
    }

    // 전체 이미지 조회
    const results = await queryD1<ImageRow>('SELECT * FROM images ORDER BY keycode');

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Image fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}

// POST - 이미지 저장/업데이트 (upsert)
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { keycode, url, r2_key, alt_ko, alt_en, width, height, size, content_type } = body;

    if (!keycode || !url || !r2_key) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 기존 이미지 확인
    const existing = await queryD1<ImageRow>(
      'SELECT * FROM images WHERE keycode = ?',
      [keycode]
    );

    if (existing.length > 0) {
      // 기존 R2 파일 삭제
      try {
        await deleteFromR2(existing[0].r2_key);
      } catch (e) {
        console.warn('Failed to delete old R2 file:', e);
      }

      // 업데이트
      await executeD1(
        `UPDATE images SET
          url = ?, r2_key = ?, alt_ko = ?, alt_en = ?,
          width = ?, height = ?, size = ?, content_type = ?,
          updated_at = datetime('now')
        WHERE keycode = ?`,
        [url, r2_key, alt_ko, alt_en, width, height, size, content_type, keycode]
      );
    } else {
      // 새로 생성
      await executeD1(
        `INSERT INTO images (keycode, url, r2_key, alt_ko, alt_en, width, height, size, content_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [keycode, url, r2_key, alt_ko, alt_en, width, height, size, content_type]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Image save error:', error);
    return NextResponse.json(
      { success: false, error: '저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - 이미지 삭제
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keycode = searchParams.get('keycode');

    if (!keycode) {
      return NextResponse.json(
        { success: false, error: '키코드가 필요합니다.' },
        { status: 400 }
      );
    }

    // 기존 이미지 조회
    const existing = await queryD1<ImageRow>(
      'SELECT * FROM images WHERE keycode = ?',
      [keycode]
    );

    if (existing.length > 0) {
      // R2에서 파일 삭제
      try {
        await deleteFromR2(existing[0].r2_key);
      } catch (e) {
        console.warn('Failed to delete R2 file:', e);
      }

      // DB에서 삭제
      await executeD1('DELETE FROM images WHERE keycode = ?', [keycode]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    return NextResponse.json(
      { success: false, error: '삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## ImageObject 컴포넌트

### 핵심 기능

1. **기본 표시**: Next.js Image 컴포넌트로 최적화된 이미지 렌더링
2. **편집 모드**: 로그인 + Edit Mode 활성화 시 클릭하면 업로드 모달 표시
3. **Fallback 지원**: 이미지가 없을 경우 기본 이미지 또는 플레이스홀더 표시
4. **Alt 텍스트 다국어**: 현재 언어에 맞는 대체 텍스트 자동 선택

### 컴포넌트 코드

**components/common/ImageObject.tsx**
```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuilder } from '@/contexts/BuilderContext';

interface ImageData {
  url: string;
  r2_key: string;
  alt_ko: string | null;
  alt_en: string | null;
  width: number | null;
  height: number | null;
}

interface ImageObjectProps {
  keycode: string;
  alt?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  containerClassName?: string;
  fallbackSrc?: string;
  isLogin?: boolean;
  sizes?: string;
  quality?: number;
}

export default function ImageObject({
  keycode,
  alt,
  width = 400,
  height = 300,
  fill = false,
  priority = false,
  className = '',
  containerClassName = '',
  fallbackSrc = '/assets/images/placeholder.png',
  isLogin,
  sizes,
  quality = 75,
}: ImageObjectProps) {
  const { data: session } = useSession();
  const { locale } = useLanguage();
  const { isEditMode } = useBuilder();

  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editAltKo, setEditAltKo] = useState('');
  const [editAltEn, setEditAltEn] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = isLogin !== undefined ? isLogin : !!session;
  const isEditable = canEdit && isEditMode;

  // 이미지 데이터 로드
  useEffect(() => {
    async function fetchImage() {
      try {
        const res = await fetch(`/api/images?keycode=${encodeURIComponent(keycode)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setImageData(data.data);
          setEditAltKo(data.data.alt_ko || '');
          setEditAltEn(data.data.alt_en || '');
        }
      } catch (error) {
        console.error('Failed to fetch image:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchImage();
  }, [keycode]);

  // 이미지 소스 결정
  const imageSrc = imageData?.url || fallbackSrc;
  const imageAlt = alt || (locale === 'ko' ? imageData?.alt_ko : imageData?.alt_en) || keycode;

  // 클릭 핸들러
  const handleClick = () => {
    if (isEditable) {
      setShowModal(true);
    }
  };

  // 파일 업로드 핸들러
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // 1. R2에 업로드
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'images');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error);
      }

      // 2. 이미지 크기 가져오기
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // 3. DB에 메타데이터 저장
      const saveRes = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keycode,
          url: uploadData.data.url,
          r2_key: uploadData.data.key,
          alt_ko: editAltKo,
          alt_en: editAltEn,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: uploadData.data.size,
          content_type: uploadData.data.contentType,
        }),
      });

      if (saveRes.ok) {
        setImageData({
          url: uploadData.data.url,
          r2_key: uploadData.data.key,
          alt_ko: editAltKo,
          alt_en: editAltEn,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        setShowModal(false);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // Alt 텍스트만 저장
  const handleSaveAlt = async () => {
    if (!imageData) return;

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keycode,
          url: imageData.url,
          r2_key: imageData.r2_key,
          alt_ko: editAltKo,
          alt_en: editAltEn,
          width: imageData.width,
          height: imageData.height,
        }),
      });

      if (res.ok) {
        setImageData({
          ...imageData,
          alt_ko: editAltKo,
          alt_en: editAltEn,
        });
        setShowModal(false);
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div
        className={`image-object-loading ${containerClassName}`}
        style={{ width: fill ? '100%' : width, height: fill ? '100%' : height }}
      />
    );
  }

  return (
    <>
      <div
        className={`image-object-container ${containerClassName} ${isEditable ? 'editable' : ''}`}
        onClick={handleClick}
        style={{ position: fill ? 'relative' : undefined }}
      >
        {fill ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes={sizes}
            priority={priority}
            quality={quality}
            className={className}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={imageData?.width || width}
            height={imageData?.height || height}
            priority={priority}
            quality={quality}
            className={className}
          />
        )}

        {isEditable && (
          <div className="image-object-edit-overlay">
            <span>클릭하여 이미지 변경</span>
          </div>
        )}
      </div>

      {/* 편집 모달 */}
      {showModal && (
        <div className="image-object-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="image-object-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-object-modal-header">
              <h3>이미지 편집</h3>
              <button onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <div className="image-object-modal-body">
              <div className="image-object-preview">
                {imageData?.url ? (
                  <img src={imageData.url} alt="Preview" />
                ) : (
                  <div className="image-object-no-image">이미지 없음</div>
                )}
              </div>

              <div className="image-object-form">
                <div className="form-group">
                  <label>키코드</label>
                  <input type="text" value={keycode} disabled />
                </div>

                <div className="form-group">
                  <label>이미지 업로드</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </div>

                <div className="form-group">
                  <label>대체 텍스트 (한국어)</label>
                  <input
                    type="text"
                    value={editAltKo}
                    onChange={(e) => setEditAltKo(e.target.value)}
                    placeholder="이미지 설명 (한국어)"
                  />
                </div>

                <div className="form-group">
                  <label>대체 텍스트 (English)</label>
                  <input
                    type="text"
                    value={editAltEn}
                    onChange={(e) => setEditAltEn(e.target.value)}
                    placeholder="Image description (English)"
                  />
                </div>
              </div>
            </div>

            <div className="image-object-modal-footer">
              <button onClick={() => setShowModal(false)}>취소</button>
              <button onClick={handleSaveAlt} disabled={!imageData}>
                저장
              </button>
            </div>

            {uploading && (
              <div className="image-object-uploading">
                <span>업로드 중...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

### CSS 스타일

**app/globals.css에 추가**
```css
/* ImageObject 스타일 */
.image-object-container {
  position: relative;
  display: inline-block;
}

.image-object-container.editable {
  cursor: pointer;
}

.image-object-container.editable:hover .image-object-edit-overlay {
  opacity: 1;
}

.image-object-edit-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-object-edit-overlay span {
  color: white;
  font-size: 14px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.image-object-loading {
  background: #f0f0f0;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 모달 스타일 */
.image-object-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.image-object-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.image-object-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.image-object-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.image-object-modal-header button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.image-object-modal-body {
  padding: 20px;
}

.image-object-preview {
  width: 100%;
  height: 200px;
  background: #f5f5f5;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  overflow: hidden;
}

.image-object-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-object-no-image {
  color: #999;
}

.image-object-form .form-group {
  margin-bottom: 16px;
}

.image-object-form label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.image-object-form input[type="text"],
.image-object-form input[type="file"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.image-object-form input:disabled {
  background: #f5f5f5;
  color: #999;
}

.image-object-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.image-object-modal-footer button {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.image-object-modal-footer button:first-child {
  background: #f5f5f5;
  border: 1px solid #ddd;
  color: #666;
}

.image-object-modal-footer button:last-child {
  background: #c4302b;
  border: none;
  color: white;
}

.image-object-modal-footer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-object-uploading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-object-uploading span {
  font-size: 16px;
  color: #333;
}
```

---

## 사용 예시

### 1. 기본 이미지 표시

```tsx
import ImageObject from '@/components/common/ImageObject';

// 고정 크기 이미지
<ImageObject keycode="hero.main" width={800} height={600} />

// fill 모드 (부모 컨테이너 크기에 맞춤)
<div style={{ position: 'relative', width: '100%', height: '400px' }}>
  <ImageObject keycode="about.banner" fill sizes="100vw" />
</div>

// 우선 로드
<ImageObject keycode="hero.main" priority />
```

### 2. Fallback 이미지 설정

```tsx
<ImageObject
  keycode="team.member1"
  width={300}
  height={300}
  fallbackSrc="/assets/images/default-avatar.png"
/>
```

### 3. 조건부 편집 권한

```tsx
// 관리자만 편집 가능
<ImageObject
  keycode="hero.background"
  fill
  isLogin={user?.role === 'admin'}
/>

// 편집 비활성화
<ImageObject
  keycode="logo.main"
  width={200}
  height={60}
  isLogin={false}
/>
```

### 4. 반응형 이미지

```tsx
<ImageObject
  keycode="gallery.image1"
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  className="gallery-image"
/>
```

### 5. 여러 이미지 관리

```tsx
function GallerySection() {
  const images = ['gallery.1', 'gallery.2', 'gallery.3', 'gallery.4'];

  return (
    <div className="gallery-grid">
      {images.map((keycode) => (
        <ImageObject
          key={keycode}
          keycode={keycode}
          width={400}
          height={300}
          className="gallery-item"
        />
      ))}
    </div>
  );
}
```

---

## 마이그레이션 체크리스트

### 프론트엔드

- [ ] `@aws-sdk/client-s3` 패키지 설치
- [ ] R2 환경 변수 설정 (`.env.local`)
- [ ] `lib/r2/` 디렉토리 생성 및 유틸리티 구현
- [ ] `components/common/ImageObject.tsx` 생성
- [ ] `BuilderContext` 설정 (Edit Mode 관리)
- [ ] CSS 스타일 추가
- [ ] `next.config.ts`에 R2 도메인 추가

### next.config.ts 설정

```typescript
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-xxxxx.r2.dev', // R2 Public URL
      },
    ],
  },
};
```

### 백엔드

- [ ] `images` 테이블 생성
- [ ] `POST /api/upload` API 구현
- [ ] `GET/POST/DELETE /api/images` API 구현

### Cloudflare 설정

- [ ] R2 버킷 생성
- [ ] Public 접근 활성화
- [ ] CORS 설정 (필요시)

---

## 주의사항

1. **파일 크기 제한**: 기본 10MB로 제한. 필요시 API에서 조정 가능

2. **이미지 최적화**: Next.js Image 컴포넌트가 자동으로 최적화하지만, 원본 이미지 크기가 너무 크면 업로드 전 리사이징 권장

3. **캐싱**: R2 Public URL은 Cloudflare CDN을 통해 캐싱됨. 이미지 업데이트 시 캐시 무효화가 필요할 수 있음

4. **보안**: 업로드 API는 반드시 인증 체크 필요. 악성 파일 업로드 방지를 위해 Content-Type 검증 필수

5. **비용**: R2는 Egress 비용이 무료이나, 저장 용량과 요청 수에 따라 비용 발생. 불필요한 이미지는 정기적으로 정리 권장

---

## 참고 자료

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Next.js Image Component](https://nextjs.org/docs/app/api-reference/components/image)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
