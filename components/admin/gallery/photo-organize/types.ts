/** 사진 보관함 정리판이 쓰는 필터·작업 종류 */

export type OrganizedFilter = 'all' | 'assigned' | 'unassigned';
export type PublishedFilter = 'all' | 'public' | 'private';
export type SubmittedFilter = 'all' | 'student' | 'staff';
export type SortOrder = 'recent' | 'oldest' | 'taken';
export type ViewDensity = 'compact' | 'comfortable';

export type BulkAction =
  | 'publish'
  | 'unpublish'
  | 'feature'
  | 'unfeature'
  | 'assignEvent'
  | 'unassignEvent'
  | 'delete';

export interface FilterState {
  search: string;
  organized: OrganizedFilter;
  published: PublishedFilter;
  submitted: SubmittedFilter;
  eventId: number | '';
  sort: SortOrder;
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  organized: 'all',
  published: 'all',
  submitted: 'all',
  eventId: '',
  sort: 'recent',
};
