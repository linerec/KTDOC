# 사이트 전역 이메일 발송 시스템 — 설계

*작성: 2026-08-17*

## 1. 무엇을 만드는가

사이트에서 일이 벌어지면(가입·수업 등록·공연 참가·신청서 제출 등) 관련된 사람에게
자동으로 이메일이 나가게 한다. 무엇을 누구에게 보낼지는 **관리 콘솔에서 원장이 켜고 끈다.**
발송 방법(Resend / SMTP)과 발신 정보도 화면에서 설정한다.

세 덩어리다:

1. **공용 발송 모듈** — 지금 세 곳에 흩어진 메일 코드를 하나로 걷어낸다
2. **관리 콘솔 `이메일 설정` 메뉴** — 발송 방법·발신 정보·이벤트 스위치·발송 내역
3. **이벤트 연결** — 각 기능에서 `notifyEvent()` 한 줄

### 지금 상태 (이관 대상)

| 위치 | 현재 방식 | 이관 후 |
|---|---|---|
| `lib/mail.ts` | Gmail SMTP 하드코딩, 환경변수 전용 | 삭제 → `lib/mail/mailer.ts` |
| `app/api/feedback/route.ts` | nodemailer 직접 생성 | `notifyEvent('feedback.created')` |
| `app/api/applications/route.ts` | nodemailer 직접 생성 | `notifyEvent('application.created')` |
| `app/api/cron/event-reminders/route.ts` | `lib/mail.ts` 사용 | `notifyEvent('event.reminder')` |

셋 다 각자 transport를 만들고 있고, 자격증명은 `GMAIL_USER`/`GMAIL_APP_PASSWORD`
환경변수에 묶여 있다. 앱 비밀번호는 만료되면 조용히 죽는다(실제로 겪었다) —
이 구조를 끊는 것이 이 작업의 출발점이다.

### 배포 환경 (작업량을 가르는 사실)

배포는 **Vercel(Node 런타임)** 이다(`vercel.json`의 cron, `next.config.ts`에 OpenNext 없음).
따라서 `docs/06-메일-발송-이식-가이드.md`의 **3-b절(Cloudflare Workers / worker-mailer
벤더 사본 / postinstall 스크립트)은 전부 불필요하다.** `nodemailer`는 이미 설치돼 있다.
`wrangler.toml`은 D1 접근용이지 앱 런타임이 아니다.

---

## 2. 확정된 결정

| 결정 | 선택 | 근거 |
|---|---|---|
| 채널 범위 | **이메일만 구현. 저장 구조에 채널 축은 미리 둔다** | 나중에 푸시 자동발송이 붙어도 저장본 마이그레이션·화면 재설계가 필요 없다. 지금 드는 비용은 JSON 키 한 겹 |
| 본문 | **코드 고정 + ko/en 번역** | 관리자 편집기는 미리보기·치환값 안내·2개 언어 관리가 따라붙는다. 문구가 깨질 위험이 크고 얻는 게 적다 |
| 운영진 수신 | **설정에 적은 지정 주소(복수)** | 역할 전원 발송은 선생님이 늘 때마다 무관한 메일이 쌓인다. 누가 받는지 화면에서 보이는 편이 낫다 |
| 회원 수신거부 | **개인 스위치 1개. 단 필수 메일은 예외** | 종류별 세분화는 회원이 설정할 게 많아진다. 스팸 신고와 민원을 동시에 막는 최소선 |

---

## 3. 아키텍처

