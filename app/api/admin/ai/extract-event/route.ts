/**
 * POST /api/admin/ai/extract-event — 포스터/텍스트에서 이벤트 정보 추출
 *
 * 입력: 이미지(base64)·텍스트 중 하나 이상 + 카테고리 후보 목록.
 * AI 용도 'poster.extract'(관리 콘솔 > AI 설정에서 모델 지정)로 질의해
 * 이벤트 폼 필드 형태의 JSON을 받는다. 한 언어 자료만 있어도 한/영을
 * 모두 채우도록 지시한다.
 *
 * 예외 처리(LLM 출력은 신뢰 불가):
 *  - JSON 해석 실패 시 지시를 강화해 1회 자동 재시도
 *  - 필드별 정규화(날짜·시간 형식 교정, 카테고리 id 검증) — 어긋난 값은
 *    버리고 warnings로 알려 관리자가 직접 채우게 한다(부분 성공 허용)
 *
 * ── 시간은 모델에게 변환을 맡기지 않는다 ──────────────────────────────────
 * 예전에는 "24시간 HH:MM으로 달라"고만 요구했다. 그러면 오전/오후 변환을 모델이
 * 하는데, **틀려도 형식이 멀쩡해서 아무 데서도 걸리지 않는다** — 저녁 7시 공연이
 * 07:00으로 저장되어 실제로 문제가 되었다. 지금은 모델에게 "자료에 인쇄된 표기
 * 그대로"(`*_time_raw`)를 함께 요구하고, 12→24시간 변환은 `lib/ai/eventFields.ts`가
 * 결정론적으로 한다. 표지가 없어 모호한 값은 집합 ≤ 시작 ≤ 종료 순서로 되짚는다.
 *
 * ── 주소는 없으면 찾아 온다 ───────────────────────────────────────────────
 * 포스터에는 장소 **이름만** 적히는 경우가 대부분이라, 아무리 추출을 잘해도 주소가
 * 나오지 않는다. 이름이 있고 주소가 비었으면 지오코더에 물어 후보를 채운다
 * (관리자가 위치 선택기에서 확인·수정한다).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPermMatrix, effectiveAllowedByKey } from '@/lib/admin/permissions';
import { askAI, extractJson } from '@/lib/ai';
import {
  parseTime,
  reconcileEventTimes,
  splitVenueAndAddress,
  type ParsedTime,
  type TimeKey,
} from '@/lib/ai/eventFields';
import { getMapsProvider } from '@/lib/maps';
import type { ExtractedEventInfo } from '@/types/gallery';
import type { MemberRole } from '@/types/members';

/** base64 기준 약 9MB(원본 ~6.7MB) — 클라이언트가 리사이즈해 보내므로 여유치 */
const MAX_IMAGE_BASE64 = 12 * 1024 * 1024;
const MAX_TEXT_LEN = 12_000;

interface ExtractBody {
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  categories?: { id: number; name: string }[];
}

/* ── 필드 정규화 (LLM 출력 방어) ───────────────────────────────────── */

function asText(value: unknown, maxLen = 2000): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t.slice(0, maxLen) : null;
}

/** YYYY-MM-DD로 정규화 — YYYY.M.D / YYYY/M/D / YYYY년 M월 D일 표기도 수용 */
function asDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value
    .trim()
    .match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 시각 한 칸을 해석한다 — 자료 표기(`raw`)가 모델의 24시간 변환보다 **우선한다**.
 *
 * 둘이 어긋나면 그것이 곧 "모델이 오전/오후를 헷갈렸다"는 증거다. 자료에 표지가
 * 분명히 적혀 있었으므로(`explicit`) 그쪽을 믿고, 관리자에게 알린다.
 */
function resolveTime(
  raw: unknown,
  converted: unknown,
  label: string,
  warnings: string[],
): ParsedTime | null {
  const fromRaw = parseTime(raw);
  const fromModel = parseTime(converted);

  // ① 자료에 오전/오후가 분명히 적혀 있다 → 자료가 이긴다.
  if (fromRaw?.explicit) {
    if (fromModel && fromModel.time !== fromRaw.time) {
      warnings.push(
        `${label}: 자료에 "${String(raw).trim()}"로 적혀 있어 ${fromRaw.time}으로 잡았습니다` +
          ` (AI는 ${fromModel.time}로 읽었습니다).`,
      );
    }
    return fromRaw;
  }

  // ② 자료 표기가 없거나 모호하다("7:30"). 모델의 24시간 변환은 **추정**일 뿐이므로
  //    확정으로 표시하지 않는다 — 아래 순서 검증이 뒤집을 수 있어야 한다.
  //    이것이 "저녁 7시 공연이 07:00으로 저장되던" 경로를 막는 지점이다.
  const fallback = fromModel ?? fromRaw;
  return fallback ? { time: fallback.time, explicit: false } : null;
}

