# 이미지 업로드 최적화·비용 전략

> 2026-07-09 전문가 팀 회의 결과. 참여: 클라우드 비용 전문가, 이미지 파이프라인 전문가,
> 코드베이스 분석가, 장기 운영·아카이브 전문가 + 레드팀 교차 검증.
> 가격·한도는 모두 2026-07-09 시점 공식 문서 기준.

## TL;DR — 채택 결정

| 항목 | 결정 |
|---|---|
| 저장 마스터 | 장변 **2560px** 캡, **WebP q80** (서버 sharp 최종 인코딩) |
| 썸네일 | 장변 **640px**, WebP q75 — 업로드 시 동시 생성 |
| 처리 위치 | **하이브리드**: 클라이언트 프리스케일(2560px JPEG q0.9) + 서버 sharp 최종 정규화 |
| EXIF | 서버에서 방향 굽기 + GPS 포함 전체 스트립 (**방어선은 반드시 서버**) |
| 표시 | 사전 변형 = R2 커스텀 도메인 직접 서빙 / 소수 UI 이미지만 next/image |
| 원본 보존 | 1단계에서는 미보존(2560px가 보험). 이벤트 갤러리 한정 보존은 2단계 옵션 |
| Cloudflare Images 전환 | **기각** — R2+사전 리사이즈 대비 20배 비쌈 |
| 기대 비용 | 5년차 기준 월 **$1~4** (현행 구조 방치 시 월 $6~9 + 증가) |

**주의: 아래 "실행 순서" 5단계는 순서를 바꾸면 안 된다** (immutable 캐시와 제자리
덮어쓰기 마이그레이션이 충돌한다).

---

## 1. 전제 바로잡기: D1이 아니라 R2가 비용의 본체

이미지 바이트는 **Cloudflare R2**(오브젝트 스토리지)에 저장되고, D1에는 URL·키·메타데이터
문자열만 들어간다. D1 요금에 사진 용량은 영향이 없다. 따라서 전략의 대상은:

1. **R2 스토리지** — $0.015/GB-월 (Standard), 무료 티어 10GB
2. **Vercel 이미지 최적화** — next/image 변환 과금 (transformation $0.05/1K 등)
3. **업로드 대역폭·함수 실행시간** — Vercel Functions

R2의 결정적 장점: **이그레스(다운로드 전송) 완전 무료**. 이 특성 때문에 "사전에 변형을
만들어 R2에서 직접 서빙"이 모든 대안(Cloudflare Images, Vercel 최적화 전면 의존)을
비용에서 이긴다.

## 2. 현황 진단 — 회의에서 발견된 실제 문제 6건

전부 실코드 근거 있음. 최적화 이전에 이미 **동작하지 않거나 위험한** 지점들:

