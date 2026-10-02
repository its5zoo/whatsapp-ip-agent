import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const testDirectory = __dirname;
const tsxBinary = path.resolve(__dirname, '../node_modules/.bin/tsx');
const resetUtility = path.resolve(testDirectory, 'resetTestDatabase.ts');
const testFiles = fs.readdirSync(testDirectory)
  .filter(file => file.endsWith('.test.ts'))
  .sort()
  .map(file => path.resolve(testDirectory, file));

function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
    return 1;
  }
  if (result.status !== null) return result.status;
  if (result.signal) {
    console.error(`${command} terminated by ${result.signal}`);
    return 1;
  }
  return 1;
}

for (const testFile of testFiles) {
  const resetStatus = run(tsxBinary, [resetUtility]);
  if (resetStatus !== 0) {
    process.exitCode = resetStatus;
    break;
  }

  const testStatus = run(tsxBinary, [
    '--env-file=.env.test',
    '--test',
    '--test-concurrency=1',
    testFile
  ]);
  if (testStatus !== 0) {
    process.exitCode = testStatus;
    break;
  }
}