const TIME_LABEL: Record<TimeKey, string> = {
  call_time: '집합 시간',
  start_time: '시작 시간',
  end_time: '종료 시간',
};

function asCategoryId(value: unknown, allowed: Set<number>): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && allowed.has(n) ? n : null;
}

/* ── 프롬프트 ──────────────────────────────────────────────────────── */

const SYSTEM_PROMPT =
  '당신은 한국 전통무용 학원(KTDOC 춤누리)의 공연·행사 아카이브 등록을 돕는 어시스턴트입니다. ' +
  '포스터 이미지와 안내 텍스트에서 이벤트 정보를 추출해 요청된 JSON 스키마로만 응답합니다. ' +
  '자료에 없는 값은 추측하지 말고 null로 둡니다. ' +
  '제목과 설명은 한국어(_ko)와 영어(_en)를 모두 채우되, 자료가 한 언어뿐이면 다른 언어를 자연스럽게 번역해 채웁니다.';

function buildPrompt(text: string | null, categories: { id: number; name: string }[]): string {
  const categoryList = categories.length
    ? categories.map((c) => `${c.id}: ${c.name}`).join(', ')
    : '(없음)';
  return [
    '다음 자료(포스터 이미지·안내 텍스트)에서 이벤트 정보를 추출해 아래 JSON 스키마 그대로만 응답하세요.',
    '',
    '스키마(모든 필드 필수, 값을 못 찾으면 null):',
    '{',
    '  "title_ko": string|null,        // 이벤트 제목(한국어)',
    '  "title_en": string|null,        // 이벤트 제목(영어)',
    '  "event_date": string|null,      // 개최 날짜 YYYY-MM-DD. 연도가 자료에 없으면 null',
    '  "start_time_raw": string|null,  // 시작 시간을 자료에 적힌 표기 그대로 (예: "7:30 PM", "오후 7시 30분")',
    '  "start_time": string|null,      // 위를 24시간으로 옮긴 값 HH:MM',
    '  "end_time_raw": string|null,    // 종료 시간을 자료에 적힌 표기 그대로',
    '  "end_time": string|null,        // 위를 24시간으로 옮긴 값 HH:MM',
    '  "call_time_raw": string|null,   // 집합/리허설 시간을 자료에 적힌 표기 그대로',
    '  "call_time": string|null,       // 위를 24시간으로 옮긴 값 HH:MM',
    '  "description_ko": string|null,  // 소개·안내를 2~4문장으로 정리(한국어, 과장 금지)',
    '  "description_en": string|null,  // 위 내용의 자연스러운 영어',
    '  "location": string|null,        // 장소 **이름만** (예: "Bergen PAC", "세종문화회관 대극장"). 주소를 섞지 마세요',
    '  "location_address": string|null,// 자료에 적힌 주소. 번지·도로명·도시·주/도·우편번호 중 **적힌 만큼** 그대로',
    '  "prep_notes": string|null,      // 준비물·복장·유의사항이 있으면 요약',
    `  "category_id": number|null      // 가장 알맞은 카테고리 id 하나. 후보: ${categoryList}`,
    '}',
    '',
    '시간 규칙 (중요):',
    '- `_raw`에는 AM/PM·오전/오후를 포함해 **자료에 보이는 그대로** 옮기세요. 자료에 표지가 없으면 숫자만 그대로.',
    '- 자료에 없는 오전/오후를 추측해서 붙이지 마세요. 모르면 `_raw`에 표지 없이 적으면 됩니다.',
    '- 시간이 아예 없으면 `_raw`와 24시간 값 모두 null.',
    '',
    '장소 규칙:',
    '- 이름과 주소가 한 줄에 붙어 있으면 나눠서 각 칸에 넣으세요.',
    '- 주소가 일부만 있어도(도시·주 이름만이라도) 버리지 말고 `location_address`에 적으세요.',
    '- 자료에 없는 주소를 지어내지 마세요.',
    '',
    '규칙: JSON 객체 하나만 출력하고, JSON 밖에 어떤 텍스트도 쓰지 마세요.',
    ...(text ? ['', '--- 안내 텍스트 자료 ---', text] : []),
  ].join('\n');
}

