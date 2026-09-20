/**
 * 자료함 목록 맨 위의 3단계 띠 — "이게 뭐 하는 화면이지"에 그림으로 답한다
 *
 * 부제에 이미 한 문장이 있지만, 줄글은 읽히지 않는다. 이 메뉴를 처음 연 사람이
 * 알아야 하는 것은 기능 목록이 아니라 **무엇을 대신하는가**(공연장에 USB를 들고
 * 가던 일)와 **어떤 순서로 도는가**뿐이다. 그 둘을 한 줄 그림으로 세웠다.
 *
 * 안내 페이지(/admin/resources/guide)와 **같은 그림 조각을 쓴다.** 두 화면이 서로
 * 다른 그림으로 같은 이야기를 하면, 둘 중 어느 쪽이 맞는지 아무도 모른다.
 *
 * 매일 쓰는 사람에게는 이 띠가 소음이므로 한 줄을 넘지 않게 눌러 두었다 —
 * 번호를 확인하러 온 사람의 눈이 목록에 닿기까지 한 걸음이면 끝나야 한다.
 */

import Link from 'next/link';
import T from '@/components/common/T';
import { FigHandOff, FigOpen, FigUpload } from './VaultGuideFigures';

export default function VaultIntro() {
  return (
    /* 제목을 달지 않는다 — "USB 대신 번호 하나"는 페이지 부제가 이미 말하고,
       세 단계는 스스로를 설명한다. 같은 말을 두 번 하면 둘 다 안 읽힌다. */
    <div className="rvs">
      <div className="rvs__steps">
        <div className="rvs__step">
          <FigUpload />
          <p className="rvs__text">
            <strong>
              <T k="admin.resources.introStep1">공연 전에 올려 두고</T>
            </strong>
            <span>
              <T k="admin.resources.introStep1Sub">음원 · 무대 순서표</T>
            </span>
          </p>
        </div>

        <div className="rvs__step">
          <FigHandOff />
          <p className="rvs__text">
            <strong>
              <T k="admin.resources.introStep2">번호를 알려 주고</T>
            </strong>
            <span>
              <T k="admin.resources.introStep2Sub">여섯 자리 + 비밀번호</T>
            </span>
          </p>
        </div>

        <div className="rvs__step">
          <FigOpen />
          <p className="rvs__text">
            <strong>
              <T k="admin.resources.introStep3">공연장에서 엽니다</T>
            </strong>
            <span>
              <T k="admin.resources.introStep3Sub">바로 재생 · 내려받기</T>
            </span>
          </p>
        </div>
      </div>

      <p className="rvs__more">
        <Link href="/admin/resources/guide">
          <T k="admin.resources.introMore">처음이시라면 — 사용법 보기</T>
        </Link>
      </p>
    </div>
  );
}
