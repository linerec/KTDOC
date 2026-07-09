# KTDOC 수업·공연 준비물 정규화 문서

> 작성일: 2026-07-08
> 원본: 원장 제공 러프 정리본(수업·공연 준비물 / 헤어·메이크업 / 공연 의상 6종)
> 작성 방식: 데이터 모델러 · 전통무용 도메인 전문가 · 운영/물류 전문가 3인 관점의 병렬 분석을 종합
> 상태: **초안** — §9 확인 필요 사항이 해소되어야 확정본이 됨

---

## 1. 개요

원본 목록은 "준비물 / 북채 / 소품 / 악기 / 헤어 / 메이크업 / 의상(레퍼토리별)"으로 러프하게
나뉘어 있고, 여러 종목이 같은 품목을 중복 기재하고 있다. 이 문서는:

1. 전체 품목을 **원자 단위의 품목 마스터**로 정규화하고,
2. **"개인 준비물" vs "세트(학원 자산)"** 판정 기준을 세워 전 품목을 분류하고,
3. 함께 쓰이는 품목을 **세트/키트**로 묶고,
4. **레퍼토리(종목) × 필요물품 매트릭스**로 연결하고,
5. 향후 시스템화(D1)를 대비한 **데이터 모델 초안**을 제시한다.

### 구조 요약 (3층 모델)

```
품목(Item) ──< 세트 구성(set_items) >── 세트(Set)
                                          │
레퍼토리(Repertoire) ──< 필요물품(requirements) >──┘ (세트 또는 개별 품목 참조)
```

- **품목**: 더 쪼갤 수 없는 원자 단위. 색상·성별·소유구분·소모품 여부는 품목의 속성.
- **세트**: 함께 쓰이는 품목 묶음 — 의상 세트, 장구채(궁채+열채), 개인 키트.
- **레퍼토리**: 공연 종목. 세트/품목을 참조만 하고 소유하지 않는다(재사용이 핵심).

---

## 2. '개인 준비물' vs '세트(학원 자산)' 판정 기준

### 정의

- **개인 준비물**: 학생/학부모가 직접 구매·지참·관리·교체하는 품목.
  위생·소모·개인 맞춤 성격이 강해 공유가 부적절하거나 무의미한 것.
- **세트(학원 자산)**: 학원이 보유·구성·대여·회수하는 묶음 단위.
  무대 통일성·내구성·고가 특성 때문에 공동 관리가 효율적인 것.

### 판정 기준 축

| 기준 축 | 개인 쪽으로 | 학원 세트 쪽으로 |
|---|---|---|
| 위생성(피부·모발·타액 접촉) | 높음 → 공유 불가 | 낮음 → 공유 가능 |
| 소모성(사용 시 소진) | 높음 → 개인 교체 | 낮음 → 반복 사용 |
| 사이즈 개인화 | 높음(소모·연습품) | 높아도 학원이 사이즈별 재고로 흡수 |
| 고가·내구재 여부 | 저가·단명 | 고가·장기 사용 |
| 공연별 통일성(색·형태 일치) | 불필요 | 필수 → 학원 통제 |

**핵심 원리**: 위생·소모성이 높으면 **개인**, 통일성·고가·내구성이 높으면 **학원 세트**.
사이즈 개인화는 단독으로는 개인 귀속 근거가 되지 않는다 — 의상은 몸에 맞아야 하지만
무대 통일성상 학원이 사이즈별 재고로 대여하는 편이 유리하다.

### 판정 결과 요약

| 구분 | 품목군 | 근거 |
|---|---|---|
| **개인** | 헤어용품 전체, 공연 메이크업 전체 | 모발·피부 직접 접촉 + 소모품 |
| **개인** | 허리치마(연습용) | 매 수업 착용하는 개인 연습복 |
| **개인(권장) + 학원 예비분** | 기본 북채, 장구채(궁채+열채) | 그립이 손에 길들여지는 연습 도구, 저가 — 개인 구매 관행. 공연 분실 대비 학원 예비분 비치 |
| **학원** | 악기 전체(장구·난타북·메가드럼·삼고무북·오고무북·진도북) | 고가 내구 악기 |
| **학원** | K Drum 북채, 진도북 북채 | 전용 악기와 한 세트로 관리 |
| **학원** | 소고, 경고 | 통일·수량 관리가 필요한 휴대 타악 |
| **학원** | 한삼 2종, 검무용 칼, 탈, 꽃, 바구니 | 무대 통일 소품 (칼·탈은 안전·파손 관리 대상) |
| **학원** | 공연 의상 전체(6세트) | 무대 색·규격 통일, 사이즈별 재고 대여 |
| **보류** | 부채 3종(부채/산조/한량무) | 개인 애착 관행 vs 무대 통일 충돌 → §9 확인. 잠정: 공연용은 학원 규격 통일 대여, 연습용은 개인 선택 |
| **보류** | 살풀이 수건 | 위생성(개인) vs 통일 소품(학원) 경계 → §9 확인. 잠정: 학원 보유 + 공연 후 일괄 세탁 |