/* ── 라우트 ────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }
    // 공연 관리 권한과 동일한 통제(메뉴 매트릭스 'gallery')
    const actorRole = (session.user.role ?? 'user') as MemberRole;
    const matrix = await getPermMatrix();
    if (!effectiveAllowedByKey('gallery', actorRole, matrix)) {
      return NextResponse.json(
        { success: false, error: '공연 관리 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body: ExtractBody = await request.json();
    const text = asText(body.text, MAX_TEXT_LEN);
    const hasImage = typeof body.imageBase64 === 'string' && body.imageBase64.length > 0;

    if (!hasImage && !text) {
      return NextResponse.json(
        { success: false, error: '포스터 이미지 또는 안내 텍스트를 입력해 주세요.' },
        { status: 400 }
      );
    }
    if (hasImage && body.imageBase64!.length > MAX_IMAGE_BASE64) {
      return NextResponse.json(
        { success: false, error: '이미지가 너무 큽니다. 더 작은 이미지로 시도해 주세요.' },
        { status: 413 }
      );
    }

    const categories = (body.categories ?? [])
      .filter((c) => c && Number.isInteger(c.id) && typeof c.name === 'string')
      .slice(0, 50);
    const allowedCategoryIds = new Set(categories.map((c) => c.id));

    const images = hasImage
      ? [{ mimeType: body.mimeType || 'image/jpeg', dataBase64: body.imageBase64! }]
      : undefined;
    const basePrompt = buildPrompt(text, categories);

    // JSON 해석 실패 시 지시를 강화해 1회 재시도 (LLM 출력 형태 방어)
    let raw: Record<string, unknown> | null = null;
    let lastResult: Awaited<ReturnType<typeof askAI>> | null = null;
    let lastParseError = '';
    for (let attempt = 0; attempt < 2 && !raw; attempt++) {
      const result = await askAI('poster.extract', {
        system: SYSTEM_PROMPT,
        prompt:
          attempt === 0
            ? basePrompt
            : `${basePrompt}\n\n중요: 직전 응답이 JSON 형식이 아니었습니다. 반드시 유효한 JSON 객체 하나만, 코드펜스 없이 출력하세요.`,
        images,
        json: true,
        // 추론(thinking) 모델은 사고 토큰도 이 예산에서 차감된다. 1500으로는 사고에만
        // 1400여 토큰을 쓰고 JSON이 중간에 잘렸다(gemini-2.5-flash 실측).
        // 상한만 올리는 것이므로 과금은 실제 사용 토큰 기준 그대로다.
        maxTokens: 8000,
        temperature: 0.2,
      });
      lastResult = result;
      try {
        raw = extractJson<Record<string, unknown>>(result.text);
      } catch (e) {
        raw = null;
        lastParseError = e instanceof Error ? e.message : String(e);
      }
    }
    if (!raw) {
      // 잘림(MAX_TOKENS/length)은 원인이 뚜렷하므로 안내를 따로 준다
      const truncated = /max_tokens|length/i.test(lastResult?.finishReason ?? '');
      return NextResponse.json(
        {
          success: false,
          error: truncated
            ? 'AI 응답이 최대 길이에 걸려 잘렸습니다. 안내 텍스트를 줄이거나, AI 설정에서 다른 모델을 지정해 주세요.'
            : 'AI 응답을 해석하지 못했습니다. 다시 시도하거나, AI 설정에서 다른 모델을 지정해 주세요.',
          // 진단용 상세 — 화면에서는 기본으로 접혀 있다(운영진만 접근하는 API)
          detail: {
            reason: lastParseError || '알 수 없음',
            provider: lastResult?.provider,
            model: lastResult?.model,
            finishReason: lastResult?.finishReason,
            usage: lastResult?.usage,
            responseLength: lastResult?.text.length ?? 0,
            responsePreview: (lastResult?.text ?? '').slice(0, 600),
          },
        },
        { status: 422 }
      );
    }

    // 필드별 정규화 — 어긋난 값은 버리고 경고로 알린다(부분 성공 허용)
    const warnings: string[] = [];

    // ── 시간: 자료 표기를 우선 해석하고, 셋을 함께 놓고 순서로 되짚는다 ──────
    const times = reconcileEventTimes({
      call_time: resolveTime(raw.call_time_raw, raw.call_time, TIME_LABEL.call_time, warnings),
      start_time: resolveTime(raw.start_time_raw, raw.start_time, TIME_LABEL.start_time, warnings),
      end_time: resolveTime(raw.end_time_raw, raw.end_time, TIME_LABEL.end_time, warnings),
    });
    if (times.adjusted.length > 0) {
      warnings.push(
        `${times.adjusted.map((k) => TIME_LABEL[k]).join('·')}의 오전/오후가 자료에 없어` +
          ' 집합→시작→종료 순서에 맞게 잡았습니다 — 확인해 주세요.',
      );
    }
    if (times.inconsistent) {
      warnings.push(
        '집합·시작·종료 시간의 순서가 맞지 않습니다. AI가 읽은 값을 그대로 두었으니 직접 확인해 주세요.',
      );
    }

    // ── 장소: 이름과 주소가 뭉쳐 왔으면 가른다 ──────────────────────────────
    const venue = splitVenueAndAddress(
      asText(raw.location, 200),
      asText(raw.location_address, 300),
    );
    if (venue.split) {
      warnings.push('장소 이름과 주소가 한 칸에 있어 나눴습니다 — 확인해 주세요.');
    }

    const data: ExtractedEventInfo = {
      title_ko: asText(raw.title_ko, 200),
      title_en: asText(raw.title_en, 200),
      event_date: asDate(raw.event_date),
      start_time: times.start_time,
      end_time: times.end_time,
      call_time: times.call_time,
      description_ko: asText(raw.description_ko),
      description_en: asText(raw.description_en),
      location: venue.location,
      location_address: venue.location_address,
      prep_notes: asText(raw.prep_notes, 1000),
      category_id: asCategoryId(raw.category_id, allowedCategoryIds),
    };

    // ── 주소가 비었으면 장소 이름으로 찾아본다 ──────────────────────────────
    // 포스터에는 장소 **이름만** 적히는 경우가 대부분이라, 추출을 아무리 잘해도
    // 주소가 나오지 않는다. 없는 것을 짜내는 대신 지오코더에 물어 후보를 채운다.
    // 실패해도 추출 전체를 실패로 만들지 않는다 — 주소는 관리자가 위치 선택기에서
    // 언제든 채울 수 있는 값이다.
    if (data.location && !data.location_address) {
      try {
        const hits = await getMapsProvider().geocode(data.location, { limit: 1 });
        if (hits[0]?.address) {
          data.location_address = hits[0].address.slice(0, 300);
          warnings.push(
            `주소가 자료에 없어 "${data.location}"으로 검색해 채웠습니다` +
              ' — 위치 선택기에서 지도로 확인해 주세요.',
          );
        } else {
          warnings.push('주소를 찾지 못했습니다 — 위치 선택기에서 검색해 주세요.');
        }
      } catch (e) {
        console.error('extract-event 지오코딩 실패:', e);
        warnings.push('주소 자동 검색에 실패했습니다 — 위치 선택기에서 직접 검색해 주세요.');
      }
    }

    if (!data.title_ko && !data.title_en) {
      warnings.push('제목을 찾지 못했습니다 — 직접 입력해 주세요.');
    } else if (!data.title_ko || !data.title_en) {
      warnings.push(`${data.title_ko ? '영문' : '한글'} 제목이 비어 있습니다 — 확인해 주세요.`);
    }
    if (!data.event_date) {
      if (raw.event_date) warnings.push('날짜 형식을 해석하지 못했습니다 — 직접 입력해 주세요.');
      else warnings.push('날짜를 찾지 못했습니다(연도 미표기 포스터일 수 있음) — 직접 입력해 주세요.');
    }
    if (raw.category_id != null && data.category_id === null && categories.length > 0) {
      warnings.push('카테고리를 자동으로 맞추지 못했습니다 — 직접 선택해 주세요.');
    }
    if (!data.location && !data.location_address) {
      warnings.push('장소를 찾지 못했습니다 — 위치 선택기에서 직접 입력해 주세요.');
    }

    return NextResponse.json({ success: true, data, warnings });
  } catch (error) {
    // askAI의 명확한 한국어 오류(모델 미지정·제공자 비활성·비전 미지원 등)를 그대로 전달
    const message =
      error instanceof Error ? error.message : '이벤트 정보 추출에 실패했습니다.';
    console.error('AI extract-event error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        detail: {
          reason: message,
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 4).join('\n') : undefined,
        },
      },
      { status: 502 }
    );
  }
}
