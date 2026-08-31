# 공연 자료함 — 번호 하나로 여는 현장 자료실 · 설계

*작성: 2026-08-31*

## 1. 무엇을 만드는가

공연장에 음원을 들고 가는 방식을 바꾼다. 지금은 USB에 담아 현장 컴퓨터에 꽂고
세팅한다. 앞으로는 운영진이 미리 관리 콘솔에 올려 두고, 현장에서는 **번호 하나**로
연다.

```
운영진(admin)                          공연장 현장
────────────                          ──────────
/admin/resources                      ktdoc.org/473128
  자료함 만들기                          ↓
  → 번호 자동 발급 (6자리)               숫자 키패드 (● ● ● ●)
  → 비밀번호 설정 (숫자 4~8)              ↓ 맞으면
  → 파일 올리기 (브라우저→R2 직행)        자료함 쿠키 6시간
  → QR 뽑기 / 인쇄                       ↓
                                       ▶ 재생  ⬇ 받기  ✉ 메일로 링크
                                          ↑
                            파일은 서버가 중계 (R2 주소 절대 비노출)
```

번호만 기억하면 아무 브라우저에서나 열 수 있고, QR을 폰에 담아 가면 스캔으로
연다. 현장 담당자에게 넘겨야 하면 이메일로 **받기 링크**를 보낸다.

'음악'이 아니라 '자료함'인 이유는, 나중에 영상·큐시트·동선도(圖)처럼 다른 것이
같은 자리에 들어올 것이기 때문이다. 지금 받는 것은 음원·PDF·이미지다.

### 왜 지금 있는 것으로는 안 되는가

| 있는 것 | 왜 못 쓰나 |
|---|---|
| 사진 보관함(`gallery_photos`) | 공개 열람이 전제다. 저작권 음원을 둘 자리가 아니다 |
| 신청서 QR(`ShareQrCard`) | 컴포넌트는 그대로 재사용한다. 가리킬 대상이 없을 뿐 |
| 회원 로그인 | 현장 담당자는 우리 회원이 아니다. 계정을 만들게 할 수 없다 |

## 2. 확정된 결정 (사용자, 2026-08-31)

| | 결정 | 근거 |
|---|---|---|
| 번호 단위 | **자료함 묶음.** 번호 1개 = 자료 여러 개, 순서대로 | 공연 하나에 곡이 여럿이다. 번호·QR을 곡마다 들고 다닐 수 없다 |
| 비밀번호 | **항상 필수** | 저작권 자료다. 6자리 번호는 10만 가지라 그 자체로 비밀이 못 된다 |
| 파일 범위 | 음원·PDF·이미지, 한 건 **100MB**까지 | 고음질 WAV까지 든다. 영상은 열지 않는다(수백 MB는 중계 방식이 다른 문제) |
| 이메일 | **받기 링크만.** 첨부하지 않는다 | 첨부는 15MB 벽이 있다. 링크는 용량 무관이고 추적·무효화가 된다 |
| 주소 | **`ktdoc.org/473128`** (루트) | 부르기 쉬워야 현장에서 쓰인다 |
| 서빙 | **서버 중계 (접근안 A)** | R2 키를 절대 내보내지 않는다. 아래 §3 |

## 3. 가장 중요한 제약 — 우리 버킷은 공개다

`R2_PUBLIC_URL`은 `https://pub-….r2.dev`다. **버킷 전체가 공개로 열려 있고,
키를 아는 사람은 영구히 받을 수 있다.** 비밀번호를 아무리 잘 걸어도, 파일
주소가 한 번 새면 그것으로 끝이다.

따라서 자료함 파일은:

1. **R2 키를 클라이언트에 절대 내보내지 않는다.** API 응답에 `r2_key`가 들어가는
   자리가 하나도 없어야 한다.
2. 재생·다운로드는 **우리 라우트가 중계**한다. 서버가 자격증명으로 R2에서 읽어
   흘려보낸다.
3. 서명된 R2 주소(presigned GET)도 쓰지 않는다 — **서명 주소 안에 키가 들어 있어서**,
   한 번 캡처하면 공개 주소로 조립해 영구 접근이 된다. 서명의 만료가 아무 소용이 없다.

남는 위험과 그 크기:

- **업로드하는 운영진의 브라우저는 키를 본다** (서명된 PUT 주소에 들어 있다).
  저작권자 측 직원이므로 받아들인다.