| # | 문제 | 근거 |
|---|---|---|
| 1 | **4.5MB 초과 업로드는 이미 실패 중일 가능성이 높음.** Vercel 함수 요청 바디 한도가 4.5MB라 코드의 "10MB 허용"은 도달 불가. 413 대응 에러 메시지가 이미 하드코딩돼 있음(겪었다는 정황) | `components/admin/gallery/ImageUploader.tsx:58-66` |
| 2 | **벌크 라우트 4곳은 파일 크기 검증이 아예 없음** (이벤트 갤러리·보관함·수업·학생 제출 — 사진이 가장 많이 몰리는 곳) | `app/api/library/photos/route.ts` 외 |
| 3 | **HEIC를 '몰래' 수용 중.** 벌크 4곳은 `image/*` 프리픽스 검사만 해서 아이폰 HEIC가 통과, `application/octet-stream`으로 저장됨 → 브라우저 표시 실패 가능. 단일 라우트 4곳은 거부 → 정책 비대칭 | `app/api/admin/gallery/photos/route.ts:81-95`, `lib/r2/upload.ts:62-73` |
| 4 | **EXIF GPS가 그대로 공개 저장 중.** 기존 업로드분에 촬영 위치(학생·교사 자택 등)가 잔존 — 개인정보 이슈 | `lib/r2/upload.ts` (무가공 PutObject) |
| 5 | **r2.dev URL은 개발 전용.** Cloudflare가 공식적으로 rate-limit 걸린 비프로덕션 용도로 규정 — 공연 직후 트래픽 집중 시 이미지 로드 실패 위험, 캐시 제어도 불가 | [public-buckets 문서](https://developers.cloudflare.com/r2/buckets/public-buckets/) |
| 6 | **SVG stored-XSS 경로.** supplies 라우트가 SVG를 허용하고 원문 그대로 서빙 — 커스텀 도메인 직접 서빙 전환 시 해당 오리진에서 스크립트 실행 가능 (현재 업로더가 teacher+admin이라 위험도는 낮음) | `app/api/admin/supplies/upload/route.ts:13` |

## 3. 채택 아키텍처

### 3-1. 업로드: 하이브리드 파이프라인 (인코딩 세대 최대 2회)

레드팀 판정: 클라이언트 전용(서버 sharp 없음)은 **GPS 스트리핑이 신뢰 경계 밖**에 놓여
구조적 결함 — 리사이즈된 GPS 포함 JPEG를 API에 직접 POST하면 모든 검증을 통과한다.
서버 전용은 4.5MB 바디 한도 때문에 원본이 서버에 도달조차 못 한다. 따라서 둘 다 필요:

```
[클라이언트] lib/uploadClient.ts (신설, 공통 유틸 1개)
  createImageBitmap(file, {imageOrientation:'from-image'})
    → OffscreenCanvas(웹워커)로 장변 2560px 다운스케일
    → canvas.toBlob('image/jpeg', 0.9)   ← 고품질 중간본 (세대 손실 최소화)
    → 요청당 2~3장 청크 분할 전송 (4.5MB 한도 대응)
  · HEIC: createImageBitmap 네이티브 디코딩 우선(아이폰 Safari 17+)
    실패 시에만 heic-to(wasm ~1.2MB) dynamic import 폴백
  · iOS의 accept 기반 자동 변환은 버전별 비일관 — 보조 수단으로만
  · 동시 인코딩 2장 제한 + n/m 진행률 UI + 실패 항목 개별 재시도

[서버] lib/r2/upload.ts — uploadToR2 앞단 processImage() 1곳 (8개 라우트 전체 커버)
  sharp(buffer, {limitInputPixels})      ← 픽셀 폭탄 DoS 방어
    → 디코딩 실패 시 거부 (매직 바이트 검증 겸함)
    → .rotate()                          ← EXIF 방향 픽셀에 굽기
    → resize 2560px (fit:'inside', withoutEnlargement — 재축소 없음)
    → 마스터: .webp({quality:80})        ← 최종 인코딩 (메타데이터 자동 스트립)
    → 썸네일: 장변 640px .webp({quality:75})
    → PutObject 2회, CacheControl: 'public, max-age=31536000, immutable'
    → {width, height, thumbKey} 반환     ← D1 컬럼 이미 존재, 값만 채우면 됨
```

클라이언트 출력이 JPEG인 이유: Safari의 `canvas.toBlob`은 WebP/AVIF 인코딩을 지원하지
않아 JPEG가 유일한 공통분모. 최종 저장 포맷은 서버가 인코딩하므로 WebP 선택 가능.

서버 검증 추가(벌크 4개 라우트 포함 전체):
- 파일별 **4MB** 상한 (4.5MB 바디 한도와 정합 — 기존 10MB는 죽은 검증)
- MIME **명시적 허용목록** (jpeg/png/webp — `image/*` 프리픽스 검사 폐지)
- **SVG 업로드 차단** (supplies 포함. 필요 시 sanitize + CSP sandbox 헤더로만 허용)

### 3-2. 파라미터 근거 (품질 vs 크기)

| 변형 | 크기 | 포맷·품질 | 예상 용량 | 근거 |
|---|---|---|---|---|
| 마스터 | 장변 2560px | WebP q80 | 평균 ~600KB (고엔트로피 무대 사진 상한 ~1MB) | QHD 라이트박스 1x 풀커버. 원본 미보존 전제의 보험 해상도. 무대 조명의 어두운 그라데이션은 q80 미만에서 밴딩 발생 — q80이 하한 |
| 썸네일 | 장변 640px | WebP q75 | 50~90KB | 그리드 셀 실측(25vw ≈ 300~350px) × 레티나 2x DPR 커버 최소치. 400px은 레티나 미달로 기각 |

한복 자수 같은 고주파 디테일은 품질값보다 **해상도(픽셀 수)가 지배적** — 픽셀을 확보하고
품질값으로 밴딩만 방어하는 구성. 사용자가 처음 제안한 "1500~2000px + q80"과 비교하면:
1500px는 레티나 노트북·QHD 라이트박스에서 소프트해져 기각, 2000px는 원본 보존 시에만
적정, **원본을 안 남기는 1단계에서는 2560px가 안전**하다.

효과: 첫 화면 그리드 20장 기준 마스터 직접 로드 ~16MB → 썸네일 ~1.5MB.
업로드 대역폭 장당 ~8MB → ~1MB (모바일에서 총 소요 시간도 오히려 단축).

### 3-3. 표시: "사전 변형 = 직접 서빙, 동적 UI = next/image" 이원 체제

레드팀 최종 판정 — 사전 생성 변형을 next/image에 다시 통과시키는 것은 **같은 일을 두 번
사고 두 번 지불하는 구조**다:

- 비용: 원본이 350KB든 5MB든 Vercel transformation 단가는 동일하게 발생. R2는 이그레스
  무료 + 엣지 캐시라 직접 서빙의 한계비용이 0.
- 품질: 서버 q80 인코딩본을 Vercel이 q75로 재인코딩하면 2~3세대 손실 누적 — 무대 조명
  그라데이션 밴딩이 악화된다.

| 이미지 | 서빙 방식 |
|---|---|
| 이벤트 갤러리·아카이브·학생 사진 그리드 (수백 장, 롱테일) | 640px 썸네일을 R2 커스텀 도메인에서 직접 (`unoptimized` 또는 plain `img` + width/height) |
| 라이트박스 확대 | 2560px 마스터 직접 서빙 |
| 히어로·뉴스 대표·프로필 등 소수 고노출 UI | next/image 유지 (srcset·AVIF 자동 변환의 실익이 있는 유일한 곳) |

next.config 설정: `images.minimumCacheTTL: 2678400`(31일 — 키가 timestamp+난수 불변이라
안전). Next 16 기본 4시간 TTL 방치 시 인기 이미지의 STALE 재변환 반복 과금이 발생한다
(레드팀 검증: "월 $86" 공포 시나리오는 비현실적이나, 월 수 달러대 낭비는 실제 — 설정
한 줄짜리 보험이므로 채택).

> **하드 게이트**: 직접 서빙 전환은 반드시 커스텀 도메인 + Cache Rule **완료 후**에만.
> rate-limit 걸린 r2.dev 상태에서 unoptimized로 바꾸면 Vercel 캐시라는 완충까지
> 제거되어 개악이다.

### 3-4. 원본 보존 정책

- **1단계: 미보존.** 2560px WebP q80이 기록·웹 용도를 커버 (300dpi 인쇄 기준 ~21cm).
- **2단계 옵션: 이벤트 갤러리 한정 보존.** 인화·보도자료 수요 대비. 원본은 4.5MB 한도
  때문에 Vercel 경유 불가 → presigned PUT 직접 업로드가 필요한데, 레드팀이 지적한 보안
  요건을 충족해야만 도입: 서버가 키를 지정한 짧은 만료 URL + 업로드 후 HeadObject로
  크기·타입 검증·위반 시 즉시 삭제하는 commit 단계, **관리자 전용 한정**. `originals/`
  프리픽스는 공개 URL 노출 금지(GPS 잔존), 관리자 전용 서명 URL로만 접근.
  30일 후 Infrequent Access 전환 lifecycle 규칙 적용($0.01/GB-월).

## 4. 비용 시나리오 (레드팀 보정치)

연 1만 장(이벤트당 100~200장), 5년 누적 5만 장 가정. 레드팀 보정: "현행 평균 5MB"는
4.5MB 바디 한도 때문에 애초 불성립 — 실유입 평균 ~2.5MB로 재계산.

| 시나리오 | 5년차 월 비용 | 비고 |
|---|---|---|
| A. 현상 유지 (원본 저장 + 전면 next/image, TTL 4h) | **$6~9 + 증가** | 게다가 4.5MB 초과 업로드 실패·GPS 노출 상태 그대로 |
| B. 권장안 (2560px/640px + 직접 서빙 + TTL 31일) | **$1~4** | 1년차는 무료 티어 근접 ~$0.7. 예산은 상한(고엔트로피 사진 ~600KB 평균)으로 편성 |
| B + 원본 IA 보존 | + $2~3 | 이벤트 갤러리 한정 시 |
| C. Cloudflare Images 풀 전환 | ~$9.50 (10만 장 기준) | **기각** — per-image 과금이 R2 무료 이그레스를 이길 수 없음 |

Vercel Pro($20/월) 필요 여부: 직접 서빙 전환 후 transformation이 월 수백~2K 수준으로
줄면 **Hobby 무료분(5K/월) 내 유지 가능** — 전환 후 실측으로 재판정하며, 이 전략의
필수 비용이 아니다.

## 5. 실행 순서 — 순서가 정답의 일부다

레드팀이 발견한 결합 허점: immutable 캐시 규칙을 먼저 깔고 제자리 덮어쓰기를 하면
**최대 1년간 구본이 서빙**된다. Vercel 이미지 캐시는 수동 무효화 수단이 없다.

1. **파이프라인 배포** — 서버 `processImage()`(lib/r2/upload.ts 앞단 1곳) + 클라이언트
   공통 유틸(lib/uploadClient.ts) + FormData 생성 9개 컴포넌트 교체 + 벌크 라우트 검증
   강화. D1 width/height는 값만 채우면 됨(컬럼·INSERT 경로 기존재).
2. **기존분 제자리 덮어쓰기 마이그레이션** — 캐시 규칙 도입 *전*이 유일한 안전 시점.
   일회성 로컬 스크립트(`scripts/reprocessR2Images.mjs`, WSL에서 sharp 제약 없음):
   D1 r2_key 주도 순회(전 테이블이 r2_key 보유, R2 List는 고아 검출용만) →
   `originals/{원키}`로 CopyObject 백업 **성공 확인 후** → sharp 재처리(동일 포맷 유지
   — 확장자·Content-Type·D1 URL 불변) → 같은 키에 덮어쓰기 + immutable 헤더 +
   `Metadata:{optimized:'1'}` 멱등 마커 → width/height 백필.
   gallery_photos↔event_images가 r2_key를 공유하므로 키 기준 dedupe 필수.
   예외: 프로필 사진은 MySQL에 URL만 있어 프리픽스 파싱으로 키 역산.
3. **커스텀 도메인 + Cache Rule** — 버킷에 `img.<도메인>` 연결, Cache Rule로
   "Eligible for cache + Edge TTL 1년". D1 `image_url` 일괄 치환
   (r2.dev → 새 도메인, 전 테이블 + MySQL 프로필), 잔존 r2.dev 패턴 전수 검색으로 검증.
   remotePatterns에 새 호스트 추가(r2.dev 과도기 병존).
4. **직접 서빙 전환** — 갤러리 그리드·라이트박스를 사전 변형 직접 서빙으로 교체.
5. **TTL 상향** — `minimumCacheTTL: 31일` 적용. Vercel Usage에서 transformation 실측
   → Pro 필요성 재판정.

## 6. 장기 운영

- **백업 (필수)**: R2에는 자동 복제 기능이 없고 이 버킷이 공연 기록물의 유일본.
  rclone 주 1회 `sync` → Backblaze B2($6/TB-월), `--backup-dir`로 삭제 전파 격리
  (랜섬·오조작 복구). 백업용 자격증명은 **Object Read 전용 토큰**으로 분리.
- **lifecycle**: `originals/` → 30일 후 IA 전환. 미완료 멀티파트 업로드 7일 후 중단
  규칙도 함께. **IA를 서빙 경로에 적용 금지**(회수비 + 무료 티어 상실).
- **고아 객체 GC**: 월 1회 — ListObjectsV2 전량 키 vs D1(+MySQL 프로필) 참조 차집합,
  LastModified 7일 이내 제외(업로드↔D1 기록 경합 보호), CSV 출력 → 육안 확인 →
  `--confirm` 플래그로만 삭제. 자동 삭제 금지. 변형(썸네일) 도입 후에는 삭제 경로
  3곳(events/programs images DELETE, profile)이 썸네일 키까지 지우도록 확장.
- **모니터링**: `package.json`에 `"r2:stats": "wrangler r2 bucket info <버킷>"` 추가.
  월 1회: ① r2:stats 증가량, ② Cloudflare 대시보드 Class A/B 그래프, ③ Vercel Usage
  Image Optimization 3지표(무료분 5K/300K/100K 대비 위치).

## 7. 기각된 대안 (근거 기록)

| 대안 | 기각 사유 |
|---|---|
| Cloudflare Images 풀 전환 | 10만 장 기준 ~$9.50/월 — per-image 저장·전송 과금이 R2 무료 이그레스 대비 20배 |
| 서버 전용 처리 (클라 무가공) | 원본이 4.5MB 바디 한도에 막혀 서버 도달 불가 |
| 클라이언트 전용 처리 (서버 sharp 없음) | GPS 스트리핑·검증이 신뢰 경계 밖 — 직접 API POST로 우회 가능 |
| 업로드 시점 AVIF 인코딩 | 클라 인코딩 장당 수 초 + Safari toBlob 미지원. AVIF는 next/image 경유 이미지에서만 자동 취득 |
| browser-image-compression 의존 | v2.0.2에서 12개월+ 릴리스 정체 — 자체 구현(~150줄) 권장 |
| iOS accept 자동 HEIC→JPEG 변환 의존 | Safari 버전별 비일관(Apple 포럼 버그 리포트) — 보조 수단으로 강등 |
| 전면 unoptimized | 히어로 등 레이아웃 가변 이미지는 next/image srcset 실익 있음 — 이원 체제가 유일한 무모순 조합 |

## 8. 미결 사항

- [ ] 원본 보존 범위 결정 (미보존 / 이벤트 갤러리 한정 / 전체) — 원장 인화·보도자료
      수요 확인 필요
- [ ] 커스텀 도메인 네이밍 (`img.<도메인>`) — 사이트 도메인 확정과 연동
- [ ] IA 클래스 연산 단가(Class A $9/백만 등)는 실행 전 공식 요금 문서 재확인
      (교차 검증 미완 수치)
- [ ] 기존 버킷의 HEIC(`application/octet-stream`) 객체 스캔 — 마이그레이션 스크립트에
      content-type 스캔 포함
