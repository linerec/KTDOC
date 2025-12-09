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
  createEventImage,
  updateImageOrder,
  deleteEventImage,
  deleteAllEventImages,
  // Event Videos
  getEventVideos,
  createEventVideo,
  updateVideoOrder,
  deleteEventVideo,
  // Utilities
  getYears,
  getAdjacentEvents,
} from './gallery';
