import { parsePagination, paginate, offsetPaginate, cursorPaginate, linkHeader } from '../../dist/api/pagination.js';
import { test, expect, createMockRes } from '../testkit.js';
await test('parsePagination handles defaults and limits', async () => {
  const params = parsePagination({ page: '2', limit: '150', sort: 'name', order: 'desc' });
  if (params.page !== 2) throw new Error('page wrong');
  // limit should be capped at MAX_LIMIT (100)
  if (params.limit !== 100) throw new Error('limit not capped');
  if (params.sort !== 'name') throw new Error('sort wrong');
  if (params.order !== 'desc') throw new Error('order wrong');
});

await test('paginate returns correct metadata', async () => {
  const data = [1, 2, 3];
  const meta = { page: 1, limit: 2, total: 3 };
  const result = paginate(data, { page: 1, limit: 2, sort: '', order: 'asc' }, 3);
  if (result.meta.totalPages !== 2) throw new Error('totalPages wrong');
  if (!result.meta.hasNext) throw new Error('hasNext should be true');
});

await test('offsetPaginate slices data correctly', async () => {
  const data = [1, 2, 3, 4];
  const result = offsetPaginate(data, { page: 2, limit: 2, sort: '', order: 'asc' }, 4);
  if (result.data.length !== 2 || result.data[0] !== 3) throw new Error('offset slice wrong');
});

await test('cursorPaginate builds cursor meta', async () => {
  const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const getCursor = (item) => `c${item.id}`;
  const result = cursorPaginate(data, undefined, 2, 3, getCursor);
  if (!result.meta.hasMore) throw new Error('hasMore should be true');
  if (!result.meta.nextCursor) throw new Error('nextCursor missing');
});

await test('linkHeader creates proper pagination links', async () => {
  const base = 'http://example.com/items';
  const meta = { page: 2, limit: 10, total: 30, totalPages: 3, hasNext: true, hasPrev: true };
  const link = linkHeader(base, meta);
  if (!link.includes('rel="next"')) throw new Error('missing next link');
  if (!link.includes('rel="previous"')) throw new Error('missing prev link');
});