```
[각 기능]  회원가입 · 수업등록 · 체크인 · 신청서 · 문의 …
     │
     │  notifyEvent('member.signup', { userId, ... })     ← 호출부는 이 한 줄만 안다
     ▼
[이벤트 레지스트리]  lib/mail/events.ts
     │   이 사건은 누구에게 알릴 수 있는가 / 끌 수 있는가 / 본문을 남겨도 되는가
     ▼
[수신자 결정]  lib/mail/recipients.ts        ← 순수 함수. 테스트로 고정
     │   관리자 설정 ∩ 개인 옵트아웃 ∩ 주소 유효성 → 최종 주소 목록
     ▼
[한도 판정]  lib/mail/quota.ts               ← 순수 함수. 테스트로 고정
     │   오늘/이번 달 발송 수 vs 한도 → 보낸다 / 막는다 / 필수라 통과시킨다
     ▼
[본문 조립]  lib/mail/templates/*            ← 이벤트별 제목·본문 (ko/en)
     ▼
[발송]  lib/mail/mailer.ts                   ← provider만 안다. 이벤트를 모른다
     │   Resend(HTTP) 또는 SMTP(nodemailer)
     ▼
[기록]  lib/d1/mailLog.ts                    ← 언제·무엇을·누구에게·성공/실패
```

**경계 원칙**: `mailer.ts`는 이벤트·회원·설정 스키마를 모른다. 주소와 본문을 받아 보낼 뿐이다.
`events.ts`는 발송 방법을 모른다. 이 분리를 지키면 provider를 바꿔도 이벤트 코드는
그대로고, 이벤트를 추가해도 발송 코드는 그대로다.

### 파일 구조

```
lib/mail/
  mailer.ts       발송 엔진 — resolveMailConfig() + sendMail(). 절대 throw 하지 않는다
  config.ts       설정 스키마·기본값·깊은 병합·공개뷰 마스킹
  events.ts       이벤트 레지스트리 (확장 지점)
  recipients.ts   수신자 결정 (순수)
  quota.ts        한도 판정 (순수)
  notify.ts       오케스트레이션 — notifyEvent()
  templates/
    index.ts      이벤트 → 템플릿 매핑
    member.ts / enrollment.ts / show.ts / form.ts / ops.ts
lib/d1/mailLog.ts 발송 로그 저장·조회·검색·집계

app/api/admin/mail/route.ts        GET/PUT 설정
app/api/admin/mail/test/route.ts   POST 테스트 발송
app/api/admin/mail/log/route.ts    GET 내역 검색
app/api/account/notifications/route.ts  PUT 개인 수신 설정

app/admin/mail/page.tsx            관리 화면 (탭 4개)
```

`lib/mail.ts`(현재 파일)는 삭제한다. 새 디렉터리 `lib/mail/`과 이름이 충돌하므로
이관과 삭제는 같은 커밋에서 이뤄져야 한다.

---

## 4. 이벤트 레지스트리 — 확장 지점

```ts
export interface MailEventDef {
  /** 관리 화면에 표시할 이름 */
  label: string
  /** 화면에서 묶을 그룹 */
  group: 'member' | 'lesson' | 'show' | 'ops'
  /** 이 사건에서 알릴 수 있는 대상 */
  audiences: readonly MailAudience[]     // 'user' | 'staff'
  /** 끌 수 없는 대상 — 스위치를 만들지 않는다 */
  essential?: readonly MailAudience[]
  /** 설정이 없을 때의 기본값 */
  defaultOn: Partial<Record<MailAudience, boolean>>
  /** true면 발송 내역에 본문을 저장하지 않는다 (민감정보 포함) */
  redactBody?: boolean
}
```

초기 등록 목록:

| 키 | 이름 | 회원 | 운영진 | 비고 |
|---|---|---|---|---|
| `member.signup` | 회원가입 | **필수** | 기본 ✓ | |
| `member.approved` | 가입 승인 | 기본 ✓ | — | |
| `member.temp_password` | 임시 비밀번호 발급 | **필수** | — | `redactBody` |
| `enrollment.created` | 수업 등록 | 기본 ✓ | 기본 ✓ | |
| `application.created` | 공연 참가 신청 | 기본 ✓ | 기본 ✓ | 기존 이관 |
| `checkin.created` | 공연 체크인 | 기본 ✗ | 기본 ✗ | 빈도가 높아 기본 꺼둠 |
| `form.submitted` | 신청서 제출 | 기본 ✓ | 기본 ✓ | |
| `feedback.created` | 문의 접수 | 기본 ✓ | 기본 ✓ | 기존 이관 |
| `event.reminder` | 공연 전날 안내 | 기본 ✓ | — | 기존 cron 이관 · 단체 발송 |

