/**
 * 법적 고지 문안 — 개인정보처리방침(/privacy) · 이용약관(/terms)
 *
 * ⚠️ 초안: 서비스 오픈 전 원장·법률 검토로 확정해야 한다.
 *    (신뢰·접근성 개선 Phase Step 2 — docs/operations/ux-trust-accessibility-phase.md)
 *
 * 문안은 임의 수정을 막고 이력을 남기기 위해 D1 편집 대상(IntlObject)이 아니라
 * 코드로 버전 관리한다. 클라이언트 안전 모듈(순수 데이터)이다.
 */

export interface LegalBlock {
  /** 문단 */
  p?: string;
  /** 불릿 목록 */
  list?: string[];
}

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** 문서 상단 안내문 */
  intro: string;
  /** 시행일 표기 */
  effective: string;
  sections: LegalSection[];
}

export type LegalDocKey = 'privacy' | 'terms';
export type LegalLocale = 'ko' | 'en';

const privacyKo: LegalDoc = {
  title: '개인정보처리방침',
  intro:
    'KTDOC 춤누리 한국전통무용학원(이하 "학원")은 회원과 자녀의 개인정보를 소중하게 다룹니다. 이 방침은 학원 웹사이트가 어떤 정보를 모으고, 어떻게 사용하며, 어떻게 보호하는지 설명합니다.',
  effective: '이 방침은 2026년 7월 9일부터 적용됩니다.',
  sections: [
    {
      heading: '1. 수집하는 개인정보',
      blocks: [
        { p: '학원은 서비스 운영에 필요한 최소한의 정보만 수집합니다.' },
        {
          list: [
            '회원 가입: 이름, 이메일, 비밀번호(암호화 저장), 연락처(선택), 입학년도',
            '학부모 가입: 자녀(원생)의 이름과 입학년도 — 계정 연결 목적',
            '수업·행사 운영: 참여(체크인) 기록, 수업·행사에서 촬영한 사진과 영상',
            '프로필: 회원이 직접 등록하는 프로필 사진(선택)',
            '알림: 웹 푸시 알림 수신을 신청한 기기의 구독 정보',
            '자동 수집: 로그인 상태 유지를 위한 쿠키(세션)',
          ],
        },
      ],
    },
    {
      heading: '2. 개인정보의 이용 목적',
      blocks: [
        {
          list: [
            '회원 가입 심사와 계정 관리(승인, 역할 구분, 학부모-자녀 연결)',
            '수업·공연·행사의 운영과 일정 안내',
            '수업·행사 참여 기록(아카이브)의 제공',
            '공지사항·알림의 발송',
            '학원 소개와 홍보 — 단, 회원 사진의 공개는 제4조의 동의가 있는 경우에만',
          ],
        },
      ],
    },
    {
      heading: '3. 아동(미성년 원생)의 개인정보 보호',
      blocks: [
        {
          p: '학원의 원생 다수는 미성년자입니다. 학원은 미국 아동 온라인 개인정보 보호법(COPPA)의 취지에 따라 아동의 정보를 특별히 보호합니다.',
        },
        {
          list: [
            '13세 미만 아동의 회원 가입과 정보 수집은 부모·보호자의 동의를 전제로 합니다.',
            '학부모 계정은 자녀 계정과 연결되어 자녀의 참여 기록을 함께 확인할 수 있습니다.',
            '아동의 정보는 학원 운영에 필요한 최소한으로만 수집·이용합니다.',
            '부모·보호자는 언제든지 자녀 정보의 열람·정정·삭제를 요청할 수 있습니다.',
          ],
        },
      ],
    },
    {
      heading: '4. 사진·영상의 촬영과 공개',
      blocks: [
        {
          p: '수업·공연·행사에서는 기록을 위해 사진과 영상을 촬영할 수 있습니다. 촬영물은 다음 원칙에 따라 관리합니다.',
        },
        {
          list: [
            '기본은 비공개입니다 — 로그인한 회원(본인·보호자·운영진)만 열람할 수 있습니다.',
            '공개 페이지(홍보 목적) 노출은 본인 또는 보호자가 명시적으로 동의(선택)한 경우에만 합니다.',
            '공개 동의는 언제든지 철회할 수 있으며, 철회 즉시 공개 노출이 중단됩니다.',
            '동의 여부와 무관하게 특정 사진의 삭제를 학원에 요청할 수 있습니다.',
          ],
        },
      ],
    },
    {
      heading: '5. 보관 기간과 파기',
      blocks: [
        {
          list: [
            '회원 정보는 회원 자격이 유지되는 동안 보관합니다.',
            '탈퇴 또는 삭제 요청 시 지체 없이 파기합니다. 다만 법령상 보존 의무가 있는 정보는 해당 기간 동안 분리 보관 후 파기합니다.',
          ],
        },
      ],
    },
    {
      heading: '6. 제3자 제공과 처리 위탁',
      blocks: [
        { p: '학원은 회원의 개인정보를 판매하지 않으며, 광고·마케팅 목적으로 제3자에게 제공하지 않습니다.' },
        {
          p: '서비스 운영을 위해 다음과 같은 인프라 제공자에게 데이터 처리를 위탁합니다: 웹 호스팅(Vercel), 데이터 저장(Cloudflare 및 데이터베이스 호스팅 제공자). 위탁받은 업체는 위탁 목적 범위에서만 정보를 처리합니다.',
        },
      ],
    },
    {
      heading: '7. 쿠키의 사용',
      blocks: [
        {
          p: '이 사이트는 로그인 상태 유지를 위한 필수 쿠키만 사용합니다. 광고·추적 목적의 쿠키는 사용하지 않습니다.',
        },
      ],
    },
    {
      heading: '8. 이용자의 권리와 행사 방법',
      blocks: [
        {
          p: '회원과 보호자는 언제든지 다음을 요청할 수 있습니다: 개인정보의 열람·정정·삭제, 사진 공개 동의의 철회, 계정 탈퇴. 사이트의 프로필 기능을 이용하거나, 학원에 전화·방문으로 요청하시면 됩니다.',
        },
      ],
    },
    {
      heading: '9. 문의처',
      blocks: [
        {
          p: '개인정보에 관한 문의는 아래 학원 연락처로 해 주세요. 확인 후 성실히 답변드립니다.',
        },
      ],
    },
  ],
};

