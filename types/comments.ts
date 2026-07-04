// types/comments.ts
// 수업·이벤트 댓글·대댓글 + 공지 타입 정의
// user_id = MySQL users.id(UUID). 작성자 이름·사진은 호출부에서 getUserProfilesByIds로 결합.

export type CommentTargetType = 'program' | 'event';

export interface Comment {
  id: number;
  target_type: CommentTargetType;
  target_id: number;
  parent_id: number | null;
  user_id: string;
  body: string;
  is_announcement: number;
  created_at: string;
  updated_at: string;
}

/** 작성자 정보를 결합한 표시용 댓글. */
export interface CommentWithAuthor extends Comment {
  author_name: string | null;
  author_photo: string | null;
}

/** 최상위 댓글 + 대댓글 목록(1단계). */
export interface CommentThread extends CommentWithAuthor {
  replies: CommentWithAuthor[];
}

export interface CreateCommentInput {
  target_type: CommentTargetType;
  target_id: number;
  parent_id?: number | null;
  user_id: string;
  body: string;
  is_announcement?: boolean;
}
