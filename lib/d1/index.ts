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
  getEventById,
  getEventBySlug,
  createEvent,
  updateEvent,
  deleteEvent,
  incrementViewCount,
  // Event Images
  getEventImages,
  getEventImagesPaged,
  createEventImage,
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
  isCheckedIn,
  getUserCheckedInEventIds,
  getUserCheckins,
  getEventCheckins,
  getCheckinCountsByEvent,
  getCheckinCountsByUser,
} from './checkins';

export {
  // Programs
  getPrograms,
  getProgramById,
  getProgramBySlug,
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
  // Site Settings (key-value)
  SETTING_HERO_FEATURED_VIDEO,
  SETTING_HEADER_BACKGROUND,
  getSetting,
  getSettings,
  setSetting,
} from './settings';
