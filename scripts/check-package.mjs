import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = await realpath(process.cwd());
const packageRoot = path.join(root, 'packages', 'sdk');
const sourcePackage = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const version = requireString(sourcePackage.version, 'package version');
const npmCli = process.env.npm_execpath;
assert(typeof npmCli === 'string' && npmCli !== '', 'run package checks through an npm script');

const evidenceRoot = path.join(root, 'test-results', 'package');
await mkdir(evidenceRoot, { recursive: true });
const candidateRoot = await mkdtemp(path.join(evidenceRoot, 'candidate-'));
const packCache = path.join(candidateRoot, '.npm-cache');
const packResult = await runNpm(
  ['pack', './packages/sdk', '--json', '--ignore-scripts', '--pack-destination', candidateRoot],
  root,
  packCache,
);
const packRecords = JSON.parse(packResult.stdout);
assert(Array.isArray(packRecords) && packRecords.length === 1, 'npm pack returns one package');
const packRecord = packRecords[0];
const filename = requireString(packRecord.filename, 'tarball filename');
const expectedFilename = `witqq-agent-sdk-${version}.tgz`;
assert(filename === expectedFilename, `tarball is named ${expectedFilename}`);

const tarballPath = path.join(candidateRoot, filename);
const tarballBytes = await readFile(tarballPath);
const sha256 = digest('sha256', tarballBytes, 'hex');
const shasum = digest('sha1', tarballBytes, 'hex');
const integrity = `sha512-${digest('sha512', tarballBytes, 'base64')}`;
const tarballStat = await lstat(tarballPath);
assert(packRecord.shasum === shasum, 'npm pack SHA-1 matches candidate bytes');
assert(packRecord.integrity === integrity, 'npm pack integrity matches candidate bytes');
assert(packRecord.size === tarballStat.size, 'npm pack size matches candidate bytes');

const listing = await execFileAsync('tar', ['-tf', tarballPath]);
const archiveFiles = listing.stdout
  .trim()
  .split(/\r?\n/u)
  .filter((entry) => entry !== '' && !entry.endsWith('/'))
  .sort();
const recordedFiles = requireArray(packRecord.files, 'npm pack files')
  .map((entry) => `package/${requireString(entry.path, 'npm pack path')}`)
  .sort();
assertEqual(archiveFiles, recordedFiles, 'tar and npm inventories');
for (const required of ['package/LICENSE', 'package/README.md', 'package/package.json']) {
  assert(archiveFiles.includes(required), `candidate includes ${required}`);
}
for (const file of archiveFiles) {
  assert(
    file === 'package/LICENSE' ||
      file === 'package/README.md' ||
      file === 'package/package.json' ||
      file.startsWith('package/dist/'),
    `candidate contains only allowlisted public files; found ${file}`,
  );
}

