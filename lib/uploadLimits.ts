/**
 * 업로드 용량 한도 — 클라이언트(업로드 전 검증)와 서버 라우트(최종 방어)가 공유한다.
 *
 * Vercel 함수의 요청 바디 한도가 4.5MB라 이보다 큰 요청은 프로덕션에서 서버에
 * 닿지 못하고 413으로 실패한다. FormData 오버헤드 여유를 두고 4MB로 잡는다.
 */
export const MAX_UPLOAD_FILE_BYTES = 4 * 1024 * 1024;

/** UI 안내 문구·에러 메시지용 한도 표기 */
export const MAX_UPLOAD_FILE_MB = 4;