const privacyEn: LegalDoc = {
  title: 'Privacy Policy',
  intro:
    'KTDOC — Korean Traditional Dance of Choomnoori (the "Academy") values the personal information of our members and their children. This policy explains what information our website collects, how it is used, and how it is protected.',
  effective: 'This policy is effective as of July 9, 2026.',
  sections: [
    {
      heading: '1. Information We Collect',
      blocks: [
        { p: 'We collect only the minimum information needed to run our services.' },
        {
          list: [
            'Registration: name, email, password (stored encrypted), phone (optional), enrollment year',
            'Parent registration: the child (student)’s name and enrollment year — for account linking',
            'Classes & events: participation (check-in) records, photos and videos taken at classes and events',
            'Profile: a profile photo the member chooses to upload (optional)',
            'Notifications: push subscription details for devices that opt into web push',
            'Automatic: cookies used to keep you signed in (session)',
          ],
        },
      ],
    },
    {
      heading: '2. How We Use Information',
      blocks: [
        {
          list: [
            'Reviewing registrations and managing accounts (approval, roles, parent–child linking)',
            'Operating classes, performances, and events, and sharing schedules',
            'Providing participation records (archive)',
            'Sending announcements and notifications',
            'Introducing and promoting the Academy — member photos are shown publicly only with the consent described in Section 4',
          ],
        },
      ],
    },
    {
      heading: '3. Children’s Privacy',
      blocks: [
        {
          p: 'Many of our students are minors. In line with the Children’s Online Privacy Protection Act (COPPA), we give children’s information special protection.',
        },
        {
          list: [
            'Registration and data collection for children under 13 require parental or guardian consent.',
            'Parent accounts are linked to their child’s account and can view the child’s participation records.',
            'We collect and use children’s information only to the minimum extent needed to run the Academy.',
            'Parents and guardians may request access, correction, or deletion of their child’s information at any time.',
          ],
        },
      ],
    },
    {
      heading: '4. Photos and Videos',
      blocks: [
        {
          p: 'Photos and videos may be taken at classes, performances, and events for record-keeping. They are managed under these principles:',
        },
        {
          list: [
            'Private by default — only signed-in members (the student, their guardians, and staff) can view them.',
            'Public display (for promotion) happens only when the student or their guardian has explicitly opted in.',
            'Consent can be withdrawn at any time, and public display stops immediately.',
            'Regardless of consent, you may ask the Academy to remove a specific photo.',
          ],
        },
      ],
    },
    {
      heading: '5. Retention and Deletion',
      blocks: [
        {
          list: [
            'Member information is kept while the membership is active.',
            'Upon withdrawal or a deletion request, information is deleted without delay, except where retention is required by law, in which case it is stored separately for the required period and then deleted.',
          ],
        },
      ],
    },
    {
      heading: '6. Sharing and Processors',
      blocks: [
        { p: 'We do not sell personal information, and we do not share it with third parties for advertising or marketing.' },
        {
          p: 'To operate the service, we use infrastructure providers that process data on our behalf: web hosting (Vercel) and data storage (Cloudflare and our database hosting provider). These providers process information only for the purposes we entrust to them.',
        },
      ],
    },
    {
      heading: '7. Cookies',
      blocks: [
        {
          p: 'This site uses only essential cookies to keep you signed in. We do not use advertising or tracking cookies.',
        },
      ],
    },
    {
      heading: '8. Your Rights',
      blocks: [
        {
          p: 'Members and guardians may at any time request: access to, correction of, or deletion of personal information; withdrawal of photo-publication consent; and account deletion. You can use the profile features on this site, or contact the Academy by phone or in person.',
        },
      ],
    },
    {
      heading: '9. Contact',
      blocks: [
        {
          p: 'For privacy questions, please use the Academy contact information below. We will respond sincerely after review.',
        },
      ],
    },
  ],
};