- **D1이 유출되면 `r2_key`가 함께 나가고, 공개 버킷에서 바로 받을 수 있다.**
  이것이 아래 비밀번호 저장 방식의 근거가 된다(§6).

버킷을 비공개로 돌리는 것이 근본 해결이지만, 사이트 전체의 이미지 서빙이 그 공개
주소에 매여 있어 이 작업의 범위가 아니다. **별도 과제로 남긴다.**

## 4. 데이터 모델

`migrations/0042_resources.sql`

### `resource_vaults` — 자료함

| 컬럼 | 형 | 설명 |
|---|---|---|
| `id` | INTEGER PK | |
| `code` | TEXT UNIQUE NOT NULL | 6자리 숫자 문자열. 앞자리 0 없음 |
| `title` | TEXT NOT NULL | 「2026 가을 공연 음원」 |
| `note` | TEXT | 현장 안내 메모. 잠금 해제 후 표시 |
| `passcode_enc` | TEXT NOT NULL | AES-256-GCM 암호문 (§6) |
| `event_id` | INTEGER | 공연 연결(선택). `events.id` |
| `allow_download` | INTEGER NOT NULL DEFAULT 1 | 0이면 재생만 |
| `allow_email` | INTEGER NOT NULL DEFAULT 1 | 0이면 메일 보내기 숨김 |
| `active` | INTEGER NOT NULL DEFAULT 1 | 끄면 번호가 즉시 죽는다 |
| `expires_at` | TEXT | NULL이면 만료 없음 |
| `link_epoch` | INTEGER NOT NULL DEFAULT 1 | 올리면 이미 나간 받기 링크가 전부 죽는다 |
| `created_by` | TEXT | `users.id` |
| `created_at` / `updated_at` | TEXT | |

### `resource_items` — 자료함 안의 파일

| 컬럼 | 형 | 설명 |
|---|---|---|
| `id` | INTEGER PK | |
| `vault_id` | INTEGER NOT NULL | FK → `resource_vaults(id)` ON DELETE CASCADE |
| `title` | TEXT NOT NULL | 표시 이름(「부채춤 반주」). 파일명과 별개 |
| `r2_key` | TEXT NOT NULL | **응답에 절대 실리지 않는다** |
| `file_name` | TEXT NOT NULL | 내려받을 때 쓰는 원본 이름 |
| `content_type` | TEXT NOT NULL | |
| `size_bytes` | INTEGER NOT NULL | 실측값(마무리 단계에서 확인한 값) |
| `duration_seconds` | INTEGER | 음원 길이. 올릴 때 브라우저가 읽어 보낸다(**표시 전용** — 클라이언트가 준 값이라 아무것도 이 값으로 판정하지 않는다). 모르면 NULL |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | 공연 순서 |
| `created_at` | TEXT | |

인덱스: `(vault_id, sort_order)`

### `resource_access_log` — 언제 누구에게 나갔나

| 컬럼 | 형 | 설명 |
|---|---|---|
| `id` | INTEGER PK | |
| `vault_id` | INTEGER | 없는 번호로 두드린 경우 NULL |
| `code` | TEXT | 두드린 번호 그대로 |
| `action` | TEXT NOT NULL | `unlock` \| `unlock_fail` \| `link_open` \| `play` \| `download` \| `email_sent` |
| `item_id` | INTEGER | 파일 단위 동작일 때 |
| `ip_hash` | TEXT | 원문 IP가 아니라 해시(`AUTH_SECRET` 키). 개인정보 최소화 |
| `user_agent` | TEXT | |
| `detail` | TEXT | 보낸 메일 주소 등 |
| `created_at` | TEXT NOT NULL | |

인덱스: `(code, created_at)` — 무차별 대입 판정이 이 축으로 센다.

**이 표를 두는 이유는 저작권이다.** 자료가 새어 나갔을 때 "언제 누구에게 나갔는지"를
말할 수 없으면 아무것도 할 수 없다. 그래서 성공만이 아니라 **실패도 남긴다.**

## 5. 모듈 경계

