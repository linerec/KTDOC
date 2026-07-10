import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { notifyStaffOfRegistration } from '@/lib/push/system';
import { SIGNUP_ROLES, type SignupRole } from '@/types/members';

interface RegisterBody {
  role?: SignupRole;
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  /** 이용약관·개인정보처리방침 동의 (필수) */
  agreed?: boolean;
  // 원생
  enrollmentYear?: number | string;
  // 학부모
  childName?: string;
  childEnrollmentYear?: number | string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 입학년도 파싱·검증 (1990 ~ 올해+1 사이의 정수만 허용) */
function parseYear(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const year = Math.trunc(Number(value));
  if (!Number.isFinite(year)) return null;
  const maxYear = new Date().getFullYear() + 1;
  if (year < 1990 || year > maxYear) return null;
  return year;
}

export async function POST(request: Request) {
  try {
    const body: RegisterBody = await request.json();
    const role = body.role;
    const email = body.email?.trim();
    const password = body.password;
    const name = body.name?.trim() || null;
    const phone = body.phone?.trim() || null;

    // 공통 검증
    if (!role || !SIGNUP_ROLES.includes(role)) {
      return NextResponse.json(
        { error: '가입 유형(원생/학부모)을 선택해주세요.' },
        { status: 400 }
      );
    }
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }
    // 약관·개인정보처리방침 동의 없이는 가입 불가 (동의 시각은 가입 레코드에 남긴다)
    if (body.agreed !== true) {
      return NextResponse.json(
        { error: '이용약관과 개인정보처리방침에 동의해주세요.' },
        { status: 400 }
      );
    }

    // 역할별 검증
    let enrollmentYear: number | null = null;
    let childName: string | null = null;
    let childYear: number | null = null;

    if (role === 'student') {
      enrollmentYear = parseYear(body.enrollmentYear);
      if (enrollmentYear === null) {
        return NextResponse.json(
          { error: '입학년도를 올바르게 선택해주세요.' },
          { status: 400 }
        );
      }
    } else {
      // parent
      childName = body.childName?.trim() || null;
      childYear = parseYear(body.childEnrollmentYear);
      if (!childName) {
        return NextResponse.json(
          { error: '자녀(원생)의 이름을 입력해주세요.' },
          { status: 400 }
        );
      }
      if (childYear === null) {
        return NextResponse.json(
          { error: '자녀(원생)의 입학년도를 올바르게 선택해주세요.' },
          { status: 400 }
        );
      }
    }

    // 이메일 중복 확인
    const existing = await query<{ id: string }[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: '이미 등록된 이메일입니다.' },
        { status: 409 }
      );
    }

    // 학부모: 가입 전 자녀(원생) 존재 확인 — 원생이 먼저 가입돼 있어야 한다.
    let matchedStudents: { id: string }[] = [];
    if (role === 'parent') {
      matchedStudents = await query<{ id: string }[]>(
        `SELECT id FROM users
         WHERE role = 'student' AND name = ? AND enrollment_year = ?`,
        [childName, childYear]
      );
      if (matchedStudents.length === 0) {
        return NextResponse.json(
          {
            error:
              '해당 원생을 찾을 수 없습니다. 자녀(원생)가 먼저 회원가입했는지, 이름·입학년도가 정확한지 확인해주세요.',
          },
          { status: 404 }
        );
      }
    }

    // 회원 생성 (승인 대기 상태). MySQL은 RETURNING 미지원이라 id는 앱에서 생성.
    const passwordHash = await hashPassword(password);
    const newUserId = randomUUID();
    await query(
      `INSERT INTO users (id, email, password_hash, name, phone, role, status, enrollment_year, terms_agreed_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [newUserId, email, passwordHash, name, phone, role, enrollmentYear]
    );

    // 학부모: 자녀 연결 생성 (동명이인+동일 입학년도면 미해결 상태로 두고 승인 시 지정)
    if (role === 'parent') {
      const studentId =
        matchedStudents.length === 1 ? matchedStudents[0].id : null;
      await query(
        `INSERT INTO student_guardians
           (id, guardian_id, student_id, claimed_student_name, claimed_enrollment_year)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), newUserId, studentId, childName, childYear]
      );
    }

    // 운영진에게 가입 알림(인앱+푸시) — 실패해도 가입 자체는 성공으로 처리
    await notifyStaffOfRegistration({ id: newUserId, name, role }).catch((err) =>
      console.error('가입 알림 발송 실패:', err)
    );

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
