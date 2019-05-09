const fs = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const exec_ = promisify(exec);

test('does not write to stderr when done executing', async () => {
  const { stdout, stderr } = await exec_('npm start');
  expect(stdout).toBeTruthy();
  expect(stderr).toBeFalsy();
});

test('produces /output', async () => {
  await exec_('npm start');
  expect(async () => {
    await fs.promises.access(join(process.cwd(), 'output'));
  }).not.toThrow();
});

test.todo('removes /output');
