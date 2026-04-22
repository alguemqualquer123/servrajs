import { createVersionManager } from '../../dist/api/versioning.js';
import { createApp } from '../../dist/index.js';

await test('VersionManager extracts version from header', async () => {
  const vm = createVersionManager({ defaultVersion: '2.0.0' });
  const req = { header: (name) => name === 'Accept-Version' ? '1.5.0' : undefined, query: {}, path: '/' };
  const res = { status: () => ({ json: () => {} }) };
  let versionCaptured = '';
  vm.middleware()(req, res, () => {});
  // request object is mutated with apiVersion
  if ((req).apiVersion !== '1.5.0') throw new Error('incorrect version');
});
