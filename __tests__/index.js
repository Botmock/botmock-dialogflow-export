const fs = require('fs');
const { promisify } = require('util');
const { exec } = require('child_process');

const execP = promisify(exec);

afterEach(async () => {
  try {
    await fs.promises.access(`${process.cwd()}/output`, fs.constants.R_OK);
    await execP(`rm -rf ${process.cwd()}/output`);
  } catch (_) {
    // ..
  }
});

it('initializes', async () => {
  const { stdout } = await execP('npm start');
  expect(stdout).toContain('done');
});
