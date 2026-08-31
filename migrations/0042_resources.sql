-- 공연 자료함 — 번호 하나로 여는 현장 자료실
--
-- 저작권 자료를 담는 자리다. r2_key는 절대 클라이언트로 나가지 않고,
-- 재생·다운로드는 우리 라우트가 중계한다(lib/resources/stream.ts).

CREATE TABLE IF NOT EXISTS resource_vaults (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  note TEXT,
  -- AES-256-GCM 암호문. 해시가 아닌 이유는 lib/resources/passcode.ts 머리말에.
  passcode_enc TEXT NOT NULL,
  event_id INTEGER,
  allow_download INTEGER NOT NULL DEFAULT 1,
  allow_email INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  -- 올리면 이미 나간 받기 링크가 전부 죽는다
  link_epoch INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resource_vaults_code ON resource_vaults(code);
CREATE INDEX IF NOT EXISTS idx_resource_vaults_event ON resource_vaults(event_id);

CREATE TABLE IF NOT EXISTS resource_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  -- 브라우저가 읽어 보낸 값. 표시 전용이고 어떤 판정에도 쓰지 않는다.
  duration_seconds INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (vault_id) REFERENCES resource_vaults(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_items_vault ON resource_items(vault_id, sort_order);

-- 언제 누구에게 나갔나. 성공만이 아니라 실패도 남긴다 —
-- 실패를 세는 것이 무차별 대입 차단의 저장소이기도 하다(lib/resources/rateLimit.ts).
CREATE TABLE IF NOT EXISTS resource_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_id INTEGER,
  code TEXT,
  action TEXT NOT NULL,
  item_id INTEGER,
  ip_hash TEXT,
  user_agent TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resource_access_code_time ON resource_access_log(code, created_at);
CREATE INDEX IF NOT EXISTS idx_resource_access_vault_time ON resource_access_log(vault_id, created_at);