| 파일 | 하는 일 | 시험 |
|---|---|---|
| `lib/resources/code.ts` | 번호 발급·검증. 6자리, 숫자만, 앞자리 0 아님, 중복 회피 | ✅ 순수 |
| `lib/resources/passcode.ts` | 비밀번호 암·복호(AES-256-GCM), 형식 검증(4~8자리 숫자) | ✅ 순수 |
| `lib/resources/accessToken.ts` | 메일 받기 링크 토큰 서명·검증. `uploadTicket.ts`와 같은 관용구 | ✅ 순수 |
| `lib/resources/gate.ts` | **"이 요청이 이 자료함을 열어도 되는가"의 단 하나의 판정자** | ✅ 순수 |
| `lib/resources/rateLimit.ts` | 무차별 대입 차단 판정 | ✅ 순수 |
| `lib/resources/stream.ts` | R2에서 `Range`를 넘겨 206으로 흘려보내기 | server-only |
| `lib/d1/resources.ts` | 조회·저장 | |

`gate.ts`를 따로 세우는 이유는 신청서에서 겪은 것과 같다 — 같은 판정이 화면과
서버 두 곳에 흩어지면 어긋나고, **어긋난 쪽은 늘 열려 있는 쪽이다.** 쿠키·메일
토큰·만료·비활성·다운로드 허용을 전부 이 함수 하나가 본다. 라우트는 결과만 받는다.

```ts
// lib/resources/gate.ts
export type GateVerdict =
  | { ok: true; vaultId: number; via: 'cookie' | 'link' }
  | { ok: false; reason: 'locked' | 'expired' | 'inactive' | 'not_found' | 'download_denied' };
```

## 6. 비밀번호를 해시가 아니라 가역 암호로 두는 이유

정석은 bcrypt 해시다. 여기서는 **AES-256-GCM 가역 암호화**(키는 `AUTH_SECRET`에서
HKDF로 유도)를 쓰고, 관리 상세 화면에서 "보기"를 눌러야 드러나게 한다.

근거:

1. **이건 계정 암호가 아니라 남에게 알려주려고 만든 출입 번호다.** 원장이 나중에
   "그 자료함 번호 뭐였지"를 다시 확인하는 것이 정상 업무다.
2. 해시로 두면 잊을 때마다 재설정해야 하고, **그 순간 이미 알려준 현장 담당자들이
   전부 막힌다.** 공연 당일에 이 일이 벌어지면 시스템 자체가 버려진다.
3. **보안이 실질적으로 나빠지지 않는다.** D1이 유출되는 시나리오에서는 `r2_key`도
   함께 나가고, 우리 버킷은 공개라 그 키만으로 파일을 받을 수 있다(§3). 비밀번호만
   해시로 지켜 봐야 지키는 것이 없다.

대신:

- 생성·수정 화면에 **"계정 비밀번호와 다른 번호를 쓰세요"** 를 적는다.
- 6자리 무작위 번호 **생성 버튼**을 기본 동선으로 둔다(직접 입력보다 앞에).
- 비밀번호를 "보기"로 드러낸 것도 접근 기록에 남긴다.

`AUTH_SECRET`이 바뀌면 기존 비밀번호를 복호할 수 없다. 그때는 재설정이 답이고,
복호 실패는 **조용히 통과시키지 않고** 관리 화면에 "다시 설정해 주세요"로 드러낸다.

## 7. 공개 화면

### 라우팅

`app/[code]/page.tsx` — 루트 동적 세그먼트.

- `/^[1-9]\d{5}$/` 가 아니면 즉시 `notFound()`. 기존 정적 라우트가 항상 우선하므로
  `/about`·`/gallery` 등은 영향이 없고, 오타 주소도 지금과 똑같이 404다.
- `export const dynamic = 'force-dynamic'` — 잠금 상태가 요청마다 다르다.
- 메일 링크로 들어오면 `?k=<토큰>`이 붙는다. 토큰이 유효하면 쿠키를 굽고
  **주소에서 토큰을 지운 곳으로 리다이렉트**한다(브라우저 기록·어깨너머 노출 방지).

### 잠긴 화면 — `components/resources/ResourceLockScreen.tsx`

- **자료함 제목을 보여주지 않는다.** 번호만 우연히 맞춘 사람에게 "여기 뭐가 있다"를
  알릴 이유가 없다.
- 숫자 키패드: 터치 타깃 64px 이상, 1~9·0·⌫·확인. 무대 뒤 어두운 곳에서 태블릿으로
  누르는 상황을 상정한다.
