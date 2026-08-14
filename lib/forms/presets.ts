/**
 * lib/forms/presets.ts — "새 신청서"의 시작점
 *
 * 원장은 빈 캔버스를 만나지 않는다. 프리셋을 고르면 문항이 이미 다 들어 있고,
 * 편집은 표에서 행을 고치는 일이 된다. 이것이 이 시스템이 '폼 빌더'가 아닌 이유다.
 *
 * 문안은 2026–2027 구글폼 원문 그대로다(docs/superpowers/specs/2026-08-13-registration-forms-source.md).
 * 옮기면서 바꾼 것은 셋뿐이고 전부 근거가 있다:
 *
 *  1. **전화·보호자명 문항을 새로 세웠다**(q4b_phone 필수 / q4c_guardian 선택).
 *     원본은 이메일만 받는데 학기 초 급한 연락은 전화로 돈다.
 *  2. **조건부 노출을 실제로 걸었다.** 원본에서는 공연 미참가 사유(Q9)와 칼 소품비(Q11)가
 *     전원에게 필수로 떴다. 이제 해당되는 사람에게만 뜬다.
 *  3. **q7_classes 선택지를 학비표에 맞게 쪼개고, 빠져 있던 중고등부 작품반을 추가했다.**
 *     근거와 미확정 사항은 lib/forms/provisionalNotes.ts 에 모여 있다 — 원장 확인 후 그 파일을 지운다.
 *
 * ⚠️ 선택지 key 는 첫 제출 이후 바꿀 수 없다(응답이 이 키를 가리킨다). 게시 전에 확정할 것.
 *    programId 는 원격 D1 실측 기준이다(2026-08-13, program_type='class' 9건).
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import type { FormKind, FormSchema } from '../../types/forms.ts';

/**
 * 학비표 코스 코드 — lib/forms/tuition.ts 의 룩업 키.
 * 표(docs/.../-source.md §C)의 SINGLE COURSE 6행에 1:1 대응한다.
 */
export const COURSE = {
  DANCE_1: 'dance_1', // 1 Dance Course (Kids Korean Dance / Youth Dance / Advanced Dance)
  KIDS_DRUM_1: 'kids_drum_1', // Kids Drum 1 (1-Drum Nanta)
  KIDS_DRUM_3: 'kids_drum_3', // Kids Drum 3 (3-Drum Nanta)
  DRUMS_3: 'drums_3', // 3 Standing Drums (Samgomu/Dong go) 삼고무/동고
  DRUMS_5: 'drums_5', // 5 Standing Drums (Ogomu) 오고무
  MEGA_DRUM: 'mega_drum', // Mega Drum 모듬북
} as const;

