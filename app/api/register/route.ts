/**
 * 회원가입 — /register 화면에서 부른다.
 *
 * 만드는 일 자체는 lib/members/createMember.ts 한 곳에 있다(신청서 안 가입과 공용).
 * 이 라우트가 따로 하는 일은 **가입 페이지에만 필요한 검증**뿐이다:
 * 입학년도를 반드시 받고, 자녀가 이미 가입돼 있는지 확인해 오타를 잡아 준다.
 */

import { NextResponse } from 'next/server';
import { createMember, parseEnrollmentYear } from '@/lib/members/createMember';
import { normalizeChildEntries, MAX_CHILDREN } from '@/lib/members/childEntries';
import { notifyEventAfterResponse } from '@/lib/mail/notify';
import { SIGNUP_ROLES, type SignupRole } from '@/types/members';

interface RegisterBody {
  role?: SignupRole;
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  agreed?: boolean;
  enrollmentYear?: number | string;
  /** 학부모 가입 — 자녀 목록(형제자매면 여러 명) */
  children?: { name?: string; enrollmentYear?: number | string }[];
  /** 구형 클라이언트(자녀 1명) 호환 — children 이 없을 때만 읽는다 */
  childName?: string;
  childEnrollmentYear?: number | string;
}

export async function POST(request: Request) {
  try {
    const body: RegisterBody = await request.json();

    if (!body.role || !SIGNUP_ROLES.includes(body.role)) {
      return NextResponse.json(
        { error: '가입 유형(원생/학부모)을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 가입 페이지에서는 입학년도를 반드시 받는다 — 자녀 연결의 기준이 된다.
    if (body.role === 'student' && parseEnrollmentYear(body.enrollmentYear) === null) {
      return NextResponse.json(
        { error: '입학년도를 올바르게 선택해주세요.' },
        { status: 400 }
      );
    }

    // 학부모: 자녀 목록(형제자매면 여러 명). 구형 페이로드(단일 childName)도 받는다.
    let children: { name: string; enrollmentYear: number | null }[] = [];
    if (body.role === 'parent') {
      const raw = Array.isArray(body.children)
        ? body.children
        : [{ name: body.childName, enrollmentYear: body.childEnrollmentYear }];
      if (Array.isArray(body.children) && body.children.length > MAX_CHILDREN) {
        return NextResponse.json(
          { error: `자녀는 한 번에 ${MAX_CHILDREN}명까지 등록할 수 있습니다.` },
          { status: 400 }
        );
      }
      // 공백뿐인 이름은 조용히 버리지 않고 거부한다 — 그냥 걸러 버리면 자녀가
      // 제출한 것보다 적게 가입돼도 학부모가 알 길이 없다(HTML required는 공백을 통과시킨다).
      const hasBlankName = raw.some(
        (c) => typeof c?.name !== 'string' || !c.name.trim()
      );
      children = normalizeChildEntries(raw);
      if (hasBlankName || children.length === 0) {
        return NextResponse.json(
          { error: '자녀(원생)의 이름을 입력해주세요.' },
          { status: 400 }
        );
      }
      // 이 페이지에서는 자녀마다 입학년도가 필수다 — 자녀 연결(동명이인 구분)의 기준.
      if (children.some((c) => c.enrollmentYear === null)) {
        return NextResponse.json(
          { error: '자녀(원생)의 입학년도를 올바르게 선택해주세요.' },
          { status: 400 }
        );
      }
    }

    const result = await createMember({
      role: body.role,
      email: body.email ?? '',
      password: body.password ?? '',
      name: body.name ?? '',
      phone: body.phone ?? null,
      agreed: body.agreed === true,
      enrollmentYear: parseEnrollmentYear(body.enrollmentYear),
      children,
      // 가입 페이지는 자녀 선행 가입을 요구한다(오타를 잡아 주는 쪽이 낫다).
      requireExistingChild: true,
    });

    if (!result.ok) {
      const status =
        result.code === 'email_taken' ? 409 : result.code === 'child_not_found' ? 404 : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    // 가입 확인 메일 + 운영진 알림. 응답을 붙잡지 않는다.
    // 실패해도 가입은 이미 끝났다 — 메일에 의존하면 스팸 분류 한 번에
    // 가입이 통째로 사라진다.
    notifyEventAfterResponse('member.signup', {
      userIds: [result.userId],
      data: {
        name: body.name ?? '',
        email: body.email ?? '',
        phone: body.phone ?? '',
      },
    });

    return NextResponse.json(
      {
        message:
          '가입 신청이 접수되었습니다. 관리자 승인 후 정회원으로 이용하실 수 있습니다.',
        status: 'pending',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