- 물리 키보드도 함께 받는다(`inputMode="numeric"` + keydown) — 노트북으로 들어오는 경우.
- 입력은 누른 자릿수만큼 `●`로만 표시한다(비밀번호가 4~8자리라 칸 수를 미리 그리지
  않는다 — 빈 칸 개수가 길이를 알려주면 안 된다).
- 틀리면 흔들림 + 「다시 확인해 주세요」. **남은 시도 횟수는 알려주지 않는다** —
  공격자에게 주는 힌트다.

### 열린 화면 — `components/resources/ResourceVaultView.tsx`

- 제목 · 현장 안내 메모 · 목록(순서 · 이름 · 길이 · 용량)
- 각 항목에 큰 ▶ 버튼. **한 번에 한 곡만** 재생(다른 곡을 누르면 이전 곡 정지)
- 플레이어는 브라우저 기본 `<audio controls>` 위에 큰 재생 버튼을 얹는다 —
  공연장에서는 예쁨보다 **안 깨지는 것**이 우선이다
- `allow_download`가 켜져 있을 때만 ⬇, `allow_email`이 켜져 있을 때만 ✉
- 공개 사이트 테마 규칙을 따른다: 역할 토큰, 두 테마 확인, `npm run lint:theme`.
  히어로가 아닌 유틸리티 페이지이므로 `--page-offset-tight`, 다크 섬 등록 불필요.
- 문구는 `useT(키, '한국어 기본값')`.

### API

| 라우트 | 하는 일 |
|---|---|
| `POST /api/resources/[code]/unlock` | 비밀번호 대조 → 자료함 한정 서명 쿠키. 실패 시 지연 + 기록 |
| `GET /api/resources/[code]/items/[id]/stream` | gate 통과 → R2 Range 중계(206). `Content-Disposition: inline` |
| `GET /api/resources/[code]/items/[id]/download` | gate + `allow_download` → `attachment` |
| `POST /api/resources/[code]/email` | gate + `allow_email` → 24시간 링크 발송. 파일은 붙이지 않는다 |

쿠키: 이름 `rv_<vaultId>`, 값은 HMAC 서명(자료함 id + 만료), `HttpOnly` · `Secure` ·
`SameSite=Lax` · 6시간. 자료함마다 별개라 **하나를 풀어도 다른 자료함은 열리지 않는다.**

### 무차별 대입 방어 — `lib/resources/rateLimit.ts`

`resource_access_log`의 `unlock_fail`을 세어 판정한다.

- 같은 (번호, IP 해시)가 10분 내 **10회** 실패 → 그 IP를 10분 차단
- 한 번호에 10분 내 **60회** 실패 → 그 자료함을 5분 잠금 (여러 IP를 동원한 훑기 대비)
- 실패 응답에는 항상 최소 400ms 지연을 준다(타이밍으로 존재 여부를 재지 못하게)
- 관리 목록에 실패가 몰린 자료함을 경고 뱃지로 드러낸다

번호가 없는 경우와 비밀번호가 틀린 경우는 화면이 다르다(없으면 404). 비밀번호가
필수이므로 존재 여부가 새는 것 자체는 위험이 아니고, 없는 번호에 키패드를 띄우면
현장에서 오타를 오래 헤매게 된다.

## 8. 관리 화면

### 메뉴

```ts
{ key: 'resources', href: '/admin/resources', label: '공연 자료함',
  iconKey: 'vault', group: 'show', defaultRoles: ['admin'] }
```

- **자료실 그룹이 아니라 공연·참여 그룹**에 둔다. 콘텐츠 관리가 아니라 공연 운영 도구다.
- `types/permissions.ts`의 `MenuKey` 유니온에 `'resources'` 추가.
- `lib/admin/menu-icons.tsx`에 `vault`(번호 자물쇠) 아이콘 추가 — 기존 16개에 맞는 것이 없다.
- `locale/ko.json`·`en.json`에 `admin.nav.resources` 추가.
- 페이지는 `requireMenuAccess('resources')`, **API 라우트 첫 줄도 같은 판정.**
  학내 행사 때 겪은 "메뉴만 열고 API가 막는" 사고를 반복하지 않는다.

### `/admin/resources` — 목록

