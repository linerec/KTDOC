/**
 * D1 Module Exports
 */

export { queryD1, executeD1, checkD1Connection, batchD1 } from './client';
export {
  getLocaleMessages,
  getAllLocaleMessages,
  getLocaleByKeycode,
  upsertLocale,
  deleteLocale,
  bulkUpsertLocales,
  type LocaleContent,
  type LocaleMessages,
} from './locale';

export {
  getAllImages,
  getImageByKeycode,
  upsertImage,
  deleteImage,
  type ImageData,
} from './images';

export {
  // Categories
  getCategories,
  getCategoryBySlug,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Events
  getEvents,
  getRecentPastEvents,
  getPublishedEventsOnDay,
  getEventsOnDate,
  getEventById,
  getEventBySlug,
  eventIdExists,
  isEventSlugTaken,
  countEventsInCategory,
  createEvent,
  updateEvent,
  deleteEvent,
  incrementViewCount,
  // Event Images
  getEventImages,
  getEventImageById,
  getPreviewImagesForEvents,
  getEventImagesPaged,
  createEventImage,
  updateEventImageCaptions,
  updateImageOrder,
  deleteEventImage,
  deleteAllEventImages,
  // Event Videos
  getEventVideos,
  createEventVideo,
  updateVideoOrder,
  deleteEventVideo,
  // Loose Gallery Photos
  getGalleryPhotos,
  getGalleryPhotoById,
  getGalleryPhotoByEventImageId,
  filterR2KeysInArchive,
  createGalleryPhoto,
  updateGalleryPhoto,
  bulkSetGalleryPhotoFlag,
  markGalleryPhotoEventImage,
  clearGalleryPhotoEventImage,
  deleteGalleryPhoto,
  // Utilities
  getYears,
  getAdjacentEvents,
} from './gallery';

export {
  // Event Check-ins (학생 참여)
  checkInEvent,
  checkOutEvent,
  getCheckinEventState,
  isCheckedIn,
  getUserCheckedInEventIds,
  getUserCheckins,
  getUserCheckinsForUsers,
  getCheckedInEventIdsForUsers,
  getEventCheckins,
  getEventsWithParticipantCounts,
  getCheckinsForEvents,
  getCheckinCountsByEvent,
  getCheckinCountsByUser,
} from './checkins';

export {
  // Programs
  getPrograms,
  getProgramById,
  getProgramBySlug,
  programIdExists,
  createProgram,
  updateProgram,
  deleteProgram,
  incrementProgramViewCount,
  // Program Images
  getProgramImages,
  createProgramImage,
  updateProgramImageOrder,
  deleteProgramImage,
  deleteAllProgramImages,
} from './programs';

export {
  // Applications
  getApplications,
  getApplicationById,
  getApplicationCounts,
  createApplication,
  updateApplicationStatus,
  deleteApplication,
} from './applications';

export {
  // Program Enrollments (수강생)
  getProgramEnrollments,
  getEnrollmentById,
  getEnrollmentCountsByProgram,
  getEnrollmentsForUser,
  getEnrollmentsForUsers,
  getEnrollmentStatusesForUser,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
} from './enrollments';

export {
  // Glossary Categories (말모이 분류)
  getGlossaryCategories,
  createGlossaryCategory,
  updateGlossaryCategory,
  deleteGlossaryCategory,
  // Glossary Terms (말모이 용어)
  getGlossaryTerms,
  getGlossaryTermById,
  createGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  incrementGlossaryViewCount,
  getGlossaryTermsByIds,
  getGlossaryCounts,
  // Glossary Songs (말모이 노래·노랫말)
  getGlossarySongs,
  getPublishedSongsWithLines,
  getGlossarySongById,
  createGlossarySong,
  updateGlossarySong,
  deleteGlossarySong,
  incrementSongViewCount,
} from './glossary';

export {
  // Supply Items (준비물 카탈로그)
  getSupplyItems,
  getSupplyItemById,
  createSupplyItem,
  updateSupplyItem,
  deleteSupplyItem,
  getActiveSupplyItems,
  getSupplyCounts,
  // Supply Links (이벤트/수업 ↔ 준비물)
  getEventSupplies,
  getProgramSupplies,
  setEventSupplies,
  setProgramSupplies,
  // Supply Sets (준비물 세트)
  getSupplySets,
  getSupplySetById,
  getActiveSupplySets,
  createSupplySet,
  updateSupplySet,
  deleteSupplySet,
  getEventSupplySets,
  getProgramSupplySets,
  setEventSupplySets,
  setProgramSupplySets,
} from './supplies';

export {
  // Comments (수업·이벤트 댓글·대댓글)
  getComments,
  getCommentById,
  createComment,
  deleteComment,
  countComments,
} from './comments';

export {
  // News (뉴스·미디어 게시물)
  getNewsPosts,
  getNewsPostById,
  createNewsPost,
  updateNewsPost,
  deleteNewsPost,
} from './news';

export {
  // FAQ (Q&A — 공통·이벤트별 질문/답변)
  getFaqItems,
  getFaqItemById,
  createFaqItem,
  updateFaqItem,
  deleteFaqItem,
} from './faq';

export {
  // Site Settings (key-value)
  SETTING_HERO_FEATURED_VIDEO,
  SETTING_HERO_OVERLAY,
  SETTING_HEADER_BACKGROUND,
  SETTING_CALENDAR_CONFIG,
  getSetting,
  getSettings,
  setSetting,
} from './settings';

// 이벤트 목록의 '관점' — 화면마다 필터를 조립하지 말고 여기서 고를 것
export {
  publicPerformances,
  publicArchive,
  allKindsChronological,
  memberLibrary,
  adminAllEvents,
} from './eventViews';
export type { BrowseParams } from './eventViews';

// ── 신청서(질문지) 시스템 ──────────────────────────────────────
export { chunkParams } from './chunk';

// 응답 목록의 '관점' — eventViews 와 같은 규칙
export { publicFormBySlug, adminResponseList, rosterView } from './formViews';
export type { PublicFormView, AdminResponseListView, RosterView } from './formViews';

export {
  LOCKED_ERROR_PREFIX,
  getForms,
  getFormById,
  getOpenFormBySlug,
  getSubmittableFormBySlug,
  getFormBySlugAnyStatus,
  getFormSlugById,
  getLinkedForm,
  slugExists,
  createForm,
  snapshotSchemaVersion,
  getSchemaVersion,
  getSchemaVersionList,
  updateFormSchema,
  updateFormMeta,
  publishForm,
  startTrial,
  endTrial,
  closeForm,
  lockFormOnFirstResponse,
  duplicateForm,
  deleteForm,
} from './forms';
export type { CreateFormInput, LinkedForm } from './forms';

export {
  insertResponse,
  rebuildDerived,
  rebuildDirtyForForm,
  countDirty,
  getResponseById,
  getSelections,
  getConsents,
  getResponses,
  getResponseCountsByForm,
  getPendingResponseCounts,
  updateResponseStatus,
  addResponseNote,
  getResponseNotes,
  recordSensitiveView,
  linkResponseToMember,
  markPromoted,
  getRoster,
  getSelectionCounts,
  getResponsesForExport,
  attachSubmitter,
} from './formResponses';
export type { InsertResponseInput, RosterRow } from './formResponses';

export {
  insertMailLogs,
  getUsageCounts,
  wasEventSentToday,
  searchMailLog,
  getMailLogById,
  getBatchBody,
  purgeMailLogOlderThan,
} from './mailLog';
export type { MailLogInsert, MailLogSearch } from './mailLog';
