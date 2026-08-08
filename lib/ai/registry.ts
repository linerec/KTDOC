/**
 * AI 질의 용도(purpose) 레지스트리 — 용도 "존재"의 진실의 원천(SSOT)
 *
 * 사이트 기능이 AI를 쓰는 각 용도를 여기에 정의하고, 어떤 모델을 쓸지는
 * 관리자가 /admin/ai에서 용도별로 지정한다(D1 ai.assignments).
 *
 * 용도 추가 = 이 배열에 1건 추가 → 관리 화면에 자동 노출 → 모델 지정 후
 *            해당 기능 코드에서 askAI('용도키', ...) 호출.
 *
 * DB 의존성이 없어 서버/클라이언트 어디서나 import 가능하다.
 */

export interface AiPurpose {
  key: string;
  label: string;
  description: string;
  /** 이미지 입력이 필요한 용도(비전 미지원 모델 지정 시 관리 화면에서 경고) */
  needsVision?: boolean;
  /** 구조화(JSON) 출력이 필요한 용도 */
  needsJson?: boolean;
  /**
   * 텍스트가 아니라 **이미지를 생성**하는 용도. 이런 용도는 askAI()가 아니라
   * generateImage()로 부르고, 이미지 생성 모델(Nano Banana 등)을 지정해야 한다.
   */
  producesImage?: boolean;
}

export const AI_PURPOSES: AiPurpose[] = [
  {
    key: 'general',
    label: '일반 질의 (기본)',
    description:
      '용도를 따로 지정하지 않은 AI 질의가 사용하는 기본 모델입니다. 다른 용도가 미지정이면 이 지정으로 폴백합니다.',
  },
  {
    key: 'poster.extract',
    label: '포스터에서 공연 정보 추출',
    description:
      '공연 포스터 이미지를 읽어 제목·일시·장소 등 공연 정보를 구조화(JSON)해 추출합니다. (새 공연 만들기에서 사용 예정)',
    needsVision: true,
    needsJson: true,
  },
  {
    key: 'image.generate',
    label: '장식 이미지 생성',
    description:
      '전통 문양·장식 오브젝트 이미지를 만듭니다. 이미지 생성 모델(예: gemini-*-flash-image)을 지정해야 합니다.',
    producesImage: true,
  },
  {
    key: 'text.polish',
    label: '문구 다듬기 · 번역 보조',
    description: '관리 콘솔에서 안내 문구 작성과 한/영 번역을 보조합니다.',
  },
];

export function getAiPurpose(key: string): AiPurpose | undefined {
  return AI_PURPOSES.find((p) => p.key === key);
}

export function isKnownAiPurpose(key: string): boolean {
  return AI_PURPOSES.some((p) => p.key === key);
}
