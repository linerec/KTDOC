# Cloudflare R2 이미지 서버 설정 가이드

이 문서는 Cloudflare R2를 이미지 저장소로 사용하는 방법에 대한 가이드입니다.

## 📋 목차

1. [개요](#개요)
2. [환경 설정](#환경-설정)
3. [API 사용법](#api-사용법)
4. [프론트엔드 사용법](#프론트엔드-사용법)
5. [보안 및 제한사항](#보안-및-제한사항)
6. [문제 해결](#문제-해결)

## 개요

### 왜 Cloudflare R2인가?

- **Egress 비용 무료**: S3와 달리 데이터 전송 비용이 없음
- **S3 호환**: 기존 S3 코드와 호환 가능
- **글로벌 CDN**: 전 세계 어디서나 빠른 이미지 로딩
- **저렴한 스토리지 비용**: 경쟁력 있는 가격

### 프로젝트 구조

```
src/
├── lib/r2/
│   ├── client.ts         # R2 클라이언트 설정
│   ├── upload.ts         # 업로드 유틸리티 함수
│   └── index.ts          # Export 정리
├── app/api/upload/
│   ├── route.ts          # 업로드 API
│   └── delete/
│       └── route.ts      # 삭제 API
└── components/admin/
    └── ImageUploader.tsx # 업로드 UI 컴포넌트
```

## 환경 설정

### 1. Cloudflare 계정 및 R2 버킷 생성

이미 완료되었습니다:
- 버킷 이름: `ljp-property-solution`
- Public URL: `https://pub-95f164367b15488d97f8eebd6163a068.r2.dev`

### 2. 환경 변수

`.env.local` 파일에 다음 변수가 설정되어 있습니다:

```env
# Cloudflare R2 Configuration
R2_ACCESS_KEY_ID=e327a4c8d7927ec29e94df0b9acb6241
R2_SECRET_ACCESS_KEY=fc1a0b1b01d2285818ca43965c83ba50ffe400641351b25434a696c06c32736b
R2_ENDPOINT=https://06f4a8c623e6f13bdcf161f10960da86.r2.cloudflarestorage.com
R2_BUCKET_NAME=ljp-property-solution
R2_PUBLIC_URL=https://pub-95f164367b15488d97f8eebd6163a068.r2.dev
```

### 3. 설치된 패키지

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## API 사용법

### 이미지 업로드 API

**Endpoint**: `POST /api/upload`

**인증**: 로그인한 사용자만 업로드 가능 (TODO: 관리자 권한 체크 추가 예정)

**Request**:
```typescript
const formData = new FormData()
formData.append('file', file)          // File 객체
formData.append('folder', 'properties') // 선택사항: 폴더 이름

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
})
```

**Response**:
```json
{
  "success": true,
  "data": {
    "key": "properties/1728848400000-image.jpg",
    "url": "https://pub-95f164367b15488d97f8eebd6163a068.r2.dev/properties/1728848400000-image.jpg",
    "size": 1024000,
    "contentType": "image/jpeg"
  }
}
```

**제한사항**:
- 최대 파일 크기: 10MB
- 지원 형식: JPEG, PNG, GIF, WebP

### 이미지 삭제 API

**Endpoint**: `DELETE /api/upload/delete`

**인증**: 로그인한 사용자만 삭제 가능

**Request**:
```typescript
const response = await fetch('/api/upload/delete', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    key: 'properties/1728848400000-image.jpg', // 삭제할 파일의 key
  }),
})
```

**Response**:
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

## 프론트엔드 사용법

### ImageUploader 컴포넌트

기본적인 이미지 업로드 UI 컴포넌트입니다.

```tsx
import ImageUploader from '@/components/admin/ImageUploader'

function MyPage() {
  const handleSuccess = (url: string, key: string) => {
    console.log('Uploaded:', url, key)
    // 업로드된 이미지 URL을 state에 저장하거나
    // 데이터베이스에 저장하는 로직 추가
  }

  const handleError = (error: string) => {
    console.error('Upload failed:', error)
  }

  return (
    <ImageUploader
      folder="properties"        // 이미지를 저장할 폴더
      onUploadSuccess={handleSuccess}
      onUploadError={handleError}
      maxSizeMB={10}            // 최대 파일 크기 (MB)
    />
  )
}
```

### R2 유틸리티 함수 직접 사용

서버 사이드에서 직접 R2 유틸리티를 사용할 수도 있습니다:

```typescript
import { uploadToR2, deleteFromR2, listFilesInR2 } from '@/lib/r2'

// 이미지 업로드
const buffer = Buffer.from(await file.arrayBuffer())
const result = await uploadToR2(buffer, 'my-image.jpg', 'properties')
console.log(result.url) // 업로드된 이미지 URL

// 이미지 삭제
await deleteFromR2('properties/1728848400000-image.jpg')

// 폴더 내 파일 목록
const files = await listFilesInR2('properties')
```

## 보안 및 제한사항

### 보안

1. **인증 체크**: 현재 로그인한 사용자만 업로드/삭제 가능
2. **파일 검증**:
   - 이미지 파일만 허용
   - 최대 크기 제한
   - Content-Type 검증

3. **TODO: 향후 추가할 보안 기능**
   - 관리자 권한 체크 (admin_users 테이블)
   - Rate limiting
   - 파일 스캔 (악성 코드)

### 제한사항

1. **파일 크기**: 최대 10MB (설정 가능)
2. **파일 형식**: JPEG, PNG, GIF, WebP만 허용
3. **동시 업로드**: API 타임아웃 60초
4. **버킷 스토리지**: 무제한 (Cloudflare R2 정책에 따름)

## 문제 해결

### 업로드가 실패하는 경우

1. **환경 변수 확인**:
   ```bash
   # .env.local 파일 확인
   echo $R2_ACCESS_KEY_ID
   echo $R2_SECRET_ACCESS_KEY
   echo $R2_ENDPOINT
   ```

2. **개발 서버 재시작**:
   ```bash
   # 환경 변수 변경 후 반드시 재시작
   npm run dev
   ```

3. **인증 확인**:
   - Supabase 로그인 상태 확인
   - 네트워크 탭에서 401/403 에러 확인

### 이미지가 로드되지 않는 경우

1. **Public 도메인 확인**:
   - URL이 `https://pub-95f164367b15488d97f8eebd6163a068.r2.dev`로 시작하는지 확인
   - 브라우저에서 직접 URL 접근해보기

2. **CORS 설정 확인**:
   - Cloudflare Dashboard > R2 > 버킷 > Settings > CORS

3. **파일 존재 확인**:
   ```typescript
   import { fileExistsInR2 } from '@/lib/r2'
   const exists = await fileExistsInR2('your-file-key')
   ```

### TypeScript 에러

```bash
# 타입 체크
npm run typecheck

# 주요 에러 확인
npm run typecheck 2>&1 | grep "src/app/api/upload\|src/lib/r2"
```

## 테스트 페이지

이미지 업로드를 테스트할 수 있는 페이지:

```
http://localhost:3001/en/admin/upload
http://localhost:3001/ko/admin/upload
```

## 다음 단계

1. **관리자 권한 시스템 구축**:
   - `admin_users` 테이블 생성
   - 역할 기반 접근 제어 (RBAC)

2. **이미지 최적화**:
   - Cloudflare Workers로 리사이징
   - WebP 자동 변환
   - Lazy loading

3. **데이터베이스 통합**:
   - Property에 이미지 URL 저장
   - 이미지 메타데이터 관리

4. **Custom Domain 설정**:
   - `images.ljppropertysolution.com` 같은 도메인 연결

## 참고 자료

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Next.js File Upload](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#formdata)
