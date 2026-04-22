import { VersionManager, createVersionManager } from '../../dist/api/versioning.js';

await test('VersionManager validates version strings', async () => {
  const vm = createVersionManager();
  if (!vm.isValidVersion('v1.2.3')) throw new Error('valid version rejected');
  if (vm.isValidVersion('invalid')) throw new Error('invalid version accepted');
});

await test('VersionManager compares versions correctly', async () => {
  const vm = createVersionManager();
  if (vm.compareVersions('v1.2.0', 'v1.1.5') <= 0) throw new Error('compare error');
  if (vm.compareVersions('v2.0.0', 'v2.0.0') !== 0) throw new Error('equal version compare error');
});

await test('VersionManager middleware attaches apiVersion', async () => {
  const vm = createVersionManager({ defaultVersion: '2.0.0' });
  const req = { header: (name) => name === 'Accept-Version' ? '1.5.0' : undefined, query: {}, path: '/' };
  const res = { status: () => ({ json: () => {} }) };
  vm.middleware()(req, res, () => {});
  if ((req).apiVersion !== '1.5.0') throw new Error('apiVersion not set');
});
