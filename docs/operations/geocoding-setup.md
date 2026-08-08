# 주소 검색(지오코딩) 설정

공연 편집 화면의 "주소 검색"이 쓰는 제공자를 정한다.
**지도 표시와 주소 검색은 서로 다른 제공자를 쓴다** — 표시는 무료 OSM 임베드로 충분하지만,
주소 검색은 OSM으로 되지 않기 때문이다.

## 왜 바꿨나 (2026-08-08)

기존 지오코더는 Photon(OSM)이었다. Photon은 주소 파서가 아니라 **지명 유사어 검색**이라,
실제 주소를 넣으면 토큰이 겹치는 엉뚱한 장소를 **확신 있게** 돌려줬다.

```
질의: "1 Bergen County Plaza, Hackensack, NJ 07601"
 → Hackensack University Medical Plaza / Bergen County Courthouse /
   University Plaza Drive / Bergen County Jail …   (6개 전부 오답)
```

못 찾았다는 말을 하지 않는 것이 가장 나쁜 성질이었다. 관리자는 오답을 정답으로 착각한다.

같은 OSM 데이터를 구조화 지오코더(Nominatim)로 조회해도 **0건**이었다. 즉 데이터 자체가 없어
OSM 안에서는 도구를 바꿔도 해결되지 않는다. (대조군: `350 5th Ave, New York`과 학원 주소
`125 E Columbia Ave, Palisades Park`는 정상 조회 — OSM이 미국 주소 전반을 못 하는 건 아니고,
관공서·캠퍼스형 주소에 구멍이 많다. 공연장이 하필 그런 곳이 많다.)

## 설정 — Mapbox (현재 선택)

결제 수단 등록 없이 **월 100,000건 무료**다. 미국 주소 품질은 구글보다 조금 아래지만
OSM보다는 확실히 낫다.

1. https://account.mapbox.com/auth/signup 에서 가입 (카드 등록 불필요)
2. https://account.mapbox.com/access-tokens 에서 **Default public token** 복사
   (별도 토큰을 만들 거면 스코프는 기본값 그대로 두면 된다 — 지오코딩은 공개 스코프)
3. `.env.local`(및 Vercel 환경변수)에:

```
GEOCODE_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```

- **`NEXT_PUBLIC_` 접두사를 붙이지 말 것.** 붙이면 토큰이 번들에 들어가 남이 쓸 수 있다.
  지오코딩은 `/api/admin/geocode`(서버)에서만 호출한다.
- `GEOCODE_PROVIDER`를 지우면 예전 동작(OSM Photon)으로 떨어진다.
- 지도 표시는 그대로 OSM(무료)이다. `NEXT_PUBLIC_MAPS_PROVIDER`는 건드리지 않는다.

### 질의 방식

`country=us` 같은 하드 필터 대신 학원 근처(Palisades Park)로 **가중치**만 준다.
필터를 걸면 미국 밖 주소를 아예 못 찾게 되기 때문이다. 언어는 `en` — 주소는 현지
표기가 정답이고, 한국어로 번역하면 지도 앱에 붙여넣을 수 없다.

## 대안 — Google (품질 최상, 결제 등록 필요)

미국 관공서·캠퍼스 주소까지 가장 잘 찾는다. 월 $200 크레딧(약 40,000건) 내에서는
청구되지 않지만 **결제 수단 등록이 필요하다**.

```
GEOCODE_PROVIDER=google
GOOGLE_MAPS_API_KEY=<서버 전용 키>
```

콘솔에서 **Geocoding API만** 사용 설정하고, 키 제한은 `API 제한 = Geocoding API`.
**애플리케이션 제한(HTTP 리퍼러)은 걸지 말 것** — 서버 호출이라 리퍼러가 없어 거부된다.
필요하면 서버 고정 IP 제한을 쓴다.

## 확인 방법

관리자로 로그인한 뒤 공연 편집에서 주소를 검색한다. 또는:

```
curl -s "http://localhost:3000/api/admin/geocode?q=1+Bergen+County+Plaza,+Hackensack,+NJ" \
  -H "Cookie: <관리자 세션 쿠키>"
```

토큰이 없거나 잘못되면 조용히 빈 결과가 나오지 않고 502와 함께 서버 로그에 사유가 남는다
(`lib/maps/mapbox.test.ts`·`google.test.ts`가 이 동작을 잠그고 있다).

## 확인되지 않은 주소

검색으로 확인되지 않은 주소도 **저장된다**(예전에는 조용히 버려졌다). 다만 좌표가 없으므로
공개 페이지에 지도가 뜨지 않고, 편집 화면에 "확인되지 않은 주소" 안내가 뜬다.
구글이 "질의를 온전히 해석하지 못했다"(partial_match)고 알려 준 결과는 제안 목록에서
'근사치 — 확인 필요' 배지로 구분한다.
