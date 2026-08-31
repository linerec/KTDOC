/**
 * R2 → 브라우저 중계 (server-only)
 *
 * 왜 서명된 R2 주소를 쓰지 않는가: 우리 버킷은 공개(pub-….r2.dev)다. 서명
 * 주소 안에는 **객체 키가 들어 있고**, 키를 한 번 본 사람은 공개 주소를 조립해
 * 영구히 받을 수 있다. 서명의 만료가 아무 소용이 없다. 그래서 저작권 자료는
 * 키를 절대 내보내지 않고 여기서 흘려보낸다.
 *
 * Range를 그대로 R2에 넘기는 이유는 **구간 이동(시크)** 이다. 음원 재생에서
 * 브라우저는 206을 기대하고, 전체를 200으로만 주면 진행바를 끌 수 없다.
 *
 * 이 파일이 사이트에서 유일하게 "파일을 우리 대역폭으로 나르는" 자리다. 다른
 * 이미지는 전부 공개 주소로 직접 서빙된다 — 여기만 예외이고, 그 예외의 값이
 * 저작권 보호다.
 */

import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET } from '@/lib/r2/client';

export interface StreamOptions {
  /** 브라우저가 보낸 Range 헤더 그대로. 없으면 전체 */
  range: string | null;
  contentType: string;
  /** 내려받을 때 보일 이름 */
  fileName: string;
  /** true면 attachment(저장), false면 inline(재생) */
  download: boolean;
}

export async function streamFromR2(key: string, opts: StreamOptions): Promise<Response> {
  let out;
  try {
    out = await r2Client.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: opts.range ?? undefined })
    );
  } catch (error) {
    console.error(`[resources] R2 읽기 실패(${key}):`, error);
    return new Response('파일을 읽지 못했습니다.', { status: 502 });
  }

  const body = out.Body as { transformToWebStream?: () => ReadableStream } | undefined;
  if (!body?.transformToWebStream) {
    return new Response('파일을 읽지 못했습니다.', { status: 502 });
  }

  const headers = new Headers({
    'Content-Type': opts.contentType || out.ContentType || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    // 저작권 자료다 — CDN·프록시에 남기지 않는다
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': `${opts.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(opts.fileName)}`,
    // 이 응답을 남의 페이지가 <audio>로 끌어다 쓰지 못하게
    'X-Content-Type-Options': 'nosniff',
  });
  if (out.ContentLength !== undefined) headers.set('Content-Length', String(out.ContentLength));
  if (out.ContentRange) headers.set('Content-Range', out.ContentRange);

  return new Response(body.transformToWebStream(), {
    status: out.ContentRange ? 206 : 200,
    headers,
  });
}