const extractedRoot = path.join(candidateRoot, 'extracted');
await mkdir(extractedRoot);
await execFileAsync('tar', ['-xf', tarballPath, '-C', extractedRoot]);
const extractedPackage = path.join(extractedRoot, 'package');
for (const file of archiveFiles) {
  const candidate = path.join(extractedRoot, ...file.split('/'));
  const stat = await lstat(candidate);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${file} is a regular file`);
  assertPublishSafe(await readFile(candidate), file);
}

const manifest = JSON.parse(await readFile(path.join(extractedPackage, 'package.json'), 'utf8'));
assert(manifest.name === '@witqq/agent-sdk', 'package name is canonical');
assert(manifest.version === version, 'candidate version matches source');
assert(manifest.license === 'MIT', 'license metadata is MIT');
assert(manifest.engines?.node === '>=24.20.0', 'Node.js 24.20 contract is preserved');
assert(manifest.publishConfig?.access === 'public', 'package is explicitly public');
assert(
  manifest.repository?.url === 'git+https://github.com/witqq/agent-sdk.git' &&
    manifest.repository?.directory === 'packages/sdk',
  'repository identity includes the SDK workspace',
);
assert(manifest.homepage === 'https://agent-sdk.witqq.dev/', 'homepage is canonical');
assert(manifest.bugs?.url === 'https://github.com/witqq/agent-sdk/issues', 'issues URL is canonical');
assert(manifest.peerDependencies?.zod === '^3.23.0 || ^4.0.0', 'required zod range is preserved');
for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
  assert(typeof range === 'string' && range !== '', `peer ${name} has a range`);
  if (name !== 'zod') {
    assert(manifest.peerDependenciesMeta?.[name]?.optional === true, `peer ${name} is optional`);
  }
}
for (const dependencies of [manifest.dependencies, manifest.devDependencies]) {
  for (const value of Object.values(dependencies ?? {})) {
    assert(!/^(?:file|link|workspace):/u.test(String(value)), 'candidate has no local dependency');
  }
}
assert(
  (await readFile(path.join(extractedPackage, 'README.md'))).equals(
    await readFile(path.join(packageRoot, 'README.md')),
  ),
  'candidate README matches the SDK workspace',
);
assert(
  (await readFile(path.join(extractedPackage, 'LICENSE'))).equals(
    await readFile(path.join(root, 'LICENSE')),
  ),
  'candidate license matches the repository license',
);

const exportEntries = Object.entries(requireRecord(manifest.exports, 'package exports'));
assert(exportEntries.length === 22, 'all 22 public subpath exports are present');
const moduleSubpaths = [];
for (const [subpath, contract] of exportEntries) {
  if (typeof contract === 'string') {
    assert(subpath === './chat/react/theme.css', 'only the theme is a direct-file export');
    assert(contract === './dist/chat/react/theme.css', 'theme export path is canonical');
    await requireFile(extractedPackage, contract, `${subpath} CSS`);
    continue;
  }
  const conditions = requireRecord(contract, `${subpath} export conditions`);
  assertExactKeys(conditions, ['import', 'require'], `${subpath} conditions`);
  for (const condition of ['import', 'require']) {
    const target = requireRecord(conditions[condition], `${subpath} ${condition}`);
    assertExactKeys(target, ['default', 'types'], `${subpath} ${condition} targets`);
    await requireFile(extractedPackage, target.default, `${subpath} ${condition} runtime`);
    await requireFile(extractedPackage, target.types, `${subpath} ${condition} types`);
  }
  moduleSubpaths.push(subpath);
}

const consumerRoot = path.join(root, 'test-results', 'package-consumers');
await mkdir(consumerRoot, { recursive: true });
const consumer = await mkdtemp(path.join(consumerRoot, 'consumer-'));
const consumerCache = path.join(consumer, '.npm-cache');
const peerVersions = {};
for (const peer of Object.keys(manifest.peerDependencies)) {
  peerVersions[peer] = await installedVersion(peer);
}
await writeFile(
  path.join(consumer, 'package.json'),
  `${JSON.stringify(
    {
      name: 'agent-sdk-candidate-consumer',
      private: true,
      type: 'module',
      dependencies: { '@witqq/agent-sdk': `file:${tarballPath}`, ...peerVersions },
    },
    null,
    2,
  )}\n`,
);
await runNpm(
  ['install', '--package-lock=false', '--no-audit', '--no-fund', '--loglevel=error'],
  consumer,
  consumerCache,
  240_000,
);
const installedRoot = path.join(consumer, 'node_modules', '@witqq', 'agent-sdk');
const installedManifest = JSON.parse(await readFile(path.join(installedRoot, 'package.json'), 'utf8'));
assert(installedManifest.version === version, 'installed version matches the candidate');

const specifiers = moduleSubpaths.map(toSpecifier);
await writeFile(
  path.join(consumer, 'esm.mjs'),
  `const modules = await Promise.all(${JSON.stringify(specifiers)}.map((name) => import(name)));\nconsole.log(JSON.stringify({ count: modules.length }));\n`,
);
const esm = await execFileAsync(process.execPath, ['esm.mjs'], { cwd: consumer, timeout: 60_000 });
assert(esm.stdout.trim() === `{"count":${specifiers.length}}`, 'every ESM export imports');

await writeFile(
  path.join(consumer, 'cjs.cjs'),
  `const modules = ${JSON.stringify(specifiers)}.map((name) => require(name));\nconsole.log(JSON.stringify({ count: modules.length }));\n`,
);
const cjs = await execFileAsync(process.execPath, ['cjs.cjs'], { cwd: consumer, timeout: 60_000 });
assert(cjs.stdout.trim() === `{"count":${specifiers.length}}`, 'every CommonJS export loads');

const typeLines = specifiers.map(
  (specifier, index) => `import type * as Export${index} from '${specifier}'; type Use${index} = typeof Export${index};`,
);
await writeFile(path.join(consumer, 'contract.ts'), `${typeLines.join('\n')}\n`);
await writeFile(
  path.join(consumer, 'tsconfig.json'),
  `${JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        jsx: 'react-jsx',
        skipLibCheck: true,
      },
      include: ['contract.ts'],
    },
    null,
    2,
  )}\n`,
);
await execFileAsync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')], {
  cwd: consumer,
  timeout: 60_000,
});
const theme = await readFile(path.join(installedRoot, 'dist', 'chat', 'react', 'theme.css'), 'utf8');
assert(theme.includes(':root'), 'installed theme CSS contains its root contract');

const sourceRevision = (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
const sourceDirty =
  (await execFileAsync('git', ['status', '--porcelain'], { cwd: root })).stdout.trim() !== '';
const evidence = {
  package: {
    name: manifest.name,
    version,
    repository: manifest.repository,
    node: manifest.engines.node,
  },
  sourceRevision,
  sourceDirty,
  tarball: {
    path: tarballPath,
    filename,
    sha256,
    shasum,
    integrity,
    size: tarballStat.size,
  },
  inventory: archiveFiles,
  exports: {
    count: exportEntries.length,
    esm: specifiers.length,
    commonjs: specifiers.length,
    types: specifiers.length,
    css: true,
  },
  peers: peerVersions,
  consumer: { packageRoot: installedRoot },
};
await writeFile(
  path.join(candidateRoot, 'candidate-evidence.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
await writeFile(
  path.join(evidenceRoot, 'candidate-evidence.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify({ candidate: tarballPath, sha256, version, exports: evidence.exports }));

async function runNpm(args, cwd, cache, timeout = 120_000) {
  return execFileAsync(process.execPath, [npmCli, ...args], {
    cwd,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: '1',
      npm_config_cache: cache,
      npm_config_update_notifier: 'false',
    },
    maxBuffer: 20 * 1024 * 1024,
    timeout,
  });
}

async function installedVersion(name) {
  const packageJson = path.join(root, 'node_modules', ...name.split('/'), 'package.json');
  const installed = JSON.parse(await readFile(packageJson, 'utf8'));
  return requireString(installed.version, `installed ${name} version`);
}

async function requireFile(base, target, label) {
  assert(typeof target === 'string' && target.startsWith('./dist/'), `${label} stays in dist`);
  const stat = await lstat(path.join(base, target));
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} is a regular file`);
}