export function seasonPreset2026(): FormSchema {
  return {
    version: 1,
    presetKey: 'season-2026',
    sections: [
      // ── 섹션 1: 학생 정보 ────────────────────────────────────
      {
        key: 'student',
        title: { ko: '학생 정보', en: 'Student Information' },
        questions: [
          {
            key: 'q1_reg_type',
            type: 'single',
            required: true,
            label: { ko: '등록 유형', en: 'Registration Type' },
            options: [
              { key: 'new', label: { ko: '신규 등록', en: 'New Student' } },
              { key: 'returning', label: { ko: '재등록', en: 'Returning Student' } },
            ],
          },
          {
            key: 'q2_student_name',
            type: 'short',
            required: true,
            bind: 'student_name',
            label: { ko: '학생 이름', en: 'Student Name' },
          },
          {
            key: 'q3_grade',
            type: 'short',
            required: true,
            bind: 'student_grade',
            label: { ko: '학년', en: 'Grade' },
          },
          {
            key: 'q4_email',
            type: 'short',
            required: true,
            bind: 'email',
            format: 'email',
            label: { ko: '이메일', en: 'Email Address' },
          },
          // 원본에 없던 문항 — 학기 초 급한 연락(반편성 변경·준비물 안내)은 전화로 돈다.
          {
            key: 'q4b_phone',
            type: 'short',
            required: true,
            bind: 'phone',
            format: 'tel',
            label: { ko: '연락처', en: 'Phone Number' },
            help: {
              ko: '학기 중 안내가 필요할 때 연락드릴 번호입니다.',
              en: 'We will use this number for class announcements during the term.',
            },
          },
          {
            key: 'q4c_guardian',
            type: 'short',
            required: false,
            bind: 'guardian_name',
            label: { ko: '보호자 이름 (선택)', en: 'Parent/Guardian Name (optional)' },
          },
          {
            key: 'q5_medical',
            type: 'long',
            required: false,
            sensitive: true,
            label: { ko: '건강 및 특이사항', en: 'Medical Information' },
            help: {
              ko: '알레르기, 건강상 유의사항 또는 지도자가 미리 알아야 할 사항이 있는 경우 작성해 주세요.',
              en: 'Please list any allergies, medical conditions, or other important information the instructor should be aware of.',
            },
          },
        ],
      },

      // ── 섹션 2: 수강 및 기간 선택 ────────────────────────────
      {
        key: 'classes',
        title: { ko: '수강 및 기간 선택', en: 'Class & Period Selection' },
        questions: [
          {
            key: 'q6_period',
            type: 'single',
            required: true,
            label: { ko: '등록 기간', en: 'Registration Period' },
            options: [
              { key: 'm3', label: { ko: '3개월 등록', en: '3-Month Program' } },
              {
                key: 'm6',
                label: {
                  ko: '6개월 등록 (수강료 10% 할인)',
                  en: '6-Month Program (10% Tuition Discount)',
                },
              },
              {
                key: 'y1',
                label: {
                  ko: '1년 등록 (수강료 20% 할인)',
                  en: 'Full-Year Program (20% Tuition Discount)',
                },
              },
            ],
          },
          {
            key: 'q7_classes',
            type: 'multi',
            required: true,
            minSelect: 1,
            selectionOf: 'class',
            label: { ko: '수강 과목 신청', en: 'Class Selection' },
            help: {
              ko: [
                '신청할 과목을 모두 선택해 주세요.',
                '',
                '※ 여러 과목을 선택하여 신청하실 수 있습니다. (중복할인 적용)',
                '※ 2과목 이상 등록 시 다과목 할인이 적용될 수 있습니다.',
                '※ 삼고무·오고무 수업 등록 안내: 삼고무·오고무 수업은 보유 북 수량이 제한되어 있어 1년 과정 등록 학생에게 우선 배정되며, 잔여 자리는 선착순으로 등록됩니다.',
                '※ 수강료 소폭 조정 안내 (3개월 기준 $30 인상): 2026–2027 학기부터 유년부 3북(Kids Drum 3) 및 일부 패키지 수강료가 3개월 기준 $30 소폭 인상되었습니다. 학부모님들의 따뜻한 양해를 부탁드립니다.',
                '※ 각 과목의 최종 수업 시간은 신청 인원에 따라 조정될 수 있습니다.',
              ].join('\n'),
              en: [
                'Please select all classes you wish to enroll in.',
                '',
                'Multiple classes can be selected. (Multi-class discounts apply)',
                'A multi-class discount may be applied when registering for two or more classes.',
                'Samgomu & Ogomu Class Registration Notice: Due to a limited number of available drums, priority enrollment will be given to students registered for the Full-Year Program. Remaining spots will be filled on a first-come, first-served basis.',
                'Notice of Slight Tuition Adjustment (+$30 per 3 Months): Starting from this 2026–2027 semester, the tuition for the Kids Drum 3 class and selected combination packages has been slightly increased by $30 per 3-month period. We kindly ask for your warm understanding.',
                'The final schedule for each class is subject to change depending on the number of applicants.',
              ].join('\n'),
            },
            options: [
              // 원본은 "기초 난타반 … 1 Drum & 3 Drum"이 한 선택지였으나 학비표에서
              // Kids Drum 1($400)·Kids Drum 3($450)로 가격이 갈리므로 쪼갠다.
              {
                key: 'nanta_1drum',
                label: {
                  ko: '기초 난타반 1 Drum (12:45~1:15 P.M.)',
                  en: 'Beginner Nanta – 1 Drum (12:45–1:15 P.M.)',
                },
                programId: 12,
                courseCode: COURSE.KIDS_DRUM_1,
              },
              {
                key: 'nanta_3drum',
                label: {
                  ko: '기초 난타반 3 Drum (12:45~1:15 P.M.)',
                  en: 'Beginner Nanta – 3 Drum (12:45–1:15 P.M.)',
                },
                programId: 12,
                courseCode: COURSE.KIDS_DRUM_3,
              },
              {
                key: 'kids_dance',
                label: {
                  ko: '유년부 무용 (1:25~2:05 P.M.)',
                  en: "Children's Korean Dance (1:25–2:05 P.M.)",
                },
                programId: 13,
                courseCode: COURSE.DANCE_1,
              },
              // 원본은 "오고무, 동고 (5 Standing Drum)"이 한 선택지였으나 학비표에서
              // 3 Standing($600)·5 Standing($700)로 갈리므로 쪼갠다.
              {
                key: 'drums_3standing',
                label: {
                  ko: '삼고무 · 동고 3 Standing Drums (2:15~3:00 P.M.)',
                  en: '3 Standing Drums – Samgomu / Dong-go (2:15–3:00 P.M.)',
                },
                programId: 14,
                courseCode: COURSE.DRUMS_3,
              },
              {
                key: 'drums_5standing',
                label: {
                  ko: '오고무 5 Standing Drums (2:15~3:00 P.M.)',
                  en: '5 Standing Drums – Ogomu (2:15–3:00 P.M.)',
                },
                programId: 14,
                courseCode: COURSE.DRUMS_5,
              },
              {
                key: 'kdrum_ensemble',
                label: {
                  ko: '모북의 합주 K-DRUM Ensemble (4:10~5:00 P.M.)',
                  en: 'K-DRUM Ensemble (4:10–5:00 P.M.)',
                },
                programId: 16,
                courseCode: COURSE.MEGA_DRUM, // provisionalNotes: kdrum-is-mega-drum
              },
              // 원본 Q7에 빠져 있던 과목. Q11(칼 소품비)이 이 반을 가리키는데 고를 자리가 없었다.
              // provisionalNotes: youth-repertoire-missing
              {
                key: 'youth_repertoire',
                label: {
                  ko: '중고등부 한국무용 작품반',
                  en: 'Youth Korean Dance – Repertoire Class',
                },
                programId: 15,
                courseCode: COURSE.DANCE_1,
              },
              {
                key: 'advanced_dance',
                label: {
                  ko: '고급반 무용 (5:15~6:45 P.M.) · 1.5시간 · 격주(월 2회)',
                  en: 'Advanced Korean Dance (5:15–6:45 P.M.) · 1.5 hrs · Twice Monthly (Biweekly)',
                },
                programId: 17,
                courseCode: COURSE.DANCE_1,
              },
              // provisionalNotes: sunday-adult-tuition
              {
                key: 'sun_beginner_dance',
                label: {
                  ko: '일요 성인 기초무용반 (둘째·넷째 일요일 3:45~4:30 P.M.)',
                  en: 'Sunday Adult Beginner Korean Dance (2nd & 4th Sunday, 3:45–4:30 P.M.)',
                },
                programId: 19,
                courseCode: COURSE.DANCE_1,
              },
              {
                key: 'sun_adult_nanta',
                label: {
                  ko: '일요 성인 난타반 (둘째·넷째 일요일 4:45~5:30 P.M.)',
                  en: 'Sunday Adult Nanta Class (2nd & 4th Sunday, 4:45–5:30 P.M.)',
                },
                programId: 20,
                courseCode: COURSE.KIDS_DRUM_1,
              },
              {
                key: 'sun_advanced_dance',
                label: {
                  ko: '일요 성인 고급반 (둘째·넷째 일요일 5:45~6:30 P.M.)',
                  en: 'Sunday Adult Advanced Korean Dance (2nd & 4th Sunday, 5:45–6:30 P.M.)',
                },
                programId: 21,
                courseCode: COURSE.DANCE_1,
              },
            ],
          },
        ],
      },

      // ── 섹션 3: 공연 및 특별 소품 동의 ───────────────────────
      {
        key: 'performance',
        title: { ko: '공연 및 특별 소품 동의', en: 'Performance & Policy' },
        questions: [
          {
            key: 'q8_perform',
            type: 'single',
            required: true,
            label: { ko: '공연 참가 여부', en: 'Performance Participation' },
            help: {
              ko: [
                'KTDOC는 정기공연 및 다양한 문화공연을 통해 학생들에게 실제 무대 경험과 성장의 기회를 제공합니다.',
                '',
                "※ 연 1회 열리는 정기 콘서트(Annual Concert) 참가 학생은 공연장 대관 및 무대 운영을 위한 '공연 운영비(Performance Production Fee)'가 별도로 부과됩니다.",
                '※ 정기 콘서트를 제외한 모든 외부 문화공연 및 지역사회 행사 참가비는 별도로 없으며, 모두 정규 수강료에 포함되어 있습니다.',
                '※ 공연 참가 시 안전한 악기 관리와 무대 연출의 통일성을 위해 개인 악기(소품) 구입을 원칙으로 합니다. 만약 개인 악기를 구입하지 않고 학원 악기를 대여하여 공연에 참가할 경우, 별도의 악기 대여료(Rental Fee)가 발생합니다.',
              ].join('\n'),
              en: [
                'KTDOC provides students with valuable opportunities to perform through our annual concert and various community events.',
                '',
                'Students participating in the Annual Concert are required to pay a separate Performance Production Fee to support venue rental and stage management.',
                'Participation in all other cultural performances and community events outside of the annual concert is free of charge and fully covered by your regular tuition.',
                'For performances, students are generally expected to purchase their own personal instruments (props) to ensure proper care and visual uniformity on stage. If a student chooses to rent a studio-owned instrument for a performance instead of purchasing one, a separate Instrument Rental Fee will apply.',
              ].join('\n'),
            },
            options: [
              { key: 'yes', label: { ko: '참가합니다', en: 'Yes, I will participate' } },
              { key: 'no', label: { ko: '참가하지 않습니다', en: 'No, I will not participate' } },
            ],
          },
          // 원본에서는 전원에게 떴다. 이제 '참가하지 않습니다'를 고른 사람에게만 뜬다.
          {
            key: 'q9_reason',
            type: 'long',
            required: false,
            label: {
              ko: '공연에 참가하지 않으시는 이유를 적어주실 수 있나요? (선택)',
              en: 'Could you please share the reason? (Optional)',
            },
            showIf: { question: 'q8_perform', equals: ['no'] },
          },
          {
            key: 'q10_parade',
            type: 'consent',
            required: true,
            consentKey: 'parade',
            label: {
              ko: '위 내용을 확인하였으며, KTDOC 정규 교육과정에 포함된 코리안 퍼레이드 참가에 동의합니다.',
              en: "I have read and understood the information above and agree to my child's participation in the Korean Parade as part of KTDOC's regular program.",
            },
            help: {
              ko: [
                '코리안 퍼레이드 참가 안내',
                '',
                '뉴욕 코리안 퍼레이드는 약 60년의 역사를 가진 대표적인 한국 문화행사로, KTDOC는 2008년부터 매년 참가하여 한국 전통문화의 아름다움을 널리 알려왔습니다.',
                '2026–2027 시즌부터 코리안 퍼레이드 참가는 KTDOC 정규 교육과정의 일부로 운영됩니다. 학생들은 수업을 통해 익힌 기량을 실제 무대에서 선보이며, 한국 문화를 알리는 문화사절로서 소중한 공연 경험을 쌓게 됩니다.',
                '행사 당일에는 참가 학생과 보호자 1인에게 왕복 버스 및 점심이 제공되며, 춤누리 학생 외 추가 참가자는 별도의 퍼레이드 참가비가 부과됩니다.',
              ].join('\n'),
              en: [
                'Korean Parade Participation',
                '',
                'The New York Korean Parade is one of the largest and longest-running celebrations of Korean culture in the United States. Since 2008, KTDOC has proudly participated each year, sharing the beauty of Korean traditional performing arts with the local community.',
                "Beginning with the 2026–2027 season, participation in the Korean Parade will be included as part of KTDOC's regular curriculum. Students will have the opportunity to showcase the skills they have developed throughout the year while serving as cultural ambassadors who promote Korean heritage and traditions.",
                'Round-trip charter bus transportation and lunch will be provided for each participating student and one parent/guardian. An additional Korean Parade participation fee will apply to any additional participants accompanying the student.',
              ].join('\n'),
            },
          },
          // 원본에서는 전원 필수였다. 이제 중고등부 작품반을 고른 학생에게만 뜬다.
          {
            key: 'q11_prop',
            type: 'single',
            required: true,
            consentKey: 'prop_fee',
            showIf: { question: 'q7_classes', includes: ['youth_repertoire'] },
            label: {
              ko: '중고등부 한국무용 소품비용 (Youth Dance Class – Repertoire & Prop Fee)',
              en: 'Youth Dance Class – Repertoire & Prop Fee',
            },
            help: {
              ko: [
                'KTDOC 2026–2027 정규 교육과정 안내 및 소품비 동의',
                '',
                "이번 2026–2027 시즌 중고등부 작품반 수업에서는 기존 작품인 '아리랑 판타지'와 '부채춤'을 복습하는 것과 더불어, 새로운 정규 교육과정으로 '검무(칼춤)' 수업이 새롭게 진행될 예정입니다. 이에 따라 검무 수업에 반드시 필요한 칼 소품비 $80이 등록 시 별도로 발생합니다.",
                '',
                '※ 공연 참가 시 검무에 맞는 별도의 공연 의상이 필요하며, 이 의상 비용은 소품비 $80에 포함되어 있지 않습니다. 공연 의상에 대한 자세한 사항과 비용은 추후 별도로 안내해 드립니다.',
              ].join('\n'),
              en: [
                'KTDOC 2026–2027 Curriculum & Prop Fee Agreement',
                '',
                "During the 2026–2027 season, the Youth Dance Class will review our previous pieces, 'Arirang Fantasy' and 'Fan Dance.' In addition, as a core part of this year's regular curriculum, students will be learning a new repertoire piece: the Korean Sword Dance (Geommu). Accordingly, a separate $80 fee for the sword prop required for this class will be charged at registration.",
                '',
                'A separate performance costume for the Sword Dance will be required for upcoming performances. This costume cost is not included in the $80 prop fee. Details and pricing for the costume will be provided separately at a later date.',
              ].join('\n'),
            },
            options: [
              {
                key: 'agree',
                label: {
                  ko: '칼춤 소품비 $80과 공연 시 별도 의상이 필요함을 확인하였습니다.',
                  en: 'I confirm the $80 sword prop fee and the requirement for a separate performance costume.',
                },
                consentValue: true,
              },
              {
                key: 'na',
                label: {
                  ko: '해당 없음 / 중고등부 작품반 아님',
                  en: 'Not Applicable / Not enrolled in the Youth Dance Class',
                },
                consentValue: false,
                exclusive: true,
              },
            ],
          },
        ],
      },

      // ── 섹션 4: 학원 규정 동의 ───────────────────────────────
      {
        key: 'policy',
        title: { ko: '학원 규정 동의', en: 'Studio Policies & Media Release' },
        questions: [
          {
            key: 'q12_refund',
            type: 'consent',
            required: true,
            consentKey: 'refund_policy',
            label: {
              ko: '위 환불 및 보강 정책을 확인하였으며 이에 동의합니다.',
              en: 'I have read and agree to the Tuition Refund & Make-up Policy.',
            },
            help: {
              ko: [
                '환불 및 보강 정책 (Tuition Refund & Make-up Policy)',
                '',
                '· 환불 규정: 학기 시작 전 취소 시 전액 환불 가능합니다. 학기 시작 후에는 남은 기간에 관계없이 중도 하차로 인한 수강료 환불 또는 타인 양도가 불가능합니다.',
                '· 결석 및 보강 정책: 학생의 개인 사정(여행, 개인 스케줄 등)으로 인한 결석 시 수강료 이월(Credit)이나 환불은 되지 않습니다. 다만, 결석 전 지도자(선생님)의 사전 승인을 받은 경우에 한하여, 해당 학기 내에 개설된 다른 수업에서 보강(Make-up 수업)을 받는 것은 가능합니다. 학원 사정이나 악천후로 인한 휴강 시에는 공식 보강 수업이 따로 안내됩니다.',
              ].join('\n'),
              en: [
                'Tuition Refund & Make-up Policy',
                '',
                '· Refund Policy: Full refunds are available for cancellations made before the semester begins. Once the semester starts, tuition is non-refundable and non-transferable, regardless of the remaining period.',
                "· Absences & Make-up Policy: No tuition credits or refunds will be provided for student absences due to personal reasons (e.g., travel, personal schedules). However, strictly subject to the instructor's prior approval, students may take a make-up class by attending a different scheduled class within the same semester. If a class is canceled due to studio circumstances or severe weather, an official make-up class will be scheduled.",
              ].join('\n'),
            },
          },
          {
            key: 'q13_media',
            type: 'single',
            required: true,
            consentKey: 'media_release',
            label: {
              ko: '미디어 촬영 및 활용 동의',
              en: 'Media Release Agreement',
            },
            help: {
              ko: 'KTDOC는 수업, 연습 및 공연 중 학생의 사진과 동영상을 촬영할 수 있습니다. 촬영된 결과물은 학원 기록, 웹사이트, 소셜 미디어(SNS) 및 홍보 자료에 사용될 수 있음에 동의합니다.',
              en: 'KTDOC reserves the right to take photos and videos of students during classes, rehearsals, and performances. I agree that these materials may be used for school records, the website, social media, and promotional materials.',
            },
            options: [
              { key: 'yes', label: { ko: '동의합니다', en: 'Yes, I agree' }, consentValue: true },
              {
                key: 'no',
                label: { ko: '동의하지 않습니다', en: 'No, I do not agree' },
                consentValue: false,
              },
            ],
          },
          {
            key: 'q14_final',
            type: 'consent',
            required: true,
            consentKey: 'final',
            label: {
              ko: '네, 모든 안내를 확인하였으며 학원 정책에 동의합니다.',
              en: 'Yes, I have reviewed all information and agree to the studio policies.',
            },
            help: {
              ko: '본 신청서를 제출함으로써 본인(학부모/보호자)은 위에 작성한 모든 정보가 사실임을 확인하며, KTDOC 2026–2027 정규 교육과정의 등록, 공연, 퍼레이드, 환불 및 보강, 미디어 활용 등 모든 안내 사항과 학원 정책에 최종 동의합니다.',
              en: 'By submitting this form, I (parent/guardian) confirm that all the information provided above is true and accurate. I hereby give my final agreement to all instructions and studio policies for the KTDOC 2026–2027 regular curriculum, including registration, performances, the Korean Parade, refunds/make-ups, and media release.',
            },
          },
          {
            key: 'info_tuition',
            type: 'info',
            required: false,
            label: { ko: '등록금 안내', en: 'Tuition Information' },
            help: {
              ko: [
                '· 등록금은 등록 기간 및 선택한 수강 과목에 따라 결정됩니다.',
                '· 2과목 이상 등록 시 다과목 할인(Multi-Class Discount)이 적용됩니다.',
                '· 최종 등록금 및 결제 안내는 신청 내용을 확인한 후 개별 안내드립니다. 감사합니다.',
              ].join('\n'),
              en: [
                '· Tuition is determined based on the registration period and the selected classes.',
                '· A Multi-Class Discount will be applied when enrolling in 2 or more classes.',
                '· Final tuition totals and payment instructions will be sent individually after reviewing your application. Thank you.',
              ].join('\n'),
            },
          },
        ],
      },

      // ── 섹션 5: 추가 질문 (원장이 편집기에서 직접 채운다) ────
      {
        key: 'extras',
        title: { ko: '추가 질문', en: 'Additional Questions' },
        questions: [],
      },
    ],
  };
}

