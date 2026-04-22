/**
 * Servra - Pagination Helpers
 * 
 * Standardized pagination for API responses.
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CursorPagination {
  data: unknown[];
  meta: {
    nextCursor?: string;
    prevCursor?: string;
    hasMore: boolean;
    total: number;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  return {
    page: Math.max(1, parseInt(String(query.page ?? DEFAULT_PAGE), 10)),
    limit: Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query.limit ?? DEFAULT_LIMIT), 10))),
    sort: String(query.sort ?? ''),
    order: query.order === 'desc' ? 'desc' : 'asc',
  };
}

export function paginate<T>(
  data: T[],
  params: PaginationParams,
  total: number
): PaginatedResponse<T> {
  const page = params.page ?? DEFAULT_PAGE;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export function offsetPaginate<T>(
  data: T[],
  params: PaginationParams,
  total: number
): PaginatedResponse<T> {
  const page = params.page ?? DEFAULT_PAGE;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  return {
    data: data.slice(offset, offset + limit),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: offset + limit < total,
      hasPrev: offset > 0,
    },
  };
}

export function cursorPaginate<T>(
  data: T[],
  cursor: string | undefined,
  limit: number,
  total: number,
  getCursor: (item: T) => string
): CursorPagination {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, -1) : data;

  return {
    data: items,
    meta: {
      nextCursor: hasMore ? getCursor(items[items.length - 1]) : undefined,
      prevCursor: cursor,
      hasMore,
      total,
    },
  };
}

export function createCursor(item: unknown): string {
  return Buffer.from(JSON.stringify(item)).toString('base64');
}

export function parseCursor<T>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function paginatedResponse<T>(
  data: T[],
  params: PaginationParams,
  total: number
): PaginatedResponse<T> {
  return paginate(data, params, total);
}

export function linkHeader(baseUrl: string, meta: PaginationMeta): string {
  const links: string[] = [];
  const url = new URL(baseUrl);

  links.push(`<${url.toString()}>; rel="self"`);

  if (meta.hasPrev) {
    url.searchParams.set('page', String(meta.page - 1));
    links.push(`<${url.toString()}>; rel="previous"`);
  }

  if (meta.hasNext) {
    url.searchParams.set('page', String(meta.page + 1));
    links.push(`<${url.toString()}>; rel="next"`);
  }

  return links.join(', ');
}

export default {
  parsePagination,
  paginate,
  offsetPaginate,
  cursorPaginate,
  createCursor,
  parseCursor,
  paginatedResponse,
  linkHeader,
};
