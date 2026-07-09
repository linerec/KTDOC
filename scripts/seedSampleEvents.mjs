#!/usr/bin/env node
/**
 * 샘플 이벤트 시더 (2010–2015)
 *
 * 타임라인·갤러리 개발/시연용 샘플 이벤트를 원격 D1에 넣는다.
 * D1은 원격 한 곳뿐(dev/prod 공유)이므로, 나중에 한 번에 정리할 수 있도록
 * 모든 샘플의 slug를 'sample-' 접두사로 표시한다.
 * 화면에서도 실제 데이터와 바로 구분되도록 제목에 '[테스트] '/'[TEST] '
 * 접두사를 붙여 넣는다(삭제 기준은 어디까지나 slug).
 *   - 정리: npm run cleanup:sample-events  (scripts/cleanupSampleEvents.mjs)
 *   - 멱등: slug UNIQUE + INSERT OR IGNORE — 재실행해도 중복 생성 없음.
 *
 * 사용: npm run seed:sample-events
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

// ── 샘플 데이터 ──────────────────────────────────────────────────────────
// cat: event_categories.slug (competition | festival | corporate | cultural | other)
// featured: 갤러리/타임라인에서 강조 표시
const SAMPLE_EVENTS = [
  // 2010
  { slug: 'sample-2010-lunar-new-year', date: '2010-02-13', cat: 'cultural', featured: 1,
    ko: '설날 경축 한마당', en: 'Lunar New Year Celebration',
    dko: '한인 커뮤니티와 함께한 설날 경축 무대. 부채춤과 소고춤으로 새해의 시작을 열었습니다.',
    den: 'A Lunar New Year stage with the Korean community, opening the year with fan dance and sogo drum dance.',
    loc: '팰리세이즈파크 공립도서관' },
  { slug: 'sample-2010-cherry-blossom', date: '2010-04-11', cat: 'festival', featured: 0,
    ko: '뉴저지 벚꽃축제 초청공연', en: 'NJ Cherry Blossom Festival Performance',
    dko: '브랜치브룩 파크 벚꽃축제에 초청되어 한국 전통무용을 선보였습니다.',
    den: 'Invited performance of Korean traditional dance at the Branch Brook Park Cherry Blossom Festival.',
    loc: 'Branch Brook Park, Newark' },
  { slug: 'sample-2010-school-culture-day', date: '2010-05-22', cat: 'cultural', featured: 0,
    ko: '학교 한국문화의 날', en: 'Korean Culture Day at School',
    dko: '지역 초등학교의 문화의 날 행사에서 어린이들과 함께 전통춤을 배우고 나눴습니다.',
    den: 'Shared and taught traditional dance with children at a local elementary school culture day.',
    loc: '테너플라이 초등학교' },
  { slug: 'sample-2010-liberation-day', date: '2010-08-14', cat: 'cultural', featured: 0,
    ko: '광복절 기념 공연', en: 'Liberation Day Commemoration',
    dko: '광복절을 기념하는 커뮤니티 행사에서 태평무와 진도북춤을 올렸습니다.',
    den: 'Performed Taepyeongmu and Jindo drum dance at the community Liberation Day commemoration.',
    loc: '뉴저지 한인회관' },
  { slug: 'sample-2010-chuseok', date: '2010-09-25', cat: 'festival', featured: 1,
    ko: '추석 대잔치', en: 'Chuseok Festival',
    dko: '오버펙 파크에서 열린 추석 대잔치의 메인 무대. 강강술래로 관객과 하나가 되었습니다.',
    den: 'Main stage of the Chuseok Festival at Overpeck Park, joining the audience in Ganggangsullae.',
    loc: 'Overpeck County Park' },
  { slug: 'sample-2010-year-end-recital', date: '2010-12-18', cat: 'other', featured: 0,
    ko: '춤누리 연말 정기공연', en: 'Choomnoori Year-End Recital',
    dko: '한 해의 배움을 무대에 올리는 정기공연. 전 원생이 참여한 첫 대형 무대였습니다.',
    den: 'Annual recital presenting a year of learning — our first large stage with every student participating.',
    loc: '포트리 고등학교 강당' },

  // 2011
  { slug: 'sample-2011-lunar-new-year', date: '2011-02-05', cat: 'cultural', featured: 0,
    ko: '설날 민속 한마당', en: 'Lunar New Year Folk Festival',
    dko: '전통 민속놀이와 함께한 설날 무대. 어린이 사물놀이팀이 처음 데뷔했습니다.',
    den: 'A Lunar New Year stage with folk games, featuring the debut of our children’s samulnori team.',
    loc: '뉴저지 한인회관' },
  { slug: 'sample-2011-childrens-day', date: '2011-05-07', cat: 'festival', featured: 0,
    ko: '어린이날 문화축제', en: 'Children’s Day Culture Festival',
    dko: '어린이날을 맞아 열린 문화축제에서 꼭두각시춤과 소고춤을 선보였습니다.',
    den: 'Performed puppet dance and sogo drum dance at the Children’s Day culture festival.',
    loc: '릿지필드 커뮤니티센터' },
  { slug: 'sample-2011-multicultural-festival', date: '2011-06-18', cat: 'festival', featured: 0,
    ko: '다문화 축제 초청공연', en: 'Multicultural Festival Performance',
    dko: '버겐카운티 다문화 축제에서 한국 대표로 무대에 올라 부채춤을 선보였습니다.',
    den: 'Represented Korea at the Bergen County Multicultural Festival with a fan dance performance.',
    loc: 'Bergen County Plaza' },
  { slug: 'sample-2011-chuseok', date: '2011-09-10', cat: 'festival', featured: 0,
    ko: '추석 잔치', en: 'Chuseok Celebration',
    dko: '한가위 보름달 아래 열린 추석 잔치에서 전통무용과 민요 무대를 함께했습니다.',
    den: 'Traditional dance and folk song stage under the full harvest moon at the Chuseok celebration.',
    loc: 'Overpeck County Park' },
  { slug: 'sample-2011-korean-parade', date: '2011-10-01', cat: 'festival', featured: 1,
    ko: '뉴욕 코리안 퍼레이드', en: 'Korean Parade in New York',
    dko: '맨해튼에서 열린 코리안 퍼레이드에 참가해 거리 위에서 전통춤 행렬을 이끌었습니다.',
    den: 'Led a traditional dance procession through Manhattan at the annual Korean Parade.',
    loc: '6th Avenue, Manhattan' },
  { slug: 'sample-2011-gukak-competition', date: '2011-11-12', cat: 'competition', featured: 0,
    ko: '동부지역 국악경연대회', en: 'East Coast Gukak Competition',
    dko: '동부지역 국악경연대회에 원생들이 출전해 무용 부문 단체상을 수상했습니다.',
    den: 'Our students competed at the East Coast Gukak Competition, winning the group award in dance.',
    loc: '뉴저지 문화예술회관' },
  { slug: 'sample-2011-year-end-recital', date: '2011-12-17', cat: 'other', featured: 0,
    ko: '연말 정기공연', en: 'Year-End Recital',
    dko: '두 번째 정기공연. 살풀이춤과 장구춤 등 심화 과정 무대가 더해졌습니다.',
    den: 'Our second annual recital, adding advanced stages including salpuri and janggu dance.',
    loc: '포트리 고등학교 강당' },

  // 2012
  { slug: 'sample-2012-lunar-new-year', date: '2012-01-28', cat: 'cultural', featured: 0,
    ko: '설날 경축 공연', en: 'Lunar New Year Performance',
    dko: '임진년 새해를 여는 경축 공연. 지역 어르신들을 모시고 세배와 무대를 함께했습니다.',
    den: 'A celebration opening the new year, sharing bows and performances with community elders.',
    loc: '팰리세이즈파크 시니어센터' },
  { slug: 'sample-2012-cherry-blossom', date: '2012-04-14', cat: 'festival', featured: 0,
    ko: '벚꽃축제 초청공연', en: 'Cherry Blossom Festival Performance',
    dko: '벚꽃이 만개한 공원에서 열린 축제 무대. 화관무로 봄의 정취를 담았습니다.',
    den: 'A festival stage among cherry blossoms in full bloom, capturing spring with hwagwanmu.',
    loc: 'Branch Brook Park, Newark' },
  { slug: 'sample-2012-kaa-gala', date: '2012-06-09', cat: 'corporate', featured: 0,
    ko: '한인회 초청 갈라 공연', en: 'Korean American Association Gala',
    dko: '뉴저지 한인회 연례 갈라에 초청되어 축하 무대를 꾸몄습니다.',
    den: 'Invited celebratory stage at the annual New Jersey Korean American Association gala.',
    loc: '더블트리 호텔 포트리' },
  { slug: 'sample-2012-liberation-day', date: '2012-08-15', cat: 'cultural', featured: 0,
    ko: '광복절 경축식 공연', en: 'Liberation Day Ceremony Performance',
    dko: '광복절 경축식에서 태평무를 올려 광복의 의미를 되새겼습니다.',
    den: 'Performed Taepyeongmu at the Liberation Day ceremony, honoring the meaning of liberation.',
    loc: '뉴저지 한인회관' },
  { slug: 'sample-2012-chuseok', date: '2012-09-29', cat: 'festival', featured: 1,
    ko: '추석 대잔치', en: 'Chuseok Festival',
    dko: '역대 최대 규모로 열린 추석 대잔치. 사물놀이와 강강술래로 잔치의 대미를 장식했습니다.',
    den: 'Our largest Chuseok Festival yet, closing with samulnori and Ganggangsullae.',
    loc: 'Overpeck County Park' },
  { slug: 'sample-2012-korean-parade', date: '2012-10-06', cat: 'festival', featured: 0,
    ko: '코리안 퍼레이드', en: 'Korean Parade',
    dko: '두 번째로 참가한 코리안 퍼레이드. 전통 혼례 행렬을 재현해 큰 호응을 얻었습니다.',
    den: 'Our second Korean Parade, recreating a traditional wedding procession to great applause.',
    loc: '6th Avenue, Manhattan' },
  { slug: 'sample-2012-year-end-recital', date: '2012-12-15', cat: 'other', featured: 0,
    ko: '정기공연 「몸짓으로 잇는 세월」', en: 'Annual Recital: Years Woven in Motion',
    dko: '주제가 있는 첫 정기공연. 세대를 잇는 전통의 몸짓을 무대 하나로 엮었습니다.',
    den: 'Our first themed recital, weaving generations of traditional movement into a single stage.',
    loc: '버겐 퍼포밍아츠센터' },

  // 2013
  { slug: 'sample-2013-lunar-new-year', date: '2013-02-09', cat: 'cultural', featured: 0,
    ko: '설날 한마당', en: 'Lunar New Year Festival',
    dko: '계사년 설날 한마당에서 지신밟기와 함께 새해 복을 나눴습니다.',
    den: 'Shared new year blessings with jisinbalgi at the Lunar New Year festival.',
    loc: '뉴저지 한인회관' },
  { slug: 'sample-2013-spring-outreach', date: '2013-05-11', cat: 'cultural', featured: 0,
    ko: '봄맞이 문화 나눔 공연', en: 'Spring Culture Outreach',
    dko: '지역 양로원을 찾아 어르신들께 위로와 활력을 전한 문화 나눔 무대입니다.',
    den: 'An outreach stage bringing comfort and energy to elders at a local nursing home.',
    loc: '버겐카운티 양로원' },
  { slug: 'sample-2013-multicultural-festival', date: '2013-06-22', cat: 'festival', featured: 0,
    ko: '다문화 어울림 축제', en: 'Multicultural Harmony Festival',
    dko: '여러 나라의 전통예술이 한자리에 모인 축제에서 한국의 멋을 알렸습니다.',
    den: 'Showcased the beauty of Korea at a festival gathering traditional arts from around the world.',
    loc: 'Liberty State Park' },
  { slug: 'sample-2013-chuseok', date: '2013-09-14', cat: 'festival', featured: 0,
    ko: '추석 잔치', en: 'Chuseok Celebration',
    dko: '한가위 잔치에서 진도북춤과 민요 한마당으로 흥을 돋웠습니다.',
    den: 'Raised the festive spirit with Jindo drum dance and folk songs at the Chuseok celebration.',
    loc: 'Overpeck County Park' },
  { slug: 'sample-2013-korean-festival', date: '2013-10-05', cat: 'festival', featured: 1,
    ko: '한국의 날 축제', en: 'Korean Day Festival',
    dko: '한국의 날 축제 메인 무대에 올라 부채춤·장구춤·사물놀이를 연이어 선보였습니다.',
    den: 'Headlined the Korean Day Festival with fan dance, janggu dance, and samulnori in succession.',
    loc: '팰리세이즈파크 브로드애비뉴' },
  { slug: 'sample-2013-youth-competition', date: '2013-11-09', cat: 'competition', featured: 0,
    ko: '청소년 국악경연대회', en: 'Youth Gukak Competition',
    dko: '청소년 국악경연대회 무용 부문에서 원생 두 명이 개인상을 받았습니다.',
    den: 'Two of our students received individual awards in dance at the Youth Gukak Competition.',
    loc: '뉴욕 한국문화원' },
  { slug: 'sample-2013-year-end-recital', date: '2013-12-21', cat: 'other', featured: 0,
    ko: '연말 정기공연', en: 'Year-End Recital',
    dko: '다섯 번째 해를 마무리하는 정기공연. 졸업생 특별 무대가 처음 마련되었습니다.',
    den: 'The recital closing our fifth year, featuring the first special stage by graduating students.',
    loc: '버겐 퍼포밍아츠센터' },

  // 2014
  { slug: 'sample-2014-lunar-new-year', date: '2014-01-31', cat: 'cultural', featured: 0,
    ko: '설날 경축 한마당', en: 'Lunar New Year Celebration',
    dko: '갑오년 설날 무대. 어린이 한복 패션쇼와 전통춤이 어우러졌습니다.',
    den: 'A Lunar New Year stage blending a children’s hanbok fashion show with traditional dance.',
    loc: '뉴저지 한인회관' },
  { slug: 'sample-2014-cherry-blossom', date: '2014-04-12', cat: 'festival', featured: 0,
    ko: '벚꽃축제 초청공연', en: 'Cherry Blossom Festival Performance',
    dko: '봄비 속에서도 이어진 벚꽃축제 무대. 우중 공연이 오히려 깊은 인상을 남겼습니다.',
    den: 'A festival stage that carried on through spring rain, leaving an even deeper impression.',
    loc: 'Branch Brook Park, Newark' },
  { slug: 'sample-2014-corporate-gala', date: '2014-05-31', cat: 'corporate', featured: 0,
    ko: '기업 문화행사 초청공연', en: 'Corporate Culture Event Performance',
    dko: '한국 기업 미주법인의 창립 기념 행사에서 축하 무대를 선보였습니다.',
    den: 'Celebratory performance at the founding anniversary of a Korean company’s US branch.',
    loc: '메리어트 티넥' },
  { slug: 'sample-2014-summer-camp-showcase', date: '2014-08-09', cat: 'other', featured: 0,
    ko: '여름 전통예술 캠프 발표회', en: 'Summer Traditional Arts Camp Showcase',
    dko: '2주간의 여름 캠프를 마친 아이들이 배운 무용과 장단을 가족 앞에서 발표했습니다.',
    den: 'Children presented the dances and rhythms from a two-week summer camp before their families.',
    loc: '춤누리 스튜디오' },
  { slug: 'sample-2014-chuseok', date: '2014-09-06', cat: 'festival', featured: 1,
    ko: '추석 대잔치', en: 'Chuseok Festival',
    dko: '보름달 아래 펼쳐진 추석 대잔치. 화관무와 강강술래로 큰 박수를 받았습니다.',
    den: 'A Chuseok Festival under the full moon, earning warm applause with hwagwanmu and Ganggangsullae.',
    loc: 'Overpeck County Park' },
  { slug: 'sample-2014-korean-parade', date: '2014-10-04', cat: 'festival', featured: 0,
    ko: '코리안 퍼레이드', en: 'Korean Parade',
    dko: '맨해튼 코리안 퍼레이드에서 대형 태극기 행렬과 함께 전통춤을 선보였습니다.',
    den: 'Performed traditional dance alongside a grand Taegukgi procession at the Korean Parade.',
    loc: '6th Avenue, Manhattan' },
  { slug: 'sample-2014-year-end-recital', date: '2014-12-20', cat: 'other', featured: 0,
    ko: '연말 정기공연', en: 'Year-End Recital',
    dko: '여섯 번째 정기공연. 학부모 특별 출연 무대가 더해져 온 가족의 잔치가 되었습니다.',
    den: 'Our sixth recital, becoming a family celebration with a special stage by parents.',
    loc: '버겐 퍼포밍아츠센터' },

  // 2015
  { slug: 'sample-2015-lunar-new-year', date: '2015-02-21', cat: 'cultural', featured: 0,
    ko: '설날 민속 큰잔치', en: 'Lunar New Year Grand Festival',
    dko: '을미년 설날 큰잔치에서 전통 민속놀이 체험과 축하 무대를 함께 열었습니다.',
    den: 'Opened the year with folk game experiences and a celebratory stage at the grand festival.',
    loc: '뉴저지 한인회관' },
  { slug: 'sample-2015-spring-festival', date: '2015-04-25', cat: 'festival', featured: 0,
    ko: '봄 문화축제', en: 'Spring Culture Festival',
    dko: '지역 봄 축제에서 어린이팀과 성인팀이 함께 무대에 올라 세대의 어울림을 보여줬습니다.',
    den: 'Children and adult teams shared the stage at the spring festival, showing harmony across generations.',
    loc: '릿지필드파크 타운축제' },
  { slug: 'sample-2015-friendship-night', date: '2015-06-13', cat: 'corporate', featured: 0,
    ko: '한미 우호의 밤 초청공연', en: 'Korea-US Friendship Night Performance',
    dko: '한미 우호의 밤 행사에 초청되어 미국 주류사회에 한국 전통예술을 소개했습니다.',
    den: 'Introduced Korean traditional arts to mainstream American society at the Friendship Night gala.',
    loc: '뉴어크 시청 로툰다' },
  { slug: 'sample-2015-liberation-70th', date: '2015-08-15', cat: 'cultural', featured: 1,
    ko: '광복 70주년 기념 공연', en: '70th Anniversary of Liberation Performance',
    dko: '광복 70주년을 기념하는 대형 무대. 아리랑 연곡에 맞춘 군무로 깊은 감동을 전했습니다.',
    den: 'A grand stage for the 70th anniversary of liberation, moving audiences with an Arirang ensemble dance.',
    loc: '버겐 퍼포밍아츠센터' },
  { slug: 'sample-2015-chuseok', date: '2015-09-26', cat: 'festival', featured: 0,
    ko: '추석 한마당', en: 'Chuseok Festival',
    dko: '한가위 한마당에서 소고춤과 민요 메들리로 고향의 정취를 나눴습니다.',
    den: 'Shared the warmth of home with sogo drum dance and a folk song medley at the Chuseok festival.',
    loc: 'Overpeck County Park' },
  { slug: 'sample-2015-korean-parade', date: '2015-10-03', cat: 'festival', featured: 0,
    ko: '코리안 퍼레이드', en: 'Korean Parade',
    dko: '다섯 번째 참가한 코리안 퍼레이드. 풍물패 길놀이로 거리를 가득 채웠습니다.',
    den: 'Our fifth Korean Parade, filling the streets with a pungmul street procession.',
    loc: '6th Avenue, Manhattan' },
  { slug: 'sample-2015-year-end-recital', date: '2015-12-19', cat: 'other', featured: 0,
    ko: '정기공연 「춤으로 잇다」', en: 'Annual Recital: Connected by Dance',
    dko: '한 해를 마무리하는 정기공연. 창단 이후의 발자취를 영상과 무대로 함께 돌아봤습니다.',
    den: 'The year-end recital, looking back on our journey since founding through film and stage.',
    loc: '버겐 퍼포밍아츠센터' },
];

// ── 실행 ─────────────────────────────────────────────────────────────────
console.log(`대상: 원격 D1 — 샘플 이벤트 ${SAMPLE_EVENTS.length}건 (2010–2015)\n`);

const catRows = (await d1('SELECT id, slug FROM event_categories')).results;
const catId = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));

let inserted = 0;
let skipped = 0;

for (const ev of SAMPLE_EVENTS) {
  if (!catId[ev.cat]) {
    console.error(`FAIL ${ev.slug} — 카테고리 '${ev.cat}' 없음`);
    process.exit(1);
  }
  const year = parseInt(ev.date.slice(0, 4), 10);
  const { meta } = await d1(
    `INSERT OR IGNORE INTO events (
       slug, year, event_date, title_ko, title_en,
       description_ko, description_en, category_id,
       is_published, is_featured, location
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      ev.slug, year, ev.date, `[테스트] ${ev.ko}`, `[TEST] ${ev.en}`,
      ev.dko, ev.den, catId[ev.cat],
      ev.featured ? 1 : 0, ev.loc || null,
    ]
  );
  if (meta.changes > 0) {
    inserted++;
    console.log(`OK   ${ev.date}  ${ev.ko} (${ev.slug})`);
  } else {
    skipped++;
    console.log(`SKIP ${ev.date}  ${ev.ko} — 이미 존재`);
  }
}

console.log(`\n완료: 추가 ${inserted}건, 건너뜀 ${skipped}건.`);
console.log("정리하려면: npm run cleanup:sample-events (slug 'sample-%' 전부 삭제)");