const termsKo: LegalDoc = {
  title: '이용약관',
  intro:
    '이 약관은 KTDOC 춤누리 한국전통무용학원(이하 "학원")이 운영하는 웹사이트의 이용 조건을 정합니다. 회원 가입 시 이 약관에 동의한 것으로 봅니다.',
  effective: '이 약관은 2026년 7월 9일부터 적용됩니다.',
  sections: [
    {
      heading: '1. 목적',
      blocks: [
        {
          p: '이 사이트는 학원 소개(공연·수업·소식)와 회원(원생·학부모) 대상 서비스(일정, 참여 기록, 알림 등)를 제공합니다.',
        },
      ],
    },
    {
      heading: '2. 회원 가입과 승인',
      blocks: [
        {
          list: [
            '회원 가입은 원생 본인 또는 학부모·보호자가 신청할 수 있습니다.',
            '가입은 학원의 승인 후 완료됩니다. 학원은 실제 원생·보호자가 아닌 신청을 승인하지 않을 수 있습니다.',
            '가입 시에는 정확한 정보를 제공해야 하며, 변경 시 갱신해야 합니다.',
          ],
        },
      ],
    },
    {
      heading: '3. 계정과 비밀번호',
      blocks: [
        {
          list: [
            '계정과 비밀번호는 본인이 관리해야 하며, 타인과 공유할 수 없습니다.',
            '비밀번호를 잊은 경우 학원에 요청하면 임시 비밀번호를 발급해 드립니다. 임시 비밀번호로 로그인한 뒤에는 반드시 새 비밀번호를 설정해야 합니다.',
            '계정 도용이 의심되면 즉시 학원에 알려 주세요.',
          ],
        },
      ],
    },
    {
      heading: '4. 서비스의 내용',
      blocks: [
        {
          list: [
            '수업·공연·행사 일정과 안내',
            '본인(자녀)의 수업·행사 참여 기록(아카이브) 열람',
            '공지사항과 알림 수신',
            '학원 자료(사진·영상·소식)의 열람',
          ],
        },
      ],
    },
    {
      heading: '5. 회원의 의무',
      blocks: [
        {
          list: [
            '타인의 정보를 도용하거나 허위 정보를 등록하지 않습니다.',
            '사이트에서 열람한 다른 회원(특히 아동)의 사진·영상·개인정보를 무단으로 저장·배포하지 않습니다.',
            '서비스 운영을 방해하는 행위(무단 접근 시도 등)를 하지 않습니다.',
          ],
        },
      ],
    },
    {
      heading: '6. 사진·게시물과 저작권',
      blocks: [
        {
          list: [
            '사이트의 콘텐츠(문구·사진·영상·디자인)에 대한 권리는 학원 또는 해당 권리자에게 있습니다.',
            '회원 사진의 공개 범위는 개인정보처리방침 제4조(동의 기반)를 따릅니다.',
            '회원이 제출한 사진은 학원 운영·기록 목적 범위에서 이용되며, 공개 노출은 동의가 있는 경우에만 합니다.',
          ],
        },
      ],
    },
    {
      heading: '7. 서비스의 변경·중단과 이용 제한',
      blocks: [
        {
          list: [
            '학원은 서비스 내용을 변경하거나 점검 등으로 일시 중단할 수 있습니다.',
            '이 약관을 위반한 회원의 이용을 제한(정지)할 수 있습니다. 이 경우 사유를 안내합니다.',
          ],
        },
      ],
    },
    {
      heading: '8. 책임의 한계',
      blocks: [
        {
          p: '학원은 서비스를 성실히 운영하되, 천재지변·통신 장애 등 학원의 합리적 통제를 벗어난 사유로 인한 손해에 대해서는 책임을 지지 않습니다.',
        },
      ],
    },
    {
      heading: '9. 준거법',
      blocks: [
        {
          p: '이 약관은 미국 뉴저지주 법에 따라 해석됩니다.',
        },
      ],
    },
    {
      heading: '10. 문의처',
      blocks: [
        {
          p: '약관에 관한 문의는 아래 학원 연락처로 해 주세요.',
        },
      ],
    },
  ],
};