`문의 접수`의 `user`는 회원이 아니라 **문의를 남긴 사람**이다(비회원일 수 있다).
이 이벤트에 한해 주소는 문의 폼의 입력값에서 오고, 옵트아웃 관문(2)은 건너뛴다 —
끌 대상 계정이 없다.

**새 알림을 추가하는 절차 = 이 표에 1줄 + 템플릿 1개.** 관리 화면은 레지스트리를
순회해 그리므로 화면 코드를 건드리지 않는다. `lib/admin/menu-registry.ts`와
`lib/ai` 레지스트리가 이미 쓰는 관용구다.

### `member.temp_password`와 `redactBody`

비밀번호 찾기는 현재 **운영진 발급형 임시 비밀번호**다(`migrations/0030_password_reset.sql`,
`app/api/account/password/route.ts`). 발급 후 전달 수단이 없어 구두·메신저로 알려주고
있다 — 이 이벤트가 그 자리를 메운다.

임시 비밀번호가 본문에 들어가므로 **발송 내역에 본문을 저장하면 D1에 평문 비밀번호가
쌓인다.** `redactBody: true`인 이벤트는 제목·수신자·상태만 기록하고 본문 자리에는
`(민감정보 — 저장하지 않음)`을 남긴다. 이 플래그는 레지스트리에 있으므로, 앞으로
비슷한 성격의 이벤트를 추가할 때 판단할 자리가 이미 정해져 있다.

---

## 5. 설정 스키마

저장 위치는 D1 `site_settings` 테이블의 `mail.config` 키 하나(JSON 직렬화).
`lib/d1/settings.ts`의 기존 패턴을 그대로 따르므로 **새 설정 테이블은 만들지 않는다.**

```ts
export interface MailConfig {
  /** '' = 미설정(환경변수 폴백) */
  provider: '' | 'resend' | 'smtp'
  from: string          // 발신 주소 (도메인 인증 필요)
  fromName: string      // 받은편지함 표시 이름
  replyTo: string       // 답장 받을 주소 (인증 불필요)
  staffTo: string[]     // 운영진 알림 수신 주소들
  resendApiKey: string  // 시크릿
  smtp: SmtpConfig      // host/port/secure/username/password
  quota: {
    dailyLimit: number    // 기본 100  (Resend 무료)
    monthlyLimit: number  // 기본 3000 (Resend 무료)
    warnAtPercent: number // 기본 80
  }
  /** 이벤트 × 대상 × 채널 — 안쪽 한 겹이 "채널 자리" */
  events: Record<string, Partial<Record<MailAudience, { email: boolean }>>>
}
```

`events`의 값이 `{ email: true }`인 것이 결정 1의 실현이다. 푸시가 붙으면
`{ email: true, push: true }`가 되고, 기존 저장본은 깊은 병합으로 그대로 읽힌다.

읽을 때 항상 기본값과 **깊은 병합**한다 — 필드를 추가해도 옛 저장본이 깨지지 않는다.

### 시크릿 취급 (이식 가이드 4절)

- **GET 응답에 시크릿 원문을 절대 담지 않는다.** `resendApiKeySet: boolean`,
  `smtp.passwordSet: boolean`만 내려간다
- **PUT에서 빈 시크릿 = 기존 유지.** 화면이 저장된 키를 못 받으므로, 매번 재입력을
  요구하면 다른 칸을 고칠 때마다 키가 지워진다
- 그 대가로 **시크릿을 지우는 경로가 없다** → 명시적인 "키 삭제" 버튼을 따로 둔다
- 이메일 주소는 형식 검증 후 틀리면 **400으로 거절**한다. 조용히 버리면 운영자는
  저장됐다고 믿는다
