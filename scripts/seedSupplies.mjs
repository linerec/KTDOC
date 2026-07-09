#!/usr/bin/env node
/**
 * 준비물 카탈로그 시더
 *
 * docs/operations/supplies-normalization.md(준비물 정규화 문서)의 품목·세트를
 * 원격 D1의 supply_items / supply_sets에 넣는다.
 *   - 멱등: slug 기준으로 이미 있는 항목·세트는 건드리지 않는다(수동 편집 보존).
 *   - 세트 구성(supply_set_items)은 세트가 새로 만들어질 때만 채운다.
 *   - 기존 데모 항목(hanbok·beoseon·hansam·buchae·hair-tie·water-bottle)은 그대로 두고 재사용한다.
 *
 * 사용: npm run seed:supplies
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv(file) {
  let text;
  try {
    text = readFileSync(join(root, file), 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv('.env.local');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB_ID = process.env.D1_DATABASE_ID;

if (!ACCOUNT_ID || !API_TOKEN || !DB_ID) {
  console.error('D1 설정 누락: CLOUDFLARE_ACCOUNT_ID·CLOUDFLARE_API_TOKEN·D1_DATABASE_ID 확인.');
  process.exit(1);
}

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body?.errors?.[0]?.message || `D1 API error (${res.status})`);
  }
  return body.result[0];
}

// ── 품목 카탈로그 ─────────────────────────────────────────────────────────
// term: glossary_terms.id (말모이 연결) — 현재 한삼(5)만 해당.
// sort_order 블록: 100 연습 | 110 헤어 | 120 메이크업 | 200 채 | 300 악기 | 400 소품 | 500 의상
const ITEMS = [
  // 연습·개인 기본
  { slug: 'waist-skirt-practice', sort: 100,
    ko: '허리치마(연습용)', en: 'Practice Waist Skirt',
    dko: '무용 연습용 허리치마입니다. 수업 때 개인이 준비해 착용합니다.',
    den: 'A waist-wrap skirt worn for dance practice. Students bring their own to every class.' },
  { slug: 'water-bottle', sort: 101,
    ko: '물병', en: 'Water Bottle',
    dko: '이름을 적은 개인 물병입니다. 수업마다 지참합니다.',
    den: 'A personal water bottle labeled with your name. Bring to every class.' },

  // 헤어용품
  { slug: 'hair-tie', sort: 109,
    ko: '머리끈', en: 'Hair Tie',
    dko: '머리를 단정히 묶는 검정 머리끈입니다. 개인 준비물입니다.',
    den: 'A black hair tie to keep hair neat. Personal item.' },
  { slug: 'hair-spray', sort: 110,
    ko: '헤어스프레이', en: 'Hair Spray',
    dko: '머리 모양을 고정하는 헤어스프레이입니다. 개인 준비물입니다.',
    den: 'Hair spray for holding hairstyles in place. Personal item.' },
  { slug: 'hair-gel-wax', sort: 111,
    ko: '헤어젤·왁스', en: 'Hair Gel or Wax',
    dko: '잔머리 정리용 헤어젤 또는 왁스입니다. 개인 준비물입니다.',
    den: 'Hair gel or wax for smoothing stray hairs. Personal item.' },
  { slug: 'hair-net', sort: 112,
    ko: '머리망', en: 'Hair Net',
    dko: '쪽머리·올림머리를 고정하는 머리망입니다. 개인 준비물입니다.',
    den: 'A hair net for securing buns and updos. Personal item.' },
  { slug: 'hair-pin-u', sort: 113,
    ko: 'U자핀', en: 'U-shaped Hair Pins',
    dko: '올림머리를 고정하는 U자 모양 핀입니다. 개인 준비물입니다.',
    den: 'U-shaped pins for securing updos. Personal item.' },
  { slug: 'hair-pin-bobby', sort: 114,
    ko: '실핀', en: 'Bobby Pins',
    dko: '잔머리와 장식을 고정하는 실핀입니다. 개인 준비물입니다.',
    den: 'Bobby pins for stray hairs and hair ornaments. Personal item.' },
  { slug: 'tail-comb', sort: 115,
    ko: '꼬리빗', en: 'Tail Comb',
    dko: '가르마를 타고 머리를 정리하는 꼬리빗입니다. 개인 준비물입니다.',
    den: 'A tail comb for parting and styling hair. Personal item.' },

  // 공연 메이크업 (위생상 전 품목 개인 준비)
  { slug: 'foundation-stick', sort: 120,
    ko: '스틱 파운데이션', en: 'Stick Foundation',
    dko: '무대 조명에 맞춘 베이스 메이크업용 스틱 파운데이션입니다. 위생상 개인 준비물입니다.',
    den: 'Stick foundation for stage base makeup. Personal item for hygiene.' },
  { slug: 'powder-pact', sort: 121,
    ko: '파우더(팩트)', en: 'Pressed Powder',
    dko: '메이크업을 고정하는 파우더 팩트입니다. 위생상 개인 준비물입니다.',
    den: 'Pressed powder for setting makeup. Personal item for hygiene.' },
  { slug: 'eyebrow-pencil', sort: 122,
    ko: '아이브로우', en: 'Eyebrow Pencil',
    dko: '눈썹을 또렷하게 그리는 아이브로우입니다. 위생상 개인 준비물입니다.',
    den: 'Eyebrow pencil for defined brows. Personal item for hygiene.' },
  { slug: 'eyeshadow', sort: 123,
    ko: '아이섀도우', en: 'Eyeshadow',
    dko: '무대용 눈매 표현을 위한 아이섀도우입니다. 위생상 개인 준비물입니다.',
    den: 'Eyeshadow for stage eye makeup. Personal item for hygiene.' },
  { slug: 'eyeliner', sort: 124,
    ko: '아이라이너', en: 'Eyeliner',
    dko: '눈매를 선명하게 그리는 아이라이너입니다. 위생상 개인 준비물입니다.',
    den: 'Eyeliner for sharp eye definition. Personal item for hygiene.' },
  { slug: 'mascara', sort: 125,
    ko: '마스카라', en: 'Mascara',
    dko: '속눈썹을 또렷하게 하는 마스카라입니다. 위생상 개인 준비물입니다.',
    den: 'Mascara for defined lashes. Personal item for hygiene.' },
  { slug: 'blusher', sort: 126,
    ko: '블러셔', en: 'Blusher',
    dko: '혈색을 살리는 블러셔입니다. 위생상 개인 준비물입니다.',
    den: 'Blusher for a healthy stage complexion. Personal item for hygiene.' },
  { slug: 'lipstick', sort: 127,
    ko: '립스틱·립틴트', en: 'Lipstick or Lip Tint',
    dko: '무대용 립 컬러입니다. 위생상 개인 준비물입니다.',
    den: 'Lip color for stage. Personal item for hygiene.' },
  { slug: 'makeup-puff-brush', sort: 128,
    ko: '메이크업 퍼프·브러시', en: 'Makeup Puffs & Brushes',
    dko: '메이크업 도구인 퍼프와 브러시입니다. 위생상 개인 준비물입니다.',
    den: 'Makeup puffs and brushes. Personal items for hygiene.' },
  { slug: 'makeup-fixer', sort: 129,
    ko: '메이크업 픽서', en: 'Makeup Setting Spray',
    dko: '공연 내내 메이크업을 유지하는 픽서입니다. 위생상 개인 준비물입니다.',
    den: 'Setting spray to keep makeup in place through the performance. Personal item.' },

  // 북채·채
  { slug: 'drumsticks-basic', sort: 200,
    ko: '기본 북채', en: 'Basic Drumsticks (Bukchae)',
    dko: '삼고무와 기본난타에 함께 쓰는 기본 북채 1조(한 쌍)입니다. 개인 구매를 권장하며, 공연 때는 학원 예비분도 준비됩니다.',
    den: 'A pair of basic drumsticks shared by Samgomu and basic Nanta. Personal purchase recommended; the academy keeps spares for performances.' },
  { slug: 'janggu-gungchae', sort: 201,
    ko: '궁채', en: 'Gungchae (Janggu Mallet)',
    dko: '장구의 왼손 채입니다. 끝이 둥근 방망이 모양으로 궁편(낮은 소리 면)을 칩니다. 열채와 한 벌로 개인 구매를 권장합니다.',
    den: 'The left-hand janggu mallet with a rounded head, striking the low-pitched drumhead. Purchased as a pair with the yeolchae.' },
  { slug: 'janggu-yeolchae', sort: 202,
    ko: '열채', en: 'Yeolchae (Janggu Stick)',
    dko: '장구의 오른손 채입니다. 가는 대나무 채로 채편(높은 소리 면)을 칩니다. 궁채와 한 벌로 개인 구매를 권장합니다.',
    den: 'The right-hand thin bamboo janggu stick, striking the high-pitched drumhead. Purchased as a pair with the gungchae.' },
  { slug: 'drumsticks-kdrum', sort: 203,
    ko: 'K Drum Ensemble 북채', en: 'K Drum Ensemble Sticks',
    dko: 'K Drum Ensemble 전용 북채 1조입니다. 메가드럼과 함께 학원에서 준비합니다.',
    den: 'A dedicated pair of sticks for the K Drum Ensemble, provided by the academy with the mega drums.' },
  { slug: 'drumsticks-jindobuk', sort: 204,
    ko: '진도북 북채', en: 'Jindo Buk Sticks',
    dko: '진도북춤용 양손 북채입니다. 진도북과 함께 학원에서 준비합니다.',
    den: 'Two-handed sticks for Jindo drum dance, provided by the academy with the Jindo buk.' },

  // 악기 (전부 학원 보유)
  { slug: 'janggu', sort: 300,
    ko: '장구', en: 'Janggu (Hourglass Drum)',
    dko: '장구춤과 장단 수업에 쓰는 모래시계 모양의 전통 타악기입니다. 학원에서 준비합니다.',
    den: 'The traditional hourglass-shaped drum used for janggu dance and rhythm classes. Provided by the academy.' },
  { slug: 'nanta-drum', sort: 301,
    ko: '기본난타용 북', en: 'Nanta Drum',
    dko: '기본난타 수업·공연에 쓰는 북입니다. 학원에서 준비합니다.',
    den: 'The drum used for basic Nanta classes and performances. Provided by the academy.' },
  { slug: 'mega-drum', sort: 302,
    ko: '메가드럼', en: 'Mega Drum',
    dko: 'K Drum Ensemble에 쓰는 대형 창작 타악기입니다. 학원에서 준비합니다.',
    den: 'The large contemporary drum used in the K Drum Ensemble. Provided by the academy.' },
  { slug: 'samgomu-drums', sort: 303,
    ko: '삼고무 북', en: 'Samgomu Drum Set (Three Drums)',
    dko: '삼고무(북 3개 북춤)에 쓰는 북 일습입니다. 학원에서 준비합니다.',
    den: 'The three-drum set used for Samgomu. Provided by the academy.' },
  { slug: 'ogomu-drums', sort: 304,
    ko: '오고무 북', en: 'Ogomu Drum Set (Five Drums)',
    dko: '오고무(북 5개 북춤)에 쓰는 북 일습입니다. 학원에서 준비합니다.',
    den: 'The five-drum set used for Ogomu. Provided by the academy.' },
  { slug: 'jindobuk', sort: 305,
    ko: '진도북', en: 'Jindo Buk (Jindo Drum)',
    dko: '진도북춤에 쓰는 북입니다. 양손 북채와 함께 학원에서 준비합니다.',
    den: 'The drum used for Jindo drum dance, provided by the academy with its two-handed sticks.' },

  // 소품
  { slug: 'buchae', sort: 400,
    ko: '부채', en: 'Buchae (Fan)',
    dko: '부채춤에 쓰는 접부채입니다. 공연용은 무대 통일을 위해 학원에서 준비합니다.',
    den: 'The folding fan used for buchaechum (fan dance). Performance fans are provided by the academy for a uniform stage look.' },
  { slug: 'buchae-sanjo', sort: 400,
    ko: '산조부채', en: 'Sanjo Fan',
    dko: '산조춤에 쓰는 부채입니다. 학원에서 준비합니다.',
    den: 'The fan used for Sanjo dance. Provided by the academy.' },
  { slug: 'buchae-hallyangmu', sort: 401,
    ko: '한량무 부채(남성용)', en: 'Hallyangmu Fan (Men’s)',
    dko: '한량무에 쓰는 남성용 부채입니다. 학원에서 준비합니다.',
    den: 'The men’s fan used for Hallyangmu (nobleman’s dance). Provided by the academy.' },
  { slug: 'sogo', sort: 402,
    ko: '소고', en: 'Sogo (Small Hand Drum)',
    dko: '소고춤에 쓰는 작은 손북입니다. 손에 들고 치며 추는 악기 겸 소품으로, 학원에서 준비합니다.',
    den: 'A small hand drum for sogo dance — both prop and instrument. Provided by the academy.' },
  { slug: 'gyeonggo', sort: 403,
    ko: '경고', en: 'Gyeonggo (Hand Drum)',
    dko: '경고춤에 쓰는 손북입니다. 악기 겸 소품으로, 학원에서 준비합니다.',
    den: 'The hand drum used for Gyeonggo dance — both prop and instrument. Provided by the academy.' },
  { slug: 'hansam-hwagwanmu', sort: 404, term: 5,
    ko: '화관무 한삼', en: 'Hwagwanmu Hansam',
    dko: '화관무에 쓰는 긴 소매 한삼입니다. 학원에서 준비하고 공연 후 회수해 세탁합니다.',
    den: 'Long hansam sleeves for Hwagwanmu. Provided by the academy and laundered after each performance.' },
  { slug: 'hansam-talchum', sort: 405, term: 5,
    ko: '탈춤용 한삼', en: 'Talchum Hansam',
    dko: '탈춤에 쓰는 한삼입니다. 학원에서 준비하고 공연 후 회수해 세탁합니다.',
    den: 'Hansam sleeves for Talchum (mask dance). Provided by the academy and laundered after each performance.' },
  { slug: 'salpuri-scarf', sort: 406,
    ko: '살풀이 수건', en: 'Salpuri Scarf',
    dko: '살풀이춤에 쓰는 긴 수건입니다. 학원에서 준비하고 공연 후 세탁합니다.',
    den: 'The long scarf used for Salpuri dance. Provided by the academy and laundered after use.' },
  { slug: 'geommu-sword', sort: 407,
    ko: '검무용 칼', en: 'Geommu Sword',
    dko: '검무에 쓰는 무용 칼입니다. 안전을 위해 학원에서 보관·점검·준비합니다.',
    den: 'The dance sword for Geommu. Stored, inspected, and provided by the academy for safety.' },
  { slug: 'tal-mask', sort: 408,
    ko: '탈', en: 'Tal (Mask)',
    dko: '탈춤에 쓰는 전통 탈입니다. 파손되기 쉬워 학원에서 보관·준비합니다.',
    den: 'The traditional mask for Talchum. Fragile — stored and provided by the academy.' },
  { slug: 'arirang-flower', sort: 409,
    ko: '아리랑 꽃(꽃춤용)', en: 'Arirang Flower Prop',
    dko: '아리랑 꽃춤에 쓰는 꽃 소품입니다. 학원에서 준비합니다.',
    den: 'The flower prop for the Arirang flower dance. Provided by the academy.' },
  { slug: 'bomdongsan-basket', sort: 410,
    ko: '봄동산 바구니', en: 'Bomdongsan Basket Prop',
    dko: '봄동산에 쓰는 바구니 소품입니다. 학원에서 준비합니다.',
    den: 'The basket prop for Bomdongsan (Spring Hill). Provided by the academy.' },

  // 의상 — 부채춤
  { slug: 'jeogori-dangui-yellow', sort: 500,
    ko: '노란 당의저고리', en: 'Yellow Dangui Jeogori',
    dko: '부채춤 의상의 노란 당의형 저고리입니다. 학원에서 사이즈에 맞춰 대여합니다.',
    den: 'The yellow dangui-style jeogori for the fan dance costume. Fitted and lent by the academy.' },
  { slug: 'skirt-purple', sort: 501,
    ko: '보라 치마', en: 'Purple Chima',
    dko: '부채춤 의상의 보라색 치마입니다. 학원에서 대여합니다.',
    den: 'The purple chima (skirt) for the fan dance costume. Lent by the academy.' },
  { slug: 'underskirt-pink', sort: 502,
    ko: '연분홍 속치마', en: 'Light Pink Underskirt',
    dko: '부채춤 의상 안에 입는 연분홍 속치마입니다. 학원에서 대여합니다.',
    den: 'The light pink underskirt worn under the fan dance costume. Lent by the academy.' },
  { slug: 'underpants-white', sort: 503,
    ko: '흰 속바지', en: 'White Under-pants',
    dko: '부채춤과 드럼계열(동고·삼고무·오고무·장구춤) 의상에 함께 입는 흰 속바지입니다. 학원에서 대여합니다.',
    den: 'White under-pants shared by the fan dance and drum-dance costumes. Lent by the academy.' },

  // 의상 — 드럼계열 공용 (동고·삼고무·오고무·장구춤)
  { slug: 'jeogori-jade', sort: 510,
    ko: '비취 저고리', en: 'Jade Jeogori',
    dko: '동고·삼고무·오고무·장구춤이 함께 입는 비취색 저고리입니다. 학원에서 대여합니다.',
    den: 'The jade jeogori shared by Donggo, Samgomu, Ogomu, and Janggu dance. Lent by the academy.' },
  { slug: 'skirt-red', sort: 511,
    ko: '빨간 치마', en: 'Red Chima',
    dko: '드럼계열 공용 의상의 빨간 치마입니다. 학원에서 대여합니다.',
    den: 'The red chima of the shared drum-dance costume. Lent by the academy.' },
  { slug: 'underskirt-pale-yellow', sort: 512,
    ko: '연노랑 속치마', en: 'Pale Yellow Underskirt',
    dko: '드럼계열 공용 의상 안에 입는 연노랑 속치마입니다. 학원에서 대여합니다.',
    den: 'The pale yellow underskirt of the shared drum-dance costume. Lent by the academy.' },
  { slug: 'waist-sash-tassel', sort: 513,
    ko: '허리 술띠', en: 'Tasseled Waist Sash',
    dko: '드럼계열 공용 의상의 허리 술띠입니다. 학원에서 대여합니다.',
    den: 'The tasseled waist sash of the shared drum-dance costume. Lent by the academy.' },
  { slug: 'hair-flower-ornament', sort: 514,
    ko: '머리 꽃장식', en: 'Flower Hair Ornament',
    dko: '드럼계열 공용 의상의 머리 꽃장식입니다. 학원에서 대여합니다.',
    den: 'The flower hair ornament of the shared drum-dance costume. Lent by the academy.' },

  // 의상 — K Drum Ensemble
  { slug: 'jeogori-lilac-kdrum', sort: 520,
    ko: '연보라 저고리(K Drum)', en: 'Lilac Jeogori (K Drum)',
    dko: 'K Drum Ensemble 의상의 연보라 저고리입니다. 학원에서 대여합니다.',
    den: 'The lilac jeogori of the K Drum Ensemble costume. Lent by the academy.' },
  { slug: 'pants-lilac', sort: 521,
    ko: '연보라 바지', en: 'Lilac Pants',
    dko: 'K Drum Ensemble 의상의 연보라 바지입니다. 학원에서 대여합니다.',
    den: 'The lilac pants of the K Drum Ensemble costume. Lent by the academy.' },
  { slug: 'headband-purple', sort: 522,
    ko: '보라색 머리띠', en: 'Purple Headband',
    dko: 'K Drum Ensemble 의상의 보라색 머리띠입니다. 학원에서 대여합니다.',
    den: 'The purple headband of the K Drum Ensemble costume. Lent by the academy.' },
  { slug: 'wrist-guards', sort: 523,
    ko: '손목 아대', en: 'Wrist Guards',
    dko: 'K Drum Ensemble 연주 때 손목을 보호하는 아대입니다. 학원에서 대여합니다.',
    den: 'Wrist guards worn while playing in the K Drum Ensemble. Lent by the academy.' },
  { slug: 'belt-kdrum', sort: 524,
    ko: '허리띠(K Drum)', en: 'Waist Belt (K Drum)',
    dko: 'K Drum Ensemble 의상의 허리띠입니다. 학원에서 대여합니다.',
    den: 'The waist belt of the K Drum Ensemble costume. Lent by the academy.' },

  // 의상 — 아리랑 환타지
  { slug: 'jeogori-lilac-arirang', sort: 530,
    ko: '연보라 저고리(아리랑)', en: 'Lilac Jeogori (Arirang)',
    dko: '아리랑 환타지 의상의 연보라 저고리입니다. 학원에서 대여합니다.',
    den: 'The lilac jeogori of the Arirang Fantasy costume. Lent by the academy.' },
  { slug: 'skirt-lilac', sort: 531,
    ko: '연보라 치마', en: 'Lilac Chima',
    dko: '아리랑 환타지 의상의 연보라 치마입니다. 학원에서 대여합니다.',
    den: 'The lilac chima of the Arirang Fantasy costume. Lent by the academy.' },
  { slug: 'waist-skirt-lilac-gradient', sort: 532,
    ko: '연보라 그라데이션 허리치마', en: 'Lilac Gradient Waist Skirt',
    dko: '아리랑 환타지 의상 위에 두르는 연보라 그라데이션 허리치마입니다. 연습용 허리치마와는 다른 공연 의상입니다. 학원에서 대여합니다.',
    den: 'The lilac gradient waist skirt worn over the Arirang Fantasy costume — a stage piece distinct from the practice waist skirt. Lent by the academy.' },
  { slug: 'belt-saekdong', sort: 533,
    ko: '색동 벨트', en: 'Saekdong Belt',
    dko: '아리랑 환타지 의상의 색동 무늬 벨트입니다. 학원에서 대여합니다.',
    den: 'The multicolor saekdong belt of the Arirang Fantasy costume. Lent by the academy.' },
  { slug: 'hair-ornament-jewel-flower', sort: 534,
    ko: '보석 꽃머리장식', en: 'Jeweled Flower Hair Ornament',
    dko: '아리랑 환타지 의상의 보석 꽃머리장식입니다. 학원에서 대여합니다.',
    den: 'The jeweled flower hair ornament of the Arirang Fantasy costume. Lent by the academy.' },

  // 의상 — 검계열 공용 (경고춤·검무)
  { slug: 'jeogori-black', sort: 540,
    ko: '검정 저고리', en: 'Black Jeogori',
    dko: '경고춤과 검무가 함께 입는 검정 저고리입니다. 학원에서 대여합니다.',
    den: 'The black jeogori shared by Gyeonggo dance and Geommu. Lent by the academy.' },
  { slug: 'skirt-black-red', sort: 541,
    ko: '검정·빨강 치마', en: 'Black-and-Red Chima',
    dko: '경고춤과 검무가 함께 입는 검정·빨강 치마입니다. 학원에서 대여합니다.',
    den: 'The black-and-red chima shared by Gyeonggo dance and Geommu. Lent by the academy.' },
  { slug: 'underpants-green', sort: 542,
    ko: '초록 속바지', en: 'Green Under-pants',
    dko: '경고춤·검무 의상 안에 입는 초록 속바지입니다. 학원에서 대여합니다.',
    den: 'Green under-pants worn under the Gyeonggo/Geommu costumes. Lent by the academy.' },
  { slug: 'underskirt-light-green', sort: 543,
    ko: '연두색 속치마', en: 'Light Green Underskirt',
    dko: '경고춤·검무 의상 안에 입는 연두색 속치마입니다. 학원에서 대여합니다.',
    den: 'The light green underskirt worn under the Gyeonggo/Geommu costumes. Lent by the academy.' },
  { slug: 'belt-red', sort: 544,
    ko: '빨강 허리띠', en: 'Red Waist Belt',
    dko: '경고춤 의상의 빨강 허리띠입니다. 학원에서 대여합니다.',
    den: 'The red waist belt of the Gyeonggo dance costume. Lent by the academy.' },
  { slug: 'hair-ornament-gyeonggo', sort: 545,
    ko: '머리장식(경고춤)', en: 'Hair Ornament (Gyeonggo)',
    dko: '경고춤 의상의 머리장식입니다. 학원에서 대여합니다.',
    den: 'The hair ornament of the Gyeonggo dance costume. Lent by the academy.' },
  { slug: 'belt-geommu', sort: 546,
    ko: '검무용 허리띠', en: 'Geommu Waist Belt',
    dko: '검무 의상의 허리띠입니다. 학원에서 대여합니다.',
    den: 'The waist belt of the Geommu (sword dance) costume. Lent by the academy.' },
  { slug: 'hair-ornament-geommu-side', sort: 547,
    ko: '옆 머리장식(검무)', en: 'Side Hair Ornament (Geommu)',
    dko: '검무 의상의 옆 머리장식입니다. 학원에서 대여합니다.',
    den: 'The side hair ornament of the Geommu costume. Lent by the academy.' },
];

// ── 세트 ─────────────────────────────────────────────────────────────────
// items: supply_items.slug 목록(순서 유지). 기존 항목 slug(hair-tie 등) 참조 가능.
// sort_order 블록: 10 개인 키트 | 20 의상 세트 | 30 무대 세트
const SETS = [
  { slug: 'kit-hair', sort: 10,
    ko: '헤어 키트', en: 'Hair Kit',
    dko: '수업·공연 머리 단장에 필요한 개인 헤어용품 묶음입니다. 전 종목 공통으로 개인이 준비합니다.',
    den: 'Personal hair supplies for class and performances. Common to all repertoires; students bring their own.',
    items: ['hair-spray', 'hair-gel-wax', 'hair-tie', 'hair-net', 'hair-pin-u', 'hair-pin-bobby', 'tail-comb'] },
  { slug: 'kit-makeup', sort: 11,
    ko: '공연 메이크업 키트', en: 'Performance Makeup Kit',
    dko: '공연 당일 필요한 무대 메이크업 개인 준비물 묶음입니다. 위생상 반드시 개인 물품을 사용합니다.',
    den: 'Personal stage makeup for performance days. Each dancer uses their own for hygiene.',
    items: ['foundation-stick', 'powder-pact', 'eyebrow-pencil', 'eyeshadow', 'eyeliner',
      'mascara', 'blusher', 'lipstick', 'makeup-puff-brush', 'makeup-fixer'] },
  { slug: 'kit-class-basics', sort: 12,
    ko: '수업 기본 준비물', en: 'Class Basics',
    dko: '첫 수업부터 필요한 기본 개인 준비물입니다.',
    den: 'The basic personal items needed from the first class.',
    items: ['waist-skirt-practice', 'hair-tie', 'water-bottle'] },
  { slug: 'set-janggu-sticks', sort: 13,
    ko: '장구채(궁채+열채)', en: 'Janggu Sticks Pair',
    dko: '장구는 양손이 서로 다른 채를 씁니다. 궁채(왼손)와 열채(오른손)를 한 벌로 준비합니다. 개인 구매를 권장합니다.',
    den: 'Janggu uses a different stick in each hand — gungchae (left) and yeolchae (right) as one pair. Personal purchase recommended.',
    items: ['janggu-gungchae', 'janggu-yeolchae'] },

  { slug: 'costume-buchaechum', sort: 20,
    ko: '부채춤 의상 세트', en: 'Buchaechum Costume Set',
    dko: '부채춤 공연 의상 일습입니다. 학원에서 사이즈에 맞춰 대여하고 공연 후 회수합니다.',
    den: 'The full fan dance costume, fitted and lent by the academy and collected after the performance.',
    items: ['jeogori-dangui-yellow', 'skirt-purple', 'underskirt-pink', 'underpants-white'] },
  { slug: 'costume-drum-base', sort: 21,
    ko: '드럼계열 공용 의상 세트', en: 'Drum-Dance Shared Costume Set',
    dko: '동고·삼고무·오고무·장구춤 4개 종목이 함께 입는 공용 의상 일습입니다. 학원에서 대여합니다.',
    den: 'The shared costume worn for Donggo, Samgomu, Ogomu, and Janggu dance. Lent by the academy.',
    items: ['jeogori-jade', 'skirt-red', 'underskirt-pale-yellow', 'underpants-white',
      'waist-sash-tassel', 'hair-flower-ornament'] },
  { slug: 'costume-kdrum', sort: 22,
    ko: 'K Drum Ensemble 의상 세트', en: 'K Drum Ensemble Costume Set',
    dko: 'K Drum Ensemble 공연 의상 일습입니다. 학원에서 대여합니다.',
    den: 'The full K Drum Ensemble costume. Lent by the academy.',
    items: ['jeogori-lilac-kdrum', 'pants-lilac', 'headband-purple', 'wrist-guards', 'belt-kdrum'] },
  { slug: 'costume-arirang', sort: 23,
    ko: '아리랑 환타지 의상 세트', en: 'Arirang Fantasy Costume Set',
    dko: '아리랑 환타지 공연 의상 일습입니다. 학원에서 대여합니다.',
    den: 'The full Arirang Fantasy costume. Lent by the academy.',
    items: ['jeogori-lilac-arirang', 'skirt-lilac', 'waist-skirt-lilac-gradient',
      'belt-saekdong', 'hair-ornament-jewel-flower'] },
  { slug: 'costume-gyeonggochum', sort: 24,
    ko: '경고춤 의상 세트', en: 'Gyeonggo Dance Costume Set',
    dko: '경고춤 공연 의상 일습입니다. 저고리·치마·속옷은 검무와 함께 쓰고, 빨강 허리띠와 머리장식으로 구분합니다. 학원에서 대여합니다.',
    den: 'The Gyeonggo dance costume. The base pieces are shared with Geommu; the red belt and hair ornament set it apart. Lent by the academy.',
    items: ['jeogori-black', 'skirt-black-red', 'underpants-green', 'underskirt-light-green',
      'belt-red', 'hair-ornament-gyeonggo'] },
  { slug: 'costume-geommu', sort: 25,
    ko: '검무 의상 세트', en: 'Geommu Costume Set',
    dko: '검무 공연 의상 일습입니다. 저고리·치마·속옷은 경고춤과 함께 쓰고, 검무용 허리띠와 옆 머리장식으로 구분합니다. 학원에서 대여합니다.',
    den: 'The Geommu costume. The base pieces are shared with Gyeonggo dance; the Geommu belt and side hair ornament set it apart. Lent by the academy.',
    items: ['jeogori-black', 'skirt-black-red', 'underpants-green', 'underskirt-light-green',
      'belt-geommu', 'hair-ornament-geommu-side'] },

  { slug: 'stage-samgomu', sort: 30,
    ko: '삼고무 무대 세트', en: 'Samgomu Stage Set',
    dko: '삼고무 공연에 반출하는 악기·채 묶음입니다. 학원에서 준비합니다.',
    den: 'The instruments and sticks taken out for a Samgomu performance. Provided by the academy.',
    items: ['samgomu-drums', 'drumsticks-basic'] },
  { slug: 'stage-ogomu', sort: 31,
    ko: '오고무 무대 세트', en: 'Ogomu Stage Set',
    dko: '오고무 공연에 반출하는 악기·채 묶음입니다. 북채는 기본 북채를 함께 씁니다(전용 채 여부 확인 중). 학원에서 준비합니다.',
    den: 'The instruments and sticks for an Ogomu performance. Uses the basic drumsticks (dedicated sticks to be confirmed). Provided by the academy.',
    items: ['ogomu-drums', 'drumsticks-basic'] },
  { slug: 'stage-jangguchum', sort: 32,
    ko: '장구춤 무대 세트', en: 'Janggu Dance Stage Set',
    dko: '장구춤 공연에 반출하는 장구와 채 묶음입니다. 학원에서 준비합니다.',
    den: 'The janggu and sticks for a janggu dance performance. Provided by the academy.',
    items: ['janggu', 'janggu-gungchae', 'janggu-yeolchae'] },
  { slug: 'stage-nanta', sort: 33,
    ko: '기본난타 무대 세트', en: 'Basic Nanta Stage Set',
    dko: '기본난타 공연에 반출하는 북·채 묶음입니다. 학원에서 준비합니다.',
    den: 'The drums and sticks for a basic Nanta performance. Provided by the academy.',
    items: ['nanta-drum', 'drumsticks-basic'] },
  { slug: 'stage-kdrum', sort: 34,
    ko: 'K Drum Ensemble 무대 세트', en: 'K Drum Ensemble Stage Set',
    dko: 'K Drum Ensemble 공연에 반출하는 메가드럼과 전용 북채 묶음입니다. 학원에서 준비합니다.',
    den: 'The mega drums and dedicated sticks for a K Drum Ensemble performance. Provided by the academy.',
    items: ['mega-drum', 'drumsticks-kdrum'] },
  { slug: 'stage-jindobuk', sort: 35,
    ko: '진도북춤 무대 세트', en: 'Jindo Drum Dance Stage Set',
    dko: '진도북춤 공연에 반출하는 진도북과 양손 북채 묶음입니다. 학원에서 준비합니다.',
    den: 'The Jindo buk and two-handed sticks for a Jindo drum dance performance. Provided by the academy.',
    items: ['jindobuk', 'drumsticks-jindobuk'] },
  { slug: 'stage-talchum', sort: 36,
    ko: '탈춤 소품 세트', en: 'Talchum Prop Set',
    dko: '탈춤 공연에 반출하는 탈과 한삼 묶음입니다. 학원에서 준비합니다.',
    den: 'The mask and hansam sleeves for a Talchum performance. Provided by the academy.',
    items: ['hansam-talchum', 'tal-mask'] },
];

// ── 실행 ─────────────────────────────────────────────────────────────────
async function main() {
  // 1) 품목: slug 기준으로 없는 것만 삽입
  const existingItems = (await d1('SELECT id, slug FROM supply_items')).results;
  const itemIdBySlug = new Map(existingItems.map((r) => [r.slug, r.id]));

  let createdItems = 0;
  for (const it of ITEMS) {
    if (itemIdBySlug.has(it.slug)) continue;
    const res = await d1(
      `INSERT INTO supply_items
        (slug, name_ko, name_en, description_ko, description_en, glossary_term_id, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [it.slug, it.ko, it.en, it.dko, it.den, it.term ?? null, it.sort]
    );
    itemIdBySlug.set(it.slug, res.meta.last_row_id);
    createdItems++;
  }
  console.log(`품목: ${createdItems}개 생성 (기존 ${existingItems.length}개 유지)`);

  // 2) 세트: 새로 만들 때만 구성 항목을 채움 (기존 세트·수동 편집 보존)
  const existingSets = (await d1('SELECT id, slug FROM supply_sets')).results;
  const setIdBySlug = new Map(existingSets.map((r) => [r.slug, r.id]));

  let createdSets = 0;
  for (const set of SETS) {
    if (setIdBySlug.has(set.slug)) {
      console.log(`  세트 유지: ${set.slug}`);
      continue;
    }
    const res = await d1(
      `INSERT INTO supply_sets (slug, name_ko, name_en, description_ko, description_en, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [set.slug, set.ko, set.en, set.dko, set.den, set.sort]
    );
    const setId = res.meta.last_row_id;
    setIdBySlug.set(set.slug, setId);
    let order = 0;
    for (const itemSlug of set.items) {
      const itemId = itemIdBySlug.get(itemSlug);
      if (!itemId) {
        console.warn(`  ⚠ ${set.slug}: 품목 slug 미발견 — ${itemSlug} (건너뜀)`);
        continue;
      }
      await d1(
        'INSERT INTO supply_set_items (set_id, supply_item_id, sort_order) VALUES (?, ?, ?)',
        [setId, itemId, order++]
      );
    }
    createdSets++;
    console.log(`  세트 생성: ${set.ko} (${set.items.length}개 구성)`);
  }
  console.log(`세트: ${createdSets}개 생성 (기존 ${existingSets.length}개 유지)`);
}

main().catch((e) => {
  console.error('시딩 실패:', e.message);
  process.exit(1);
});