/**
 * 특강·단기 프로그램용 최소 신청서 — 5필드. 30초에 만들 수 있어야 한다.
 * 과목 선택지는 비워 두고 편집기의 '과목·기간' 탭에서 채운다.
 */
export function workshopPreset(): FormSchema {
  return {
    version: 1,
    presetKey: 'workshop',
    sections: [
      {
        key: 'main',
        questions: [
          {
            key: 'name',
            type: 'short',
            required: true,
            bind: 'student_name',
            label: { ko: '참가자 이름', en: 'Participant Name' },
          },
          {
            key: 'email',
            type: 'short',
            required: true,
            bind: 'email',
            format: 'email',
            label: { ko: '이메일', en: 'Email Address' },
          },
          {
            key: 'phone',
            type: 'short',
            required: true,
            bind: 'phone',
            format: 'tel',
            label: { ko: '연락처', en: 'Phone Number' },
          },
          {
            key: 'program',
            type: 'single',
            required: true,
            selectionOf: 'class',
            label: { ko: '신청 프로그램', en: 'Program' },
            help: {
              ko: '편집 화면의 "과목·기간" 탭에서 선택지를 추가하고 수업에 연결해 주세요.',
              en: 'Add options and link them to classes in the editor.',
            },
            options: [],
          },
          {
            key: 'consent',
            type: 'consent',
            required: true,
            consentKey: 'final',
            label: {
              ko: '위 안내를 확인하였으며 참가 신청에 동의합니다.',
              en: 'I have reviewed the information above and agree to participate.',
            },
          },
        ],
      },
    ],
  };
}

/** 설문 — 안내 블록 하나와 빈 문항 목록. 원장이 편집기에서 질문을 세운다. */
export function surveyPreset(): FormSchema {
  return {
    version: 1,
    presetKey: 'survey',
    sections: [
      {
        key: 'intro',
        questions: [
          {
            key: 'info_intro',
            type: 'info',
            required: false,
            label: { ko: '안내', en: 'Introduction' },
            help: {
              ko: '설문 안내 문구를 편집 화면에서 채워 주세요.',
              en: 'Fill in the survey introduction in the editor.',
            },
          },
        ],
      },
      { key: 'extras', title: { ko: '질문', en: 'Questions' }, questions: [] },
    ],
  };
}

export const PRESETS: Record<FormKind, () => FormSchema> = {
  season: seasonPreset2026,
  workshop: workshopPreset,
  survey: surveyPreset,
};
