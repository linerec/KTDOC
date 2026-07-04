/**
 * D1 Module Exports
 */

export { queryD1, executeD1, checkD1Connection } from './client';
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
  // Site Settings (key-value)
  SETTING_HERO_FEATURED_VIDEO,
  SETTING_HERO_OVERLAY,
  SETTING_HEADER_BACKGROUND,
  SETTING_CALENDAR_CONFIG,
  getSetting,
  getSettings,
  setSetting,
} from './settings';