---

## 3. 정규화 결정 — 중복·변형 해소

원본에서 중복되거나 변형 관계인 항목의 처리 결정. **통합** = 하나의 품목으로 합침,
**분리** = 별도 품목으로 두되 `parent_type`(상위 유형)으로 묶음.

| 대상 | 결정 | 근거 |
|---|---|---|
| 흰 속바지 (부채춤·드럼계열 공통) | **통합** | 서술 완전 동일한 범용 속옷. 하나를 두 세트가 참조 |
| 검정 저고리·검정빨강 치마·초록 속바지·연두 속치마 (경고춤·검무 공통) | **통합 + 공유 서브세트화** | 4개 서술 동일 → "검계열 베이스 세트"로 묶고, 두 종목은 베이스 + 각자 허리띠·머리장식만 추가 |
| 연보라 저고리 (K Drum vs 아리랑 환타지) | **분리** (확인 필요) | K Drum은 바지·아대와 짝인 앙상블 유니폼, 아리랑은 치마와 짝 — 재단·장식이 다를 개연성. 동일 실물로 확인되면 통합 |
| 부채 3종 (부채·산조부채·한량무 부채) | **분리** + 유형 `부채` | 용도·대상 상이(한량무=남성용). 통합 불가 |
| 한삼 2종 (화관무·탈춤용) | **분리** + 유형 `한삼` | 길이·색 차이 개연성, 종목 전용 |
| 북채 4종 | **개별 품목**, 장구채만 세트 | 장구채 = 궁채(왼손, 방망이형) + 열채(오른손, 대나무) 2품목 1벌 — 반드시 세트로 관리 |
| 허리치마 (연습용 vs 아리랑 그라데이션) | **분리** + 유형 `허리치마` | 하나는 개인 연습복, 하나는 공연 의상 구성품 — 목적·소유구분이 다름 |
| 경고(품목) vs 경고춤(종목) | **네임스페이스 분리** | 이름만 충돌. 품목 `prop.gyeonggo` / 종목 `rep.gyeonggochum` |
| 드럼계열 4종목(동고·삼고무·오고무·장구춤) 의상 | **단일 공용 세트 → 4종목 매핑** | 한 세트가 4개 레퍼토리에 재사용되는 대표 사례 |
| 검정·빨강 치마 | 잠정 **투톤 1벌** (확인 필요) | 검정+빨강 2벌인지 투톤 1벌인지 원본만으로 불명 |
| 소고·경고의 카테고리 | 잠정 **소품 + 타악 겸용 태그** | 손에 들고 치며 추는 휴대 타악기 — "악기로 소리를 내는 소품". 이중 태깅이 도메인상 가장 정확하며 §9에서 확정 |

---

## 4. 품목 마스터 (정규화 후 68품목)

코드 규칙: `{category}.{type}.{qualifier}[.{variant}]` — 소문자·점 구분·불변.
색상은 유형 내 구분이 필요할 때만 코드에 포함. 성별·색상은 별도 속성으로도 저장.

### 4.1 연습·준비물 (prep) — 개인

| 표준명 | 코드 | 영문 | 비고 |
|---|---|---|---|
| 허리치마(연습용) | `prep.waistskirt.practice` | Practice waist skirt | 사이즈 있음. 아리랑 공연용 허리치마와 유형만 공유 |

### 4.2 북채 (stick)