function toSpecifier(subpath) {
  return subpath === '.' ? '@witqq/agent-sdk' : `@witqq/agent-sdk/${subpath.slice(2)}`;
}

function assertPublishSafe(bytes, file) {
  assert(!bytes.includes(0), `${file} has no NUL bytes`);
  const text = bytes.toString('utf8');
  const forbidden = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
    /(?:^|\n)\s*(?:NPM_TOKEN|NODE_AUTH_TOKEN|_authToken)\s*[:=]/u,
    /\b(?:ghp|github_pat|npm)_[A-Za-z0-9_-]{20,}\b/u,
    /\/(?:Users|home)\/[A-Za-z0-9._-]+\//u,
    /(?:^|\/)moira-ws(?:\/|$)/u,
    /(?:^|\/)agent_temp_files_local(?:\/|$)/u,
  ];
  for (const pattern of forbidden) {
    assert(!pattern.test(text), `${file} is free of ${pattern}`);
  }
}

function digest(algorithm, bytes, encoding) {
  return createHash(algorithm).update(bytes).digest(encoding);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value === '') throw new Error(`${label} must be a string.`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function requireRecord(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(requireRecord(value, label)).sort();
  assert(JSON.stringify(actual) === JSON.stringify([...expected].sort()), `${label} has exact keys`);
}

function assertEqual(actual, expected, label) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} matches exactly`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Package check failed: ${message}.`);
}
