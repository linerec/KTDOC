# AI(LLM) 공용 모듈 가이드

> 작성일: 2026-07-12
> 관리 화면: `/admin/ai` (admin 전용) · 코드: `lib/ai/`
> 목적: 사이트의 모든 AI 기능이 하나의 공용 모듈로 질의하고, 모델 선택·API 키·
> 버전별 파라미터 차이를 관리자가 코드 수정 없이 운영하게 한다.

---

## 1. 구조 한눈에

```
기능 코드 ── askAI('용도키', 요청) ──▶ lib/ai/index.ts
                                        │  용도 → 지정 조회 (D1 ai.assignments)
                                        │  제공자 설정 조회 (D1 ai.providers — API 키)
                                        ▼
                              quirks.ts 프로파일 판별
                       (브랜드·버전별 파라미터 차이 자동 흡수
                        + 관리자 오버라이드 병합)
                                        ▼
                    adapters/{openai,anthropic,google}.ts
             (제공자별 요청 규약 변환 · 'local'은 openai 어댑터 재사용)
                                        ▼
                              정규화된 AiChatResult
```

- **제공자**: `openai`(ChatGPT) · `anthropic`(Claude) · `google`(Gemini) ·
  `local`(GPT 호환 — LM Studio·Ollama·vLLM 등, 베이스 URL만 다름)
- **API 키는 D1에 저장**(`ai.providers`) — .env가 아니다. 클라이언트에는 마스킹
  미리보기만 내려간다.
- **모델 카탈로그**(`ai.models`): 관리 화면의 "모델 목록 최신화"가 각 제공자
  API(`GET /models` 등)에서 실시간 목록을 받아 캐시한다. 하드코딩 목록 없음 →
  새 모델 출시 즉시 최신화 버튼만 누르면 선택 가능.
- **용도별 지정**(`ai.assignments`): 용도(purpose)마다 제공자·모델·오버라이드를
  지정. 미지정 용도는 `general` 지정으로 폴백.

## 2. 기능에서 사용하는 방법

서버(라우트 핸들러·서버 컴포넌트·서버 액션)에서만 호출한다. 클라이언트
컴포넌트는 자체 API 라우트를 거친다.

```ts
import { askAI, extractJson } from '@/lib/ai';

// 텍스트 질의
const r = await askAI('text.polish', {
  system: '당신은 한국 전통무용학원의 안내 문구를 다듬는 도우미입니다.',
  prompt: `다음 문구를 차분한 합니다체로 다듬어 주세요: ${input}`,
  maxTokens: 500,
});
console.log(r.text, r.usage);

// 이미지 + JSON 추출 (예: 포스터에서 이벤트 정보)
const result = await askAI('poster.extract', {
  prompt: '이 공연 포스터에서 title, dateText, venue, description을 JSON으로 추출해 주세요.',
  images: [{ mimeType: 'image/jpeg', dataBase64 }],
  json: true,
  maxTokens: 800,
});
const info = extractJson<{ title: string; dateText: string; venue: string }>(result.text);
```

- `json: true`: 네이티브 JSON 모드 지원 모델(OpenAI·Gemini)은 강제하고, 미지원
  모델(Claude 등)은 지시문을 덧붙인다 → 응답은 항상 `extractJson()`으로 파싱하라
  (코드펜스·부가 설명이 섞여도 안전하게 첫 JSON을 꺼낸다).
- 실패 시 명확한 한국어 오류를 던진다(모델 미지정, 제공자 비활성, 비전 미지원,
  HTTP 오류 등). AI는 비필수 기능이므로 호출부는 try/catch로 감싸 기능 저하
  (수동 입력 폴백)로 처리한다.

## 3. 새 용도(purpose) 추가하기

1. `lib/ai/registry.ts`의 `AI_PURPOSES`에 1건 추가(키·라벨·설명·needsVision/needsJson).
2. 관리 화면(/admin/ai)에 자동 노출 → 관리자가 모델 지정.
3. 기능 코드에서 `askAI('새용도키', …)` 호출.

용도 키는 `영역.동작` 형태(예: `poster.extract`)를 권장. 폐기 시 레지스트리에서
제거하면 저장된 지정은 로드 시 자동 무시된다.

## 4. 브랜드·버전별 파라미터 차이 대응 (핵심 설계)

같은 브랜드라도 버전에 따라 API 파라미터가 다르다. 3중 방어로 흡수한다:

1. **자동 판별**(`lib/ai/quirks.ts`): 모델 ID 패턴 규칙으로 프로파일 결정.
   - OpenAI 추론 계열(o1/o3/…, gpt-5~): `max_completion_tokens`,
     temperature 미전송, `developer` 역할
   - Anthropic: `system` 최상위 필드, `max_tokens` 필수
   - Google: `systemInstruction`, `generationConfig.maxOutputTokens`,
     JSON은 `responseMimeType`
   - system 미지원 구모델: 프롬프트 앞 병합(prepend) 폴백
2. **프로파일 오버라이드**(관리 화면 > 고급): 규칙이 빗나간 새 모델은
   `{"supportsVision": true}`처럼 부분 덮어쓰기 — 코드 수정·배포 없이 대응.
3. **요청 파라미터 오버라이드**: 제공자 원문 파라미터를 요청 본문에 마지막으로
   병합(예: `{"reasoning_effort": "low"}`). 완전히 새로운 파라미터의 탈출구.

새 버전 계열이 자리 잡으면 `quirks.ts`의 규칙 목록에 한 줄 추가해 자동화한다.

## 5. 운영 절차 (관리자)

1. `/admin/ai` > 제공자 카드에 API 키 저장 + "사용" 체크
   (local은 베이스 URL도 입력 — 예: `http://localhost:1234/v1`)
2. "모델 목록 최신화" — 최신 모델이 카탈로그에 들어온다
3. 용도별로 제공자·모델 선택 → "테스트"로 실제 질의 확인 → "용도별 지정 저장"
4. `general`(기본)은 반드시 지정해 두는 것을 권장 — 모든 미지정 용도의 폴백

## 6. 보안 메모

- API 키는 D1 `site_settings`(`ai.providers`)에 저장되고 서버에서만 읽는다.
  조회 API는 마스킹 미리보기(`sk-ab…3f9a`)만 반환하며, 저장 시 빈 값은
  "기존 키 유지"로 처리된다(클라이언트가 원본을 알 필요가 없다).
- `/admin/ai`와 모든 `/api/admin/ai/*`는 admin 전용(teacher 불가).
- `lib/ai/settings.ts`·`lib/ai/index.ts`는 서버 전용 — 클라이언트 컴포넌트에서
  import 금지. 클라이언트 안전 모듈은 `types/ai.ts`, `lib/ai/registry.ts`,
  `lib/ai/quirks.ts`뿐이다.