- PUT은 **보낸 키만 반영**한다(부분 업데이트) — 탭별로 저장해도 다른 탭이 지워지지 않는다

---

## 6. 수신자 결정

`resolveRecipients()` — 순수 함수. 입력은 이벤트 정의·설정·회원 정보, 출력은 주소 목록.

### 대상 두 가지의 정의

| 대상 | 누구인가 | 주소 출처 |
|---|---|---|
| `user` | 이 사건의 당사자 회원 **+ 당사자가 원생이면 연결된 보호자 전원** | `users.email` + `student_guardians` 조인 |
| `staff` | 운영진 | 설정의 `staffTo` 배열 |

**`user`에 보호자가 포함되는 것이 이 설계의 명시적 결정이다.** 원생은 미성년이고
메일을 확인하지 않는 경우가 많다 — 수업 등록 확인이 원생에게만 가면 학부모는
등록된 줄 모른다. 기존 cron 리마인더도 이미 이렇게 동작한다
(`getGuardianEmailsForStudents`).

그 대가로 **"보호자에게만 보내고 원생에게는 보내지 않기"는 불가능하다.** 화면의
스위치가 두 열(회원 / 운영진)로 단순해지는 값이며, 필요해지면 그때 열을 쪼갠다.

### 3중 관문

순서대로 통과한 주소만 남는다:

1. **관리자가 그 이벤트 × 대상을 켰는가** (`essential`이면 이 관문을 통과한 것으로 본다)
2. **개인이 끄지 않았는가** — `user` 대상에만 적용. **보호자는 보호자 자신의
   `email_opt_in`으로 판정한다**(원생의 설정이 보호자를 대신 끄지 않는다).
   `essential`이면 무시
3. **주소가 유효한가** — 없거나 형식이 깨졌으면 제외하고 사유를 로그에 남긴다

`staff` 대상은 `staffTo` 배열을 그대로 쓴다(개인 옵트아웃 개념 없음).
중복 주소는 마지막에 한 번 제거한다 — 형제가 둘이면 같은 보호자가 두 번 들어온다.

이 함수를 순수하게 유지하는 이유는 `lib/d1/eventViews.ts`와 같다 — 조건이 하나
빠져도 아무도 모르는 자리이기 때문이다. `recipients.test.ts`가 의도를 잠근다.

---

## 7. 발송 로그와 사용량

### D1 `mail_log` (마이그레이션 0036)

```sql
CREATE TABLE mail_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key    TEXT NOT NULL,        -- 'member.signup'
  audience     TEXT NOT NULL,        -- 'user' | 'staff'
  to_address   TEXT NOT NULL,
  subject      TEXT NOT NULL,
  body         TEXT,                 -- redactBody면 NULL. 단체 발송은 대표 행에만
  status       TEXT NOT NULL,        -- 'sent' | 'failed' | 'skipped' | 'quota_blocked'
  detail       TEXT,                 -- 실패 사유 / 건너뛴 이유
  provider     TEXT,                 -- 'resend' | 'smtp'
  provider_id  TEXT,                 -- Resend 메시지 id (추적용)
  -- 단체 발송(BCC) 묶음. 단건은 NULL. 같은 batch는 본문·provider_id를 공유한다
  batch_id     TEXT,
  -- Resend 응답 헤더가 알려준 그 시점의 사용량(대조용). 헤더가 없으면 NULL
  quota_daily   INTEGER,
  quota_monthly INTEGER,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mail_log_created ON mail_log(created_at DESC);
CREATE INDEX idx_mail_log_event   ON mail_log(event_key, created_at DESC);
CREATE INDEX idx_mail_log_to      ON mail_log(to_address);
CREATE INDEX idx_mail_log_batch   ON mail_log(batch_id);
```

**성공만이 아니라 건너뛴 것도 기록한다.** "왜 안 왔지"의 답이 대부분 여기 있다 —
스위치가 꺼져 있었는지(`skipped`), 한도에 막혔는지(`quota_blocked`), 주소가
없었는지(`skipped` + detail). 성공만 남기면 이 질문에 답할 수 없다.

