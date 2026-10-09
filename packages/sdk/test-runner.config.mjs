import { fileURLToPath } from 'node:url';
import { defineConfig } from 'testfold';

const artifactsDir = fileURLToPath(new URL('../../test-results/artifacts/', import.meta.url));
const suite = (name, config) => ({
  name,
  type: 'custom',
  command: `vitest run --config ${config} --reporter=json --outputFile=${JSON.stringify(`${artifactsDir}/${name}-native.json`)}`,
  resultFile: `${name}-native.json`,
  parser: './testfold-parser.mjs',
});

export default defineConfig({
  artifactsDir,
  testsDir: 'tests',
  parallel: false,
  suites: [suite('unit', 'vitest.config.ts'), suite('e2e', 'vitest.e2e.config.ts')],
});
