export interface PaginatedResultMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
  take: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginatedResultMeta;
}