보관은 **1년**, 이후 자동 정리. 월 3,000통을 꽉 채워도 연 40MB 수준이라 D1 무료
한도(5GB)에 부담이 없다. 정리는 기존 일일 cron(`/api/cron/event-reminders`)에 얹는다.

### 사용량 집계 — 세는 단위는 "수신자"다

`mail_log`의 `status='sent'` **행 수**를 **사이트 기준일(`lib/siteDay.ts`)** 로 센다.
UTC로 세면 학원 시간대 기준 저녁에 카운터가 넘어가 하루가 어긋난다.

**Resend는 To·CC·BCC의 각 수신자를 별도 1통으로 센다.** BCC로 30명에게 한 번 보내면
API 호출은 1회지만 한도는 30이 깎인다. 따라서 우리 집계도 **수신자당 1행**이어야
게이지가 실제 잔량과 일치한다. API 호출 수로 세면 화면은 "12통"인데 Resend는
한도 초과를 반환하는 상태가 된다.

동시에 Resend 응답 헤더 `x-resend-daily-quota` / `x-resend-monthly-quota`를 읽어
그 발송의 로그 행에 적어둔다(별도 쓰기 없음 — 로그 INSERT에 함께 실린다).
**자체 집계가 1차 근거이고 헤더는 대조용**이다 — 자체 집계여야 SMTP로 바꿔도 게이지가
동작하고, 헤더와 어긋나면 그것 자체가 신호다(모르는 발송이 있거나, 실패를 성공으로
세고 있다). `x-resend-daily-quota`는 무료 플랜에만 내려온다.

### 한도 안전장치

| 상황 | 동작 |
|---|---|
| 일일 사용량이 `warnAtPercent`(기본 80%) 초과 | 게이지 노랑 + 운영진에게 **하루 1회만** 경고 메일 |
| 일일/월 한도 도달 | 일반 알림은 발송 시도 없이 `quota_blocked`로 기록 |
| 한도 도달 + `essential` 이벤트 | **그래도 보낸다** — 못 보내면 계정을 못 쓴다 |

경고 메일 자체가 한도를 먹으므로 하루 1회로 제한한다(`mail_log`에서 오늘 같은
이벤트 발송 여부로 판정 — 별도 상태 저장 없음).

한도를 **넘기 전에 막는 것**이 핵심이다. Resend의 429를 받고 실패하는 것보다,
"한도 초과로 미발송 12건"이 화면에 남는 편이 낫다.

### 단체 발송 (`event.reminder`)

공연 전날 안내는 이미 **BCC 단체 발송**이다(`app/api/cron/event-reminders/route.ts` —
체크인한 원생 + 그 학부모 주소를 모아 BCC 1통). 수신자 노출을 막는 올바른 선택이지만,
한도 관점에서는 **가장 큰 소비처**다. 참가자 30명이면 하루 100통 중 30을 한 번에 쓴다.

취급 규칙:

- **발송 전에 통째로 판정한다.** 남은 한도가 수신자 수보다 적으면 **아무에게도 보내지
  않고** `quota_blocked`로 기록하고 운영진에게 알린다. 한도까지만 보내면 "누구는 받고
  누구는 못 받은" 상태가 되는데, 이건 안 보낸 것보다 나쁘다 — 아무도 그 사실을 모른다
- **로그는 수신자당 1행**, 같은 `batch_id`로 묶는다. 본문은 대표 행 하나에만 저장한다
  (100명분 본문 중복 방지). 화면 목록에서는 "공연 전날 안내 · 30명"으로 한 줄로 접고,
  펼치면 개별 수신자 행이 나온다 — 주소 검색이 동작해야 하므로 행 자체는 개별로 남긴다
- **cron 라우트에서는 `after()`를 쓰지 않는다.** cron은 응답을 받을 사용자가 없고,
  응답 후 함수가 종료되면 발송이 잘린다. 동기로 끝내고 결과를 응답에 담는다