| 표준명 | 코드 | 영문 | 소유 | 비고 |
|---|---|---|---|---|
| 기본 북채 | `stick.basic` | Bukchae (drumsticks, basic) | 개인 권장 | 삼고무·기본난타 공용, 1조(=한 쌍) |
| 궁채 | `stick.janggu.gung` | Gungchae (bass mallet) | 개인 권장 | 장구채 세트 구성품, 왼손 |
| 열채 | `stick.janggu.yeol` | Yeolchae (bamboo stick) | 개인 권장 | 장구채 세트 구성품, 오른손 |
| K Drum Ensemble 북채 | `stick.kdrum` | K Drum sticks | 학원 | 메가드럼과 한 세트, 1조 |
| 진도북 북채 | `stick.jindobuk` | Jindo Buk sticks | 학원 | 양손 채, 진도북과 한 세트 |

### 4.3 악기 (instrument) — 전부 학원 보유

| 표준명 | 코드 | 영문 |
|---|---|---|
| 장구 | `instrument.janggu` | Janggu (hourglass drum) |
| 기본난타용 북 | `instrument.nanta-drum` | Nanta drum |
| 메가드럼 | `instrument.megadrum` | Mega drum (창작 타악) |
| 삼고무 북 | `instrument.samgomu-buk` | Samgomu Buk (three-drum set) |
| 오고무 북 | `instrument.ogomu-buk` | Ogomu Buk (five-drum set) |
| 진도북 | `instrument.jindobuk` | Jindo Buk (Jindo drum) |

### 4.4 소품 (prop) — 전부 학원 보유 (부채·수건은 §9 확인 후 확정)

