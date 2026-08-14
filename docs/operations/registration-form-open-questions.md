# 2026–2027 수강 신청서 — 원장 확인 대기 항목

작성: 2026-08-14 · 상태: **확인 대기** · 대상 폼: `forms.slug = '2026-2027-regular'` (초안)

**원장님께 보여드릴 문서**: https://claude.ai/code/artifact/a08d32d9-06e5-4ff9-a593-3ff02f3f3e7a
(비전문가용으로 쓴 웹 페이지. 링크를 열면 바로 읽으실 수 있고 인쇄도 됩니다.)

---

## 이 문서가 있는 이유

구글폼을 웹사이트로 옮기면서, 원본 신청서와 학비표만으로는 확정할 수 없는 판단이 넷 있었다.
작업을 멈추는 대신 **근거를 적어 잠정 결정을 내리고 한곳에 모아 두었다.**

코드상 단일 소스는 **`lib/forms/provisionalNotes.ts`** 다. 확인이 끝나면 해당 항목을 지우고,
배열이 비면 그 파일과 그것을 읽는 곳(편집 화면 배너)을 함께 제거한다.
`lib/forms/presets.test.ts`가 노트와 실제 선택지의 짝을 잠근다 — 한쪽만 사라질 수 없다.

## 확정된 것 (2026-08-13 사용자 확인)

| | 내용 |
|---|---|
| ✅ | **기초 난타반을 1 Drum / 3 Drum으로 분리.** 학비 $400 / $450 |
| ✅ | **"오고무·동고"를 삼고무·동고 / 오고무로 분리.** 학비 $600 / $700 |

## 확인 대기 4건

| id | 질문 | 게시 전 필수? |
|---|---|---|
| `youth-repertoire-missing` | 중고등부 작품반을 Q7 선택지로 새로 넣은 것이 맞는가 | **예** |
| `sunday-adult-tuition` | 일요 성인반 3종의 학비표 대응 / Sat+Sun 패키지의 조합 | 아니오 |
| `kdrum-is-mega-drum` | K-DRUM 앙상블 = Mega Drum(모듬북) | 아니오 |
| `class-capacity` | 삼고무·오고무 정원(보유 북 수량) | 아니오 |

**게시 전 필수는 `youth-repertoire-missing` 하나뿐이다.** 과목 선택지가 바뀌는 일이라
첫 제출 이후에는 되돌릴 수 없다(`assertEditAllowed`가 409로 막는다).
나머지 셋은 `courseCode`·`capacity` 값만 고치면 되므로 게시 후에도 편집 화면에서 처리 가능하다.

### `youth-repertoire-missing` — 판단 근거

학비표가 `1 Dance Course (Kids Korean Dance / **Youth Dance** / Advanced Dance)`로
**Youth Dance와 Advanced Dance를 나란히 별개로 나열**한다. 따라서 Q7의
"고급반 무용(Advanced Korean Dance)"은 `programs.id=17`(고급작품무용반)이고,
중고등부 작품반은 `programs.id=15`로 별개 수업이다. Q11(칼 소품비 $80)이 이 반을
가리키는데 원본 Q7에 고를 자리가 없었다 — **원본 구글폼의 결함**으로 판단하고 선택지를 추가했다.

틀렸다면: 새 선택지(`youth_repertoire`)를 지우고 `q11_prop.showIf`를 `advanced_dance`로 옮긴다.

## 출시 전 체크리스트

- [ ] 원장 확인 4건 회수
- [ ] `lib/forms/provisionalNotes.ts`에서 확인된 항목 삭제
- [ ] 배열이 비면 `provisionalNotes.ts` 자체와 편집 화면 배너 제거
- [ ] `presets.test.ts`의 노트 짝 검사 시험도 함께 정리
- [ ] 이 문서를 "해결됨"으로 표시하거나 삭제
- [ ] 위 아티팩트 페이지 갱신 또는 회수

## 관련

- 설계: `docs/superpowers/specs/2026-08-13-registration-forms-design.md` §7.12
- 원본 자료: `docs/superpowers/specs/2026-08-13-registration-forms-source.md`
- 구현 계획: `docs/superpowers/plans/2026-08-13-registration-forms-phase1.md` Task 4