**이 이벤트 하나가 무료 한도의 성패를 가른다.** 참가자가 50명을 넘거나 공연이 하루에
겹치면 100통 벽에 닿는다. 그 시점의 선택지는 두 가지다 — 리마인더를 이메일 대신
**웹 푸시로 돌리거나**(이미 구축돼 있고 무료·무제한), 유료 플랜으로 올라가거나.
설계상 전자가 자연스럽도록 채널 축을 비워둔 것이다(§2 결정 1).

---

## 8. 오류 처리 원칙

이식 가이드 0절의 원칙을 그대로 따른다.

- **`sendMail()`은 절대 throw 하지 않는다.** `{ ok, detail }`을 돌려준다
- **메일 실패가 본작업을 실패시키지 않는다.** 가입은 가입대로 완료된다.
  메일에 의존하면 스팸 분류 한 번에 가입이 통째로 실패한다
- **응답을 붙잡지 않는다.** 사용자 요청에서 시작된 발송은 `after()`(`next/server`)로
  응답 이후에 실행한다. 메일 서버가 느려도 가입·등록 화면이 기다리지 않는다.
  **단 cron 라우트는 예외** — 응답을 기다리는 사람이 없고, 응답 후 함수가 종료되면
  발송이 잘린다. cron은 동기로 끝낸다
- 실패는 전부 `mail_log`에 남는다 — 콘솔 로그만 남기면 운영자는 영원히 모른다

---

## 9. 관리 화면 — `/admin/mail`

`lib/admin/menu-registry.ts`에 `settings.mail` 추가(`group: 'ops'`,
`defaultRoles: ['admin']`, `href: '/admin/mail'`). `types/permissions.ts`의
`MenuKey` 유니온에도 키를 추가한다. 마이그레이션은 불필요하다(레지스트리 폴백).

`settings.ai`(`/admin/ai`) 바로 옆에 둔다 — 같은 성격의 운영 설정이다.

### 탭 1 · 발송 방법
- 미설정(환경변수) / Resend / SMTP 선택. SMTP 선택 시에만 상세 칸 노출
- 시크릿 칸은 `…Set`이 true면 placeholder에 "저장됨 — 변경할 때만 입력", 값은 항상 빈 칸
- 포트 안내: 465 = TLS(secure ✓), 587 = STARTTLS(secure ✗)
- **테스트 발송 버튼** — 저장본을 대상으로 보내고, 실패하면 서버가 준 `detail`을 그대로 보여준다

테스트 발송이 없으면 이 기능은 미완성이다. 메일 설정은 조용히 실패하는 자리이고,
틀린 비밀번호는 실제 가입이 유실될 때에야 드러난다.

### 탭 2 · 발신 정보
보내는 주소 / 표시 이름 / 답장 받을 주소 / 운영진 알림 주소(복수).
각 칸에 비웠을 때 실제로 쓰일 폴백을 placeholder로 표시한다.

### 탭 3 · 무엇을 보낼지
레지스트리를 그룹별로 순회한 표. 열은 `회원` / `운영진`.
`essential`인 칸은 스위치 대신 `필수` 배지(끌 수 없음을 화면으로 말한다).
`회원` 열 머리에 "원생이면 보호자에게도 함께 발송"을 한 줄로 적는다 — §6의 결정이
화면에서 보이지 않으면 원장은 보호자가 받는 줄 모른다.

### 탭 4 · 발송 내역
- 상단 게이지: 이번 달 `n / 3,000`, 오늘 `n / 100`, 실패 건수, 마지막 발송 시각
- 필터: 기간 · 이벤트 종류 · 상태
- 검색: 수신자 주소 / 제목 부분일치
- 행 클릭 → 본문 전문(`redactBody` 이벤트는 안내 문구)
- 목록은 페이지 번호식(관리자 보관함과 같은 방식)

**두 테마 확인 필수** — 콘솔 UI 규칙(CLAUDE.md). 게이지 색은 역할 토큰을 쓰고,
경고색은 라이트 블록 보정을 함께 넣는다.