| 표준명 | 코드 | 영문 | 비고 |
|---|---|---|---|
| 부채 | `prop.fan.basic` | Buchae (fan) | 부채춤용, 유형 `부채` |
| 산조부채 | `prop.fan.sanjo` | Sanjo Buchae | 유형 `부채` |
| 한량무 부채(남) | `prop.fan.hallyangmu` | Hallyangmu fan (men's) | 유형 `부채`, gender=male |
| 소고 | `prop.sogo` | Sogo (small hand drum) | **타악 겸용** |
| 경고 | `prop.gyeonggo` | Gyeonggo (hand drum, 잠정) | **타악 겸용**, 명칭·정체 §9 확인 |
| 화관무 한삼 | `prop.hansam.hwagwanmu` | Hansam (Hwagwanmu) | 유형 `한삼` |
| 탈춤용 한삼 | `prop.hansam.talchum` | Hansam (Talchum) | 유형 `한삼` |
| 살풀이 수건 | `prop.salpuri-scarf` | Salpuri scarf | 소유 보류(§9) |
| 검무용 칼 | `prop.sword.geommu` | Geommu sword | 안전점검 대상 |
| 탈 | `prop.mask` | Tal (mask) | 파손 관리 대상 |
| 아리랑 꽃(꽃춤용) | `prop.flower.arirang` | Flower prop (Arirang) | 소모 가능성 |
| 봄동산 바구니 | `prop.basket.bomdongsan` | Basket prop (Bomdongsan) | |

### 4.5 의상 (costume) — 전부 학원 보유, 사이즈 관리 대상

**부채춤 세트**

| 표준명 | 코드 | 비고 |
|---|---|---|
| 노란 당의저고리 | `costume.jeogori.dangui.yellow` | |
| 보라 치마 | `costume.skirt.purple` | |
| 연분홍 속치마 | `costume.underskirt.pink` | |
| 흰 속바지 | `costume.underpants.white` | **드럼계열과 공유(통합)** |

**드럼계열 공용 세트** (동고·삼고무·오고무·장구춤)

| 표준명 | 코드 | 비고 |
|---|---|---|
| 비취 저고리 | `costume.jeogori.jade` | |
| 빨간 치마 | `costume.skirt.red` | |
| 연노랑 속치마 | `costume.underskirt.paleyellow` | |
| 흰 속바지 | (위와 동일 품목) | 공유 |
| 허리 술띠 | `costume.sash.waist` | |
| 머리 꽃장식 | `costume.hairornament.flower` | |

**K Drum Ensemble 세트**

| 표준명 | 코드 | 비고 |
|---|---|---|
| 연보라 저고리(K Drum) | `costume.jeogori.lilac.kdrum` | 아리랑 저고리와 분리(§9 확인) |
| 연보라 바지 | `costume.pants.lilac` | |
| 보라색 머리띠 | `costume.headband.purple` | |
| 손목 아대 | `costume.wristband` | |
| 허리띠(K Drum) | `costume.belt.kdrum` | |

**아리랑 환타지 세트**

| 표준명 | 코드 | 비고 |
|---|---|---|
| 연보라 저고리(아리랑) | `costume.jeogori.lilac.arirang` | K Drum 저고리와 분리(§9 확인) |
| 연보라 치마 | `costume.skirt.lilac` | |
| 연보라 그라데이션 허리치마 | `costume.waistskirt.lilac.gradient` | 연습 허리치마와 별개 |
| 색동 벨트 | `costume.belt.saekdong` | |
| 보석 꽃머리장식 | `costume.hairornament.jewelflower` | |

**검계열 베이스 세트** (경고춤·검무 공유)

| 표준명 | 코드 | 비고 |
|---|---|---|
| 검정 저고리 | `costume.jeogori.black` | **공유 통합** |
| 검정·빨강 치마 | `costume.skirt.black-red` | **공유 통합**, 투톤 1벌 가정(§9) |
| 초록 속바지 | `costume.underpants.green` | **공유 통합** |
| 연두색 속치마 | `costume.underskirt.lightgreen` | **공유 통합** |

**경고춤 전용 추가분**: 빨강 허리띠 `costume.belt.red`, 머리장식(경고춤) `costume.hairornament.gyeonggo`
**검무 전용 추가분**: 검무용 허리띠 `costume.belt.geommu`, 옆 머리장식(검무) `costume.hairornament.geommu.side`

### 4.6 헤어 (hair) — 전부 개인, 대부분 소모품

헤어스프레이 `hair.spray` · 헤어젤/왁스 `hair.gelwax` · 머리끈 `hair.tie` · 머리망 `hair.net` ·
U자핀 `hair.pin.u` · 실핀 `hair.pin.bobby` · 꼬리빗 `hair.comb.tail`

### 4.7 메이크업 (makeup) — 전부 개인, 소모품

스틱 파운데이션 `makeup.foundation.stick` · 파우더(팩트) `makeup.powder.pact` ·
아이브로우 `makeup.eyebrow` · 아이섀도우 `makeup.eyeshadow` · 아이라이너 `makeup.eyeliner` ·
마스카라 `makeup.mascara` · 블러셔 `makeup.blusher` · 립스틱/립틴트 `makeup.lip` ·
퍼프·브러시 `makeup.puffbrush` · 메이크업 픽서 `makeup.fixer`

---

## 5. 세트 정의

### 5.1 의상 세트 (학원 관리)

| 세트 | 코드 | 구성 | 대상 종목 |
|---|---|---|---|
| 부채춤 의상 | `set.costume.buchaechum` | 노란 당의저고리 + 보라 치마 + 연분홍 속치마 + 흰 속바지 | 부채춤 |
| 드럼계열 공용 의상 | `set.costume.drum-base` | 비취 저고리 + 빨간 치마 + 연노랑 속치마 + 흰 속바지 + 허리 술띠 + 머리 꽃장식 | **동고·삼고무·오고무·장구춤 4종목 재사용** — 수량은 최대 동시 출연 인원 기준 확보 |
| K Drum 의상 | `set.costume.kdrum` | 연보라 저고리(K) + 연보라 바지 + 보라 머리띠 + 손목 아대 + 허리띠 | K Drum Ensemble |
| 아리랑 환타지 의상 | `set.costume.arirang` | 연보라 저고리(아리랑) + 연보라 치마 + 그라데이션 허리치마 + 색동 벨트 + 보석 꽃머리장식 | 아리랑 환타지 |
| 검계열 베이스 | `set.costume.black-base` | 검정 저고리 + 검정·빨강 치마 + 초록 속바지 + 연두 속치마 | (서브세트 — 단독 사용 없음) |
| 경고춤 의상 | `set.costume.gyeonggo` | 검계열 베이스 + 빨강 허리띠 + 머리장식(경고춤) | 경고춤 |
| 검무 의상 | `set.costume.geommu` | 검계열 베이스 + 검무용 허리띠 + 옆 머리장식(검무) | 검무 |

> 검계열 베이스 방식은 재고 효율화 안이다(저고리·치마·속옷을 두 종목이 공유하고
> 허리띠·머리장식만 분기). 실물이 실제로 공유 가능한 구조인지 §9에서 확인.

### 5.2 무대 세트 — 소품·악기·채 (학원 관리, 공연 당일 반출 단위)

| 세트 | 구성 |
|---|---|
| 삼고무 | 삼고무 북 + 기본 북채(예비분) |
| 오고무 | 오고무 북 + 북채(전용 여부 §9 확인, 예비분) |
| 장구춤 | 장구 + 장구채 세트(예비분) |
| 기본난타 | 기본난타용 북 + 기본 북채(예비분) |
| K Drum Ensemble | 메가드럼 + K Drum 북채 |
| 진도북춤 | 진도북 + 진도북 북채 |
| 소고춤 | 소고 |
| 경고춤 | 경고 |
| 부채춤 / 산조 / 한량무 | 부채 / 산조부채 / 한량무 부채 (소유 확정 후) |
| 화관무 | 화관무 한삼 |
| 탈춤 | 탈춤용 한삼 + 탈 |
| 살풀이 | 살풀이 수건 (소유 확정 후) |
| 검무 소품 | 검무용 칼 |
| 아리랑/봄동산 소품 | 아리랑 꽃 + 봄동산 바구니 |

> 채는 개인 소유가 원칙이어도 공연 당일 분실·파손 대비 **예비분을 무대 세트에 포함**한다.

### 5.3 개인 키트 (학생/학부모 관리)

| 키트 | 코드 | 구성 |
|---|---|---|
| 헤어 키트 | `set.kit.hair` | §4.6 전체 — 전 종목 공통 |
| 공연 메이크업 키트 | `set.kit.makeup` | §4.7 전체 — 전 종목 공통 |
| 수업 기본 준비물 | `set.kit.practice` | 허리치마(연습용) + (해당 종목 시) 개인 북채·장구채 |
| 장구채 | `set.stick.janggu` | 궁채 + 열채 (2품목 1벌) |

---

## 6. 레퍼토리 목록 및 필요물품 매트릭스

### 6.1 레퍼토리 목록 (19종 — 원본에서 명시·암시된 전체)

| 계열 | 레퍼토리 | 코드 | 영문 | 근거 |
|---|---|---|---|---|
| 무구 무용 | 부채춤 | `rep.buchaechum` | Buchaechum (Fan Dance) | 의상+소품 |
| 무구 무용 | 산조춤 | `rep.sanjochum` | Sanjochum (Sanjo Dance) | 산조부채에서 암시 |
| 무구 무용 | 한량무 | `rep.hallyangmu` | Hallyangmu (Nobleman's Dance) | 남성용 부채에서 암시 |
| 무구 무용 | 화관무 | `rep.hwagwanmu` | Hwagwanmu (Flower Crown Dance) | 한삼에서 암시 |
| 무구 무용 | 탈춤 | `rep.talchum` | Talchum (Mask Dance) | 한삼+탈에서 암시 |
| 무구 무용 | 살풀이춤 | `rep.salpuri` | Salpurichum | 수건에서 암시 |
| 무구 무용 | 검무 | `rep.geommu` | Geommu (Sword Dance) | 의상+칼 |
| 무구 무용 | 아리랑 꽃춤 | `rep.arirang-kkotchum` | Arirang Kkotchum | 꽃에서 암시 — 환타지와 동일 작품 가능성 高(§9) |
| 무구 무용 | 봄동산 | `rep.bomdongsan` | Bomdongsan (Spring Hill) | 바구니에서 암시 |
| 북춤/타악무 | 삼고무 | `rep.samgomu` | Samgomu (Three-Drum Dance) | 의상(공유)+북+채 |
| 북춤/타악무 | 오고무 | `rep.ogomu` | Ogomu (Five-Drum Dance) | 의상(공유)+북 |
| 북춤/타악무 | 동고 | `rep.donggo` | Donggo (잠정) | 의상(공유)만 — 정체 §9 확인 |
| 북춤/타악무 | 장구춤 | `rep.jangguchum` | Jangguchum | 의상(공유)+장구+채 |
| 북춤/타악무 | 소고춤 | `rep.sogochum` | Sogochum | 소고에서 암시 |
| 북춤/타악무 | 진도북춤 | `rep.jindo-bukchum` | Jindo Bukchum | 진도북+채에서 암시 |
| 북춤/타악무 | 경고춤 | `rep.gyeonggochum` | Gyeonggochum (잠정) | 의상+경고 |
| 북춤/타악무 | 기본난타 | `rep.nanta-basic` | Nanta (basic) | 난타북+채에서 암시 |
| 창작 타악 | K Drum Ensemble | `rep.kdrum-ensemble` | K Drum Ensemble | 의상+메가드럼+채 — "전통무용"이 아닌 창작 타악 퍼포먼스로 별도 분류 권장 |
| 창작 군무 | 아리랑 환타지 | `rep.arirang-fantasy` | Arirang Fantasy | 의상만 |

**이름 관계 판단**
- **아리랑 환타지 vs 아리랑 꽃춤**: 동일 작품일 가능성이 높다. 환타지는 의상 섹션에만,
  꽃춤은 소품 섹션에만 서로 배타적으로 등장 — "환타지"는 무대 연출 명칭, "꽃춤"은 꽃을
  드는 안무의 별칭일 개연성. 확정은 §9.
- **동고·삼고무·오고무·장구춤**: 하나의 무복을 **공유하는 4개의 독립 종목**으로 해석.
  사용 악기만 다르고 의상은 같다.

### 6.2 레퍼토리 × 필요물품 매트릭스

(추정 필요) = 도메인상 당연히 필요하나 원본에 없는 항목.

| 레퍼토리 | 의상 | 소품/무구 | 악기 | 채 |
|---|---|---|---|---|
| 부채춤 | 부채춤 세트 | 부채 | — | — |
| 산조춤 | (추정 필요) | 산조부채 | — | — |
| 한량무 | 남성 도포·갓 (추정 필요) | 한량무 부채(남) | — | — |
| 화관무 | 의상+화관 (추정 필요) | 화관무 한삼 | — | — |
| 탈춤 | (추정 필요) | 탈춤용 한삼, 탈 | — | — |
| 살풀이춤 | 흰 치마저고리 (추정 필요) | 살풀이 수건 | — | — |
| 검무 | 검무 세트 | 검무용 칼 | — | — |
| 아리랑 꽃춤/환타지 | 아리랑 환타지 세트 | 아리랑 꽃 | — | — |
| 봄동산 | (추정 필요) | 봄동산 바구니 | — | — |
| 삼고무 | 드럼계열 공용 세트 | — | 삼고무 북 | 기본 북채 |
| 오고무 | 드럼계열 공용 세트 | — | 오고무 북 | (전용 채 여부 추정 필요) |
| 동고 | 드럼계열 공용 세트 | — | (동고 일습 추정 필요) | (추정 필요) |
| 장구춤 | 드럼계열 공용 세트 | — | 장구 | 장구채(궁채+열채) |
| 소고춤 | (추정 필요) | 소고 | 소고 겸용 | (소고채 추정 필요) |
| 진도북춤 | (추정 필요) | — | 진도북 | 진도북 북채 |
| 경고춤 | 경고춤 세트 | 경고 | 경고 겸용 | (경고채 추정 필요) |
| 기본난타 | (추정 필요) | — | 기본난타용 북 | 기본 북채 |
| K Drum Ensemble | K Drum 세트 | — | 메가드럼 | K Drum 북채 |
| **전 종목 공통** | — | 헤어 키트 + 메이크업 키트(공연 시) + 허리치마(연습 시) | | |

**데이터 완결성**: 삼고무·경고춤·검무·K Drum·부채춤은 완결성이 높다.
가장 취약한 연결: 오고무 북채, 동고 일습, 소고채, 경고채.
의상 공백이 큰 종목: 산조·한량무·화관무·탈춤·살풀이·소고춤·봄동산·진도북춤·기본난타.

---

## 7. 운영 체크리스트

### (a) 신입생 첫 수업 — 학부모 지참
- [ ] 허리치마(연습용) 1
- [ ] 머리끈·실핀·U자핀 등 기본 헤어 고정용품
- [ ] (해당 종목 시작 시) 개인 북채/장구채 — 학원 안내 후 구매
- [ ] 개인 물병·수건
- 메이크업은 공연 전까지 불필요함을 안내

### (b) 수업(종목별)
- 학생: 허리치마 + 헤어 고정용품 + 개인 채(해당 종목)
- 학원: 해당 종목 악기·소품(무대 세트에서 대여) + 예비 채

### (c) 공연 당일 — 학생/학부모 지참
- [ ] 개인 헤어 키트 전체
- [ ] 개인 공연 메이크업 키트 전체
- [ ] 개인 북채/장구채(사용 종목)
- [ ] 개인 위생용품(속옷·양말 등)
- 의상·소품은 지참하지 않음 — 학원 대여

### (d) 공연 당일 — 학원 반출 (운영진)
- [ ] 출연 레퍼토리별 **의상 세트** — 사이즈별 수량 확인 후 반출
- [ ] 출연 종목별 **무대 세트** — 악기·소품·예비 채
- [ ] 머리장식·허리띠·한삼 등 부속 소품 재확인
- [ ] 예비 헤어·핀 비상분(현장 보급용)
- [ ] 반출 대장 + 회수 체크리스트

---

## 8. 재고·수량 관리

### 관리 속성

| 속성 | 적용 대상 | 내용 |
|---|---|---|
| 수량 | 전체 학원 자산 | 보유 총량·가용 수량 |
| 사이즈 분포 | 의상 세트 | 아동/청소년/성인 × 저고리·치마 등 |
| 상태 등급 | 의상·소품·악기 | 양호/사용가능/수선필요/폐기 |
| 대여 이력 | 의상·악기 | 공연명·대여자·대여일·반납일 |
| 세탁·수선 주기 | 의상·한삼·수건 | 공연 후 세탁, 시즌별 점검 |
| 안전 점검 | 칼·탈·북·메가드럼 | 검무 칼 안전점검, 북 가죽·탈 도색 상태 |

### 운영 규칙 초안

- **대여**: 공연 단위 일괄 대여, 반출 대장에 개인별·사이즈별 기록.
- **반납**: 공연 종료 후 즉시 회수 → 세트 단위 수량·상태 대조 → 세탁 처리.
- **세탁**: 의상은 공연 후 전량 세탁, 한삼·수건 등 접촉 소품은 매 공연 세탁.
- **변상**: 학원 자산 분실·중대 파손 시 감가 반영 변상 기준표 사전 고지. 자연 마모는 학원 부담.
- **개인 자산**: 채·헤어·메이크업은 학생 자기 관리. 단 핀·스프레이 비상분은 학원 소량 상비.
- **성장 관리**: 아동 원생은 시즌마다 사이즈 재측정 → 의상 재배정.

---

## 9. 확인 필요 사항 (원장 확인용)

### A. 품목 정체·명칭
1. **"동고"의 정체** — 사용 악기(북 종류·개수)·채·한자/유래. 삼고무·오고무의 변형인가?
2. **"경고"의 정확한 명칭·한자·크기** — 소고와 진도북 사이의 손북으로 이해하면 되는가? 전용 채가 필요한가?
3. **"아리랑 환타지"와 "아리랑 꽃춤"** — 같은 작품인가? 같다면 대표 명칭 통일.
4. **허리띠류 명칭 표준** — 허리 술띠 / 허리띠(K Drum) / 색동 벨트 / 빨강·검무 허리띠가 다른 실물인지, 술띠·허리띠·벨트 용어 기준.
5. **머리장식 4종** — 머리 꽃장식 / 경고춤 머리장식 / 검무 옆 머리장식 / 보석 꽃머리장식의 실물 구분과 표준명.
6. **"1조"의 정의** — 북채 1조 = 2개(한 쌍)인가, 인당 지급 단위인가?

### B. 통합/분리 확정
7. **연보라 저고리** — K Drum과 아리랑 환타지가 동일 실물인가?
8. **검정·빨강 치마** — 투톤 1벌인가, 2벌인가?
9. **부채춤 부채** — 기본 `부채`와 동일한가, 전용 부채가 별도인가?
10. **드럼계열 4종목 의상** — 정말 100% 동일 세트인가(디테일 차이 없음)?
11. **검계열 베이스 공유** — 경고춤·검무가 저고리·치마·속옷 실물을 실제로 공유 가능한가?

### C. 누락 보완
12. **의상 미기재 9종목** — 산조·한량무(도포·갓)·화관무(화관 포함)·탈춤·살풀이(흰 치마저고리)·소고춤·봄동산·진도북춤·기본난타의 의상 구성.
13. **버선·무용신 등 신발류** — 전 종목 공통 필요하나 목록에 전무. 개인인가 학원인가?
14. **속적삼 등 기초 복식** — 종목별 필요 여부.
15. **채 짝 누락** — 오고무 북채·소고채·경고채는 기본 북채 공용인가 전용인가?
16. **탈의 종류**(계열)와 화관무의 **화관** 존재 여부.

### D. 소유·운영 정책
17. **부채 3종 소유 정책** — 개인 구매 관행인가, 학원 규격 통일 대여인가?
18. **살풀이 수건** — 학원 보유·세탁인가, 개인 지참인가?
19. **기본 북채·장구채** — 개인 구매 필수 안내인가? 지정 규격/구입처가 있는가?
20. **소고·경고 분류 확정** — 소품·악기 이중 태깅으로 갈 것인가?
21. **개인 키트 표준화** — 신입생 배포용 "권장 헤어·메이크업 품목표"를 학원이 통일 안내할 것인가?

### E. 수량·재고
22. **드럼계열 공용 세트 필요 수량** — 4종목 최대 동시 출연 인원 기준.
23. **북 보유 대수**(메가드럼·삼고무·오고무) — 복수 팀 동시 공연 가능 여부.
24. **의상 사이즈 재고 범위** — 현재 보유 사이즈 구간과 성장기 대응.
25. **칼·탈 안전 관리 절차** — 별도 보관·점검 절차 존재 여부.
26. **사이즈 관리 수준** — 품목 단위 관리로 충분한가, 학생별 실물 배정 추적까지 필요한가?

---

## 10. 향후 시스템화 대비 — D1 스키마 초안

> 지금 구현하는 것이 아니라, 준비물/재고 관리를 사이트에 넣을 때를 위한 설계 초안.
> 사이트 관례(D1=콘텐츠, `name_ko/name_en` 다국어 필드)를 따른다.

```sql
CREATE TABLE prep_categories (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- prep|stick|instrument|prop|costume|hair|makeup
  name_ko TEXT NOT NULL, name_en TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE prep_items (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- prop.fan.sanjo
  category_id INTEGER NOT NULL REFERENCES prep_categories(id),
  name_ko TEXT NOT NULL, name_en TEXT,
  color_ko TEXT, color_en TEXT,
  gender TEXT DEFAULT 'unisex',        -- male|female|unisex
  owner_type TEXT DEFAULT 'academy',   -- academy|student
  is_consumable INTEGER DEFAULT 0,
  has_size INTEGER DEFAULT 0,
  parent_type TEXT,                    -- '부채','한삼','허리치마' 등 유형 그룹
  unit TEXT,                           -- 조|개|벌
  note_ko TEXT, note_en TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE prep_sets (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- set.costume.drum-base
  kind TEXT NOT NULL,                  -- costume|stick|kit|stage
  name_ko TEXT NOT NULL, name_en TEXT,
  note_ko TEXT
);

CREATE TABLE prep_set_items (
  set_id INTEGER NOT NULL REFERENCES prep_sets(id),
  item_id INTEGER NOT NULL REFERENCES prep_items(id),
  quantity INTEGER DEFAULT 1,
  role_ko TEXT,                        -- 상의|속옷|허리띠|머리장식
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (set_id, item_id)
);

CREATE TABLE prep_repertoires (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- rep.buchaechum
  name_ko TEXT NOT NULL, name_en TEXT,
  category TEXT,                       -- 무구무용|북춤|창작타악|창작군무
  is_active INTEGER DEFAULT 1
);

CREATE TABLE prep_repertoire_requirements (
  id INTEGER PRIMARY KEY,
  repertoire_id INTEGER REFERENCES prep_repertoires(id),  -- NULL = 전 종목 공통
  set_id INTEGER REFERENCES prep_sets(id),
  item_id INTEGER REFERENCES prep_items(id),
  requirement_type TEXT NOT NULL,      -- costume|prop|instrument|stick|hair|makeup|prep
  quantity INTEGER DEFAULT 1,
  note_ko TEXT,
  CHECK (set_id IS NOT NULL OR item_id IS NOT NULL)
);
```

- 헤어·메이크업·연습 허리치마는 `repertoire_id = NULL`(전 종목 공통)로 단일 소스 표현.
- 의상 실물 재고(학생별 사이즈 배정)까지 추적하려면 `prep_item_instances`
  (item_id, size, asset_tag, status) 테이블을 추가하는 확장 경로를 열어둠 — §9-26 답변에 따라 결정.
