/** SEO 사이트 정보 폼의 각 조각이 공유하는 props */

import type { SeoBusinessInfo } from '@/lib/seoBusiness';

export interface SeoFieldsProps {
  info: SeoBusinessInfo;
  onSet: <K extends keyof SeoBusinessInfo>(key: K, value: SeoBusinessInfo[K]) => void;
  saving: boolean;
}
