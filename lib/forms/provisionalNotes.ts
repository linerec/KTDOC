/**
 * lib/forms/provisionalNotes.ts — 원장 확인이 필요한 잠정 판단
 *
 * ⚠️ **이 파일은 출시 전에 사라져야 한다.**
 *
 * 2026–2027 신청서를 만들면서, 원본 구글폼과 학비표만으로는 확정할 수 없는 것들이
 * 있었다. 작업을 멈추는 대신 **근거를 적어 잠정 결정을 내리고 여기 모아 두었다.**
 * 원장 확인이 끝나면 각 항목을 지우고, 배열이 비면 이 파일과 이 파일을 읽는 곳
 * (편집 화면의 확인 배너)을 함께 제거한다.
 *
 * 왜 한 파일인가: 잠정 판단이 코드 곳곳에 주석으로 흩어지면 출시 때 무엇을
 * 지워야 하는지 아무도 모른다. 지울 것은 한곳에 모아 둔다.
 *
 * 확인 상태 점검:
 *   - 편집 화면(/admin/forms/[id]) 상단 "원장 확인 필요" 배너에 이 목록이 뜬다
 *   - 원장에게 보여줄 문서는 docs/operations/registration-form-open-questions.md
 *
 * 시험(presets.test.ts)이 잠그는 것: 여기 적힌 optionKey 가 실제 프리셋에 존재하는가.
 * 노트만 남고 선택지가 사라지거나 그 반대가 되는 것을 막는다.
 */

export interface ProvisionalNote {
  /** 안정 식별자 */
  id: string;
  /** 원장에게 물어야 할 것 — 그대로 화면에 뜬다 */
  question: string;
  /** 내가 내린 잠정 결정 */
  assumption: string;
  /** 그렇게 판단한 근거 */
  reason: string;
  /** 이 판단이 걸린 q7_classes 선택지 키 (없으면 빈 배열) */
  optionKeys: string[];
  /** 원장이 다르게 답하면 무엇을 고쳐야 하는가 */
  ifWrong: string;
}

export const PROVISIONAL_NOTES: ProvisionalNote[] = [
  {
    id: 'kdrum-is-mega-drum',
    question:
      '"모북의 합주 K-DRUM Ensemble"이 학비표의 "Mega Drum 모듬북"과 같은 수업입니까?',
    assumption: '같은 수업으로 보고 학비표의 Mega Drum(3개월 $650) 행에 연결했습니다.',
    reason:
      '원본 폼의 "모북(모듬북)의 합주"라는 표현과 학비표의 "Mega Drum - Beginner / Advanced 모듬북"이 같은 한국어 이름을 씁니다. 사이트의 수업 "K-드럼 앙상블"(id 16)과도 이름이 이어집니다.',
    optionKeys: ['kdrum_ensemble'],
    ifWrong:
      '다른 수업이라면 학비표에 대응 행이 없다는 뜻이므로, 학비 조회 보조에서 이 과목을 "개별 확인"으로 빠지게 두면 됩니다(courseCode 를 비웁니다).',
  },
  {
    id: 'sunday-adult-tuition',
    question:
      '일요 성인반 3종(기초무용·난타·고급무용)의 수강료는 학비표의 어느 행입니까? 그리고 "*2 Dance Courses (Sat + Sun Combination Package) $580"은 어떤 조합을 말합니까?',
    assumption:
      '일요 성인 기초무용반과 고급무용반은 "1 Dance Course"(3개월 $400), 일요 성인 난타반은 "Kids Drum 1 / 1-Drum Nanta"(3개월 $400)로 잡았습니다. 세 과목 모두 단품 $400이라 실무상 차이는 없습니다. "Sat + Sun Combination Package"는 토요일 수업 1개 + 일요일 수업 1개를 함께 등록하는 경우로 보았습니다(일반 2과목 $650 대신 $580).',
    reason:
      '학비표에 성인반 전용 행이 없고, 무용 계열은 "1 Dance Course"가 유일한 단품 행입니다. 난타는 "1-Drum Nanta"가 가장 가깝습니다. Sat+Sun 패키지가 일반 2과목보다 싼 것은 일요일 수업 등록을 유도하는 할인으로 읽는 것이 자연스럽습니다.',
    optionKeys: ['sun_beginner_dance', 'sun_adult_nanta', 'sun_advanced_dance'],
    ifWrong:
      '성인반 수강료가 따로 있다면 학비표에 행을 추가하고 lib/forms/tuition.ts 의 코스 코드를 새로 만듭니다. Sat+Sun 패키지의 조건이 다르면 그 조합 규칙만 고치면 됩니다.',
  },
  {
    id: 'youth-repertoire-missing',
    question:
      '중고등부 한국무용 작품반은 신청서에서 어떻게 신청합니까? 지금 구글폼에는 이 반을 고를 자리가 없는데, 칼 소품비($80) 동의는 전원에게 받고 있습니다. 그리고 이 반의 수업 시간은 언제입니까?',
    assumption:
      '**Q7에 "중고등부 한국무용 작품반" 선택지가 빠져 있던 것으로 보고 새로 추가했습니다.** 칼 소품비 동의(Q11)는 이 과목을 고른 학생에게만 뜨도록 연결했습니다. 수업 시간은 확인되지 않아 라벨에 넣지 않았습니다.',
    reason:
      '학비표가 "1 Dance Course (Kids Korean Dance / **Youth Dance** / Advanced Dance)"로 **Youth Dance 와 Advanced Dance 를 나란히 별개로 나열**합니다. 즉 Q7의 "고급반 무용(Advanced Korean Dance)"은 사이트의 "고급작품무용반"(id 17)이고, 중고등부 작품반(id 15)은 별개 수업입니다. 사이트에도 "중고등부 한국무용 작품반"이 수업으로 등록되어 있습니다.',
    optionKeys: ['youth_repertoire'],
    ifWrong:
      '만약 "고급반 무용"이 곧 중고등부 작품반이라면, 새로 추가한 선택지를 지우고 칼 소품비 동의를 "고급반 무용"에 연결하면 됩니다. **다만 신청서를 게시한 뒤에는 선택지를 지울 수 없으므로 게시 전에 정해야 합니다.**',
  },
  {
    id: 'class-capacity',
    question:
      '삼고무·오고무처럼 정원이 있는 과목의 실제 정원은 몇 명입니까? (보유 북 수량)',
    assumption: '정원을 비워 두었습니다. 명단 화면에 "7 / 10" 같은 잔여 표시가 뜨지 않습니다.',
    reason:
      '원본 폼은 "보유 북 수량이 제한되어 있어 1년 과정 등록 학생에게 우선 배정되며 잔여 자리는 선착순"이라고만 하고 숫자를 밝히지 않았습니다.',
    optionKeys: ['drums_3standing', 'drums_5standing'],
    ifWrong:
      '숫자를 알려주시면 편집 화면의 "과목·기간" 탭에서 정원 칸에 넣기만 하면 됩니다. 배포가 필요 없습니다. (1년 우선 → 선착순 정렬은 정원과 무관하게 이미 동작합니다.)',
  },
];

/** 편집 화면 배너·시드 스크립트가 쓰는 요약 */
export function hasProvisionalNotes(): boolean {
  return PROVISIONAL_NOTES.length > 0;
}

/** 이 선택지에 걸린 잠정 판단 */
export function notesForOption(optionKey: string): ProvisionalNote[] {
  return PROVISIONAL_NOTES.filter((n) => n.optionKeys.includes(optionKey));
}