---

## 10. 회원 화면

`/admin`(회원 대시보드) 또는 계정 설정에 스위치 하나: **"이메일 알림 받기"**.
현재 상태와, 꺼도 오는 메일이 있다는 안내를 함께 표시한다.

저장은 MySQL `users` 테이블(마이그레이션 0037):

```sql
ALTER TABLE users ADD COLUMN email_opt_in TINYINT(1) NOT NULL DEFAULT 1;
```

기본값 1 — 기존 회원 전원이 받는 상태로 시작한다. `essential` 이벤트는 이 값을 보지 않는다.

---

## 11. 도메인 · DNS 준비

발신 주소는 어느 경로든 **SPF/DKIM 인증된 주소**여야 한다. Resend는 인증 안 된
`from`을 거절하고, SMTP는 보내지긴 해도 스팸함으로 간다.

**서브도메인(`mail.<도메인>`)을 쓴다.** 근거: SPF 레코드는 도메인당 한 줄만 유효하고,
두 줄이 되면 둘 다 무효가 되면서 **기존 업무 메일까지 스팸 판정**을 받는다.
서브도메인으로 분리하면 기존 메일과 완전히 격리된다.

Resend 무료 플랜은 **도메인 1개**까지이므로 이 하나로 족하다.

---

## 12. 테스트

프로젝트 관습(`node --test "lib/**/*.test.ts"`)을 따라 순수 함수를 잠근다.

| 파일 | 잠그는 의도 |
|---|---|
| `lib/mail/recipients.test.ts` | 스위치 off면 안 보낸다 / `essential`은 옵트아웃을 무시한다 / 주소 없으면 제외한다 / `staff`는 `staffTo`를 쓴다 |
| `lib/mail/quota.test.ts` | 한도 도달 시 일반은 막고 `essential`은 통과 / 경고 임계 판정 / 사이트 기준일 경계 |
| `lib/mail/config.test.ts` | 깊은 병합이 옛 저장본을 깨지 않는다 / 공개뷰에 시크릿이 새지 않는다 / 빈 시크릿이 기존 값을 지우지 않는다 |

수동 검증(이식 가이드 7절): 환경변수 폴백 · Resend 키 저장 · SMTP 465 · SMTP 587
네 경로를 테스트 발송으로 확인한다.

---

## 13. 범위 밖 (지금 만들지 않는다)

- 푸시 자동 발송 — 저장 구조에 자리만 둔다
- 관리자용 본문 편집기
- 회원 종류별 세분화 수신 설정
- 발송 실패 자동 재시도 — 재시도는 실패를 두 번 세게 만든다. 필요해지면 `mail_log`에
  이미 근거가 쌓여 있으므로 그때 판단한다
- **새로운** 대량 발송(회원 전체 공지 등) — 하루 100통 한도와 정면충돌한다.
  기존 `event.reminder`는 이미 존재하므로 §7의 규칙으로 안전하게 이관하지만,
  대상을 더 넓히는 기능은 별도 설계가 필요하다
- HTML 템플릿 디자인 — 1차는 텍스트 본문. 도달률이 안정된 뒤 판단한다

---

## 14. 구현 시 주의

- **마이그레이션 번호 충돌** — 현재 마지막은 `0035_registration_forms.sql`이지만
  다른 세션이 병렬로 작업 중일 수 있다. 파일을 만들기 직전에 `git fetch` 후
  `ls migrations/`로 실제 최신 번호를 확인하고 이어붙인다
- **`lib/mail.ts` → `lib/mail/`** 은 같은 이름 공간이라 이관과 삭제가 같은 커밋이어야 한다
- 콘솔 UI는 **라이트·다크 두 테마 모두 확인**하고 `npm run lint:theme` 통과 (CLAUDE.md)
- 관리 화면 문구는 `admin.mail.*` 키코드로 ko/en 두 locale 파일에 함께 추가한다.
  `t(키, '한국어 기본값')` 폴백은 항상 넘긴다
