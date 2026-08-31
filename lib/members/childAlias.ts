/**
 * 아이 계정의 이메일 주소를 보호자 주소에서 만든다 (순수 함수)
 *
 * ## 왜 이런 게 필요한가
 *
 * 이메일이 곧 로그인 ID라 계정마다 달라야 한다. 그런데 유치원생에게는 자기
 * 이메일이 없고, 신청서에 적힌 것은 보호자 주소이며 그 주소는 이미 보호자
 * 계정이 쓰고 있다. 아이를 수업 명단에 넣으려면 계정이 있어야 하는데
 * (program_enrollments.user_id가 필수다) 만들 열쇠가 없는 상태가 된다.
 *
 * 그래서 **보호자 주소에 별칭(+)을 붙인다.** `jin@gmail.com` → `jin+celine@gmail.com`.
 * 메일은 보호자 받은편지함으로 그대로 도착하므로(Gmail·iCloud·Outlook 모두
 * 지원) 임시 비밀번호가 갈 곳이 생기고, 아이가 자라 자기 주소를 가지면
 * 이메일만 바꿔 계정을 그대로 물려줄 수 있다.
 *
 * ## 지어내지 않는 것
 *
 * 한글 이름은 로마자 표기가 사람마다 다르다(박민준 = Minjun / Min-Jun / Minjoon).
 * 우리가 고르면 그 집이 쓰지 않는 표기가 주소에 박히고, 주소는 나중에 바꾸기
 * 번거롭다. 그래서 **옮길 수 없으면 null을 돌려주고 운영진이 직접 적게 한다.**
 */

/** 별칭에 쓸 이름 길이 상한 — 전화로 불러 주고 받아 적을 수 있는 만큼만. */
const MAX_TAG = 12;

/**
 * 보호자 주소 + 아이 이름 → 아이 계정 주소.
 * 만들 수 없으면 null(운영진이 직접 입력한다).
 */
export function childAliasEmail(guardianEmail: string, childName: string): string | null {
  if (typeof guardianEmail !== 'string' || typeof childName !== 'string') return null;

  const parts = guardianEmail.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  const [rawLocal, domain] = parts;
  if (!rawLocal || !domain || !domain.includes('.')) return null;

  // 이미 붙어 있는 별칭은 걷어낸다 — 첫째 주소로 둘째를 만들면
  // jin+celine+logan@… 이 되어 버린다.
  const local = rawLocal.split('+')[0];
  if (!local) return null;

  // 첫 이름만 쓴다. 주소가 길어지면 전화로 불러 주기도, 받아 적기도 어렵다.
  const first = childName.trim().split(/\s+/)[0] ?? '';
  const tag = first
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // 아포스트로피·하이픈·비ASCII를 떨어뜨린다
    .slice(0, MAX_TAG);
  if (!tag) return null;

  return `${local}+${tag}@${domain}`;
}
