-- 0017_calendar_locale.sql
-- 캘린더 구독 페이지(/calendar) i18n 문구 (ko/en). locale/*.json 기본값과 동일하게 유지.
-- 인라인 편집(IntlObject)으로 운영 중 수정 가능하도록 D1에도 시드한다.

INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.eyebrow', 'CALENDAR · 일정 구독', 'CALENDAR · SUBSCRIBE')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.title', '학원 일정을 내 기기에서 받아보세요', 'Get academy events on your own device')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.description', '공연·행사·캠프 일정을 한 번만 구독하면, 새 일정이 추가되거나 시간·장소가 바뀌어도 애플·구글·아웃룩 캘린더에 자동으로 반영됩니다.', 'Subscribe once to our performances, events, and camps. When dates, times, or venues change, your Apple, Google, or Outlook calendar updates automatically.')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.addDevice', '기기 캘린더에 추가', 'Add to device calendar')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.addDeviceNote', '애플 · iPhone · Mac · Outlook', 'Apple · iPhone · Mac · Outlook')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.addGoogle', '구글 캘린더에 추가', 'Add to Google Calendar')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.addGoogleNote', 'Google Calendar', 'Google Calendar')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.copy', '주소 복사', 'Copy link')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.copied', '복사됨 ✓', 'Copied ✓')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.guide.appleIos.title', 'iPhone · iPad (애플 캘린더)', 'iPhone · iPad (Apple Calendar)')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.guide.appleIos.body', '<li>위 <strong>‘기기 캘린더에 추가’</strong>를 누르면 구독 창이 열립니다. 바로 안 열리면 ‘주소 복사’로 URL을 복사하세요.</li><li>설정 → 캘린더 → 계정 → 계정 추가 → 기타 → <strong>구독 캘린더 추가</strong>를 선택합니다.</li><li>복사한 주소를 붙여넣고 저장합니다.</li>', '<li>Tap <strong>‘Add to device calendar’</strong> above to open the subscribe dialog. If it doesn’t open, use ‘Copy link’.</li><li>Go to Settings → Calendar → Accounts → Add Account → Other → <strong>Add Subscribed Calendar</strong>.</li><li>Paste the link and save.</li>')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.guide.mac.title', 'Mac (애플 캘린더)', 'Mac (Apple Calendar)')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.guide.mac.body', '<li>캘린더 앱에서 파일 → <strong>새로운 캘린더 구독</strong>을 엽니다.</li><li>위 주소를 붙여넣고 구독을 누른 뒤, 자동 새로고침 주기를 선택합니다.</li>', '<li>In Calendar, choose File → <strong>New Calendar Subscription</strong>.</li><li>Paste the link, subscribe, then pick an auto-refresh interval.</li>')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.guide.google.title', 'Google 캘린더', 'Google Calendar')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.guide.google.body', '<li><strong>‘구글 캘린더에 추가’</strong> 버튼을 누릅니다(데스크톱 권장).</li><li>안 열리면 Google 캘린더 → 다른 캘린더 + → <strong>URL로 추가</strong>에 위 주소를 붙여넣습니다.</li><li>구글은 구독 캘린더 갱신이 최대 24시간 정도 걸릴 수 있습니다.</li>', '<li>Click <strong>‘Add to Google Calendar’</strong> (desktop recommended).</li><li>If it doesn’t open, go to Google Calendar → Other calendars + → <strong>From URL</strong> and paste the link.</li><li>Google may take up to 24 hours to refresh subscribed calendars.</li>')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.guide.outlook.title', 'Outlook', 'Outlook')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.guide.outlook.body', '<li>Outlook 캘린더 → 캘린더 추가 → <strong>웹에서 구독</strong>을 엽니다.</li><li>위 주소를 붙여넣고 이름을 지정한 뒤 가져옵니다.</li>', '<li>In Outlook Calendar, choose Add calendar → <strong>Subscribe from web</strong>.</li><li>Paste the link, name it, then import.</li>')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.calendar.sub.hint', '한 번 구독하면 새 공연·행사·캠프가 추가되거나 변경·취소될 때 자동으로 반영됩니다. 반영 시점은 각 캘린더 앱의 새로고침 주기를 따릅니다.', 'Once subscribed, new performances, events, and camps — and any changes or cancellations — appear automatically. Timing depends on each calendar app’s refresh interval.')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