번호(크게) · 제목 · 파일 수 · 총 용량 · 연결된 공연 · 상태(활성/비활성/만료) ·
마지막 열람. 최근 실패가 몰린 자료함에 경고 뱃지.

### `/admin/resources/[id]` — 자료함 상세

- 상단: 번호를 크게 + 복사 버튼, 그 옆에 `ShareQrCard`(기존 컴포넌트, `path="/473128"`)
- 비밀번호: "보기"를 눌러야 드러남 + 6자리 생성 버튼
- 파일 목록: 드래그로 순서 변경, 표시 이름 편집, 삭제
- 파일 올리기: `lib/uploadClient.ts` 그대로 통과(열 번째 사용처)
- 설정: 다운로드 허용 · 메일 허용 · 활성 · 만료일 · 공연 연결
- **받기 링크 모두 무효화** 버튼(`link_epoch` +1)
- 접근 기록 탭

### 업로드 정책

`lib/r2/uploadPolicy.ts`에 규칙 추가:

```ts
{
  key: 'resource-items',
  match: /^\/api\/admin\/resources\/(\d+)\/items$/,
  folder: (m) => `resources/${m[1]}`,
  processImage: false,
  imagesOnly: false,
  keepOriginal: false,
  maxBytes: 100 * 1024 * 1024,
  allowedTypePrefixes: ['audio/', 'image/', 'application/pdf'],
}
```

`allowedTypePrefixes`는 **새 필드**다. 지금 정책은 "이미지만 / 아무거나" 두 갈래뿐인데,
메일 첨부는 아무거나 받아도 되지만 자료함은 음원·PDF·이미지만 받아야 한다. 순수
함수라 `uploadPolicy.test.ts`가 그대로 잠근다. 기존 규칙은 이 필드가 없으므로
`undefined = 제한 없음`으로 동작이 변하지 않는다.

`lib/r2/uploadTargets.ts`에도 권한 판정(admin) 한 줄을 짝지어 추가한다 —
**그 라우트의 첫 줄과 같은 함수를 쓴다.**

## 9. 테스트

| 파일 | 무엇을 잠그나 |
|---|---|
| `lib/resources/code.test.ts` | 6자리·숫자만·앞자리 0 배제·정적 라우트와 비충돌 |
| `lib/resources/passcode.test.ts` | 암·복호 왕복, 형식 검증, 변조된 암호문 거부 |
| `lib/resources/accessToken.test.ts` | 서명·만료·epoch 무효화·변조 거부 |
| `lib/resources/gate.test.ts` | 만료·비활성·다운로드 금지·토큰 만료 조합 |
| `lib/resources/rateLimit.test.ts` | 차단 경계(9회 통과 / 10회 차단), 시간 창 |
| `lib/r2/uploadPolicy.test.ts` | resource-items 규칙, 허용 형식, 100MB |

손으로 확인:

1. 실제 mp3 올리기 → 폰으로 QR 스캔 → 키패드 → 재생 → **구간 이동(시크)**
2. 다운로드 → 파일명이 원본 이름인지
3. 메일 받기 링크 → 다른 기기에서 비밀번호 없이 열리는지
4. "모두 무효화" 후 그 링크가 죽는지
5. 비밀번호 10회 틀리기 → 차단되는지
6. 두 테마 모두 확인

완료 전: `npm test` · `npx tsc --noEmit` · `npm run lint:theme` · `npm run lint:i18n`

## 10. 지금 하지 않는 것

| | 왜 |
|---|---|
| 전체 zip 다운로드 | 수백 MB를 함수에서 묶어 흘리는 것은 별개 문제다. 파일별 다운로드로 충분한지 먼저 본다 |
| 영상 | 용량이 한 자릿수 달라 중계 방식과 비용을 다시 봐야 한다 |
| 자료함 안 폴더·중첩 | 공연 하나에 곡 몇 개다. 평평한 목록으로 충분하다 |
| 회원 로그인 연동 | 현장 담당자는 회원이 아니다. 번호+비밀번호가 이 시스템의 전부다 |
| 버킷 비공개 전환 | 사이트 전체 이미지 서빙이 공개 주소에 매여 있다. 별도 과제(§3) |

## 11. 배포 순서

1. `npm run d1:migrate` — 0042 원격 적용
2. 코드 배포
3. 원장과 함께 자료함 하나를 실제로 만들어 공연장에서 한 번 열어 본다