const termsEn: LegalDoc = {
  title: 'Terms of Service',
  intro:
    'These terms govern the use of the website operated by KTDOC — Korean Traditional Dance of Choomnoori (the "Academy"). By registering as a member, you agree to these terms.',
  effective: 'These terms are effective as of July 9, 2026.',
  sections: [
    {
      heading: '1. Purpose',
      blocks: [
        {
          p: 'This site introduces the Academy (performances, classes, news) and provides member services for students and parents (schedules, participation records, notifications, and more).',
        },
      ],
    },
    {
      heading: '2. Registration and Approval',
      blocks: [
        {
          list: [
            'Students themselves or their parents/guardians may register.',
            'Membership is completed after the Academy’s approval. The Academy may decline applications that are not from actual students or guardians.',
            'You must provide accurate information and keep it up to date.',
          ],
        },
      ],
    },
    {
      heading: '3. Accounts and Passwords',
      blocks: [
        {
          list: [
            'You are responsible for your account and password, and must not share them with others.',
            'If you forget your password, contact the Academy and we will issue a temporary password. After signing in with it, you must set a new password.',
            'If you suspect unauthorized use of your account, notify the Academy immediately.',
          ],
        },
      ],
    },
    {
      heading: '4. Services',
      blocks: [
        {
          list: [
            'Schedules and information for classes, performances, and events',
            'Viewing your (or your child’s) participation records (archive)',
            'Receiving announcements and notifications',
            'Viewing Academy materials (photos, videos, news)',
          ],
        },
      ],
    },
    {
      heading: '5. Member Responsibilities',
      blocks: [
        {
          list: [
            'Do not impersonate others or register false information.',
            'Do not save or distribute photos, videos, or personal information of other members (especially children) viewed on this site without permission.',
            'Do not interfere with the operation of the service (e.g., unauthorized access attempts).',
          ],
        },
      ],
    },
    {
      heading: '6. Content and Copyright',
      blocks: [
        {
          list: [
            'Rights to the site’s content (text, photos, videos, design) belong to the Academy or the respective rights holders.',
            'Public display of member photos follows Section 4 of the Privacy Policy (consent-based).',
            'Photos submitted by members are used within the scope of Academy operations and records; public display requires consent.',
          ],
        },
      ],
    },
    {
      heading: '7. Changes, Interruptions, and Restrictions',
      blocks: [
        {
          list: [
            'The Academy may change the service or temporarily suspend it for maintenance.',
            'The Academy may restrict (suspend) members who violate these terms, and will explain the reason.',
          ],
        },
      ],
    },
    {
      heading: '8. Limitation of Liability',
      blocks: [
        {
          p: 'The Academy operates the service in good faith, but is not liable for damages caused by events beyond its reasonable control, such as natural disasters or network failures.',
        },
      ],
    },
    {
      heading: '9. Governing Law',
      blocks: [
        {
          p: 'These terms are interpreted under the laws of the State of New Jersey, USA.',
        },
      ],
    },
    {
      heading: '10. Contact',
      blocks: [
        {
          p: 'For questions about these terms, please use the Academy contact information below.',
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocKey, Record<LegalLocale, LegalDoc>> = {
  privacy: { ko: privacyKo, en: privacyEn },
  terms: { ko: termsKo, en: termsEn },
};
