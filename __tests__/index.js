const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execP = promisify(exec);

// Cleanup output directory
afterEach(async () => {
  try {
    await fs.promises.access(`${process.cwd()}/output`, fs.constants.R_OK);
    await execP(`rm -rf ${process.cwd()}/output`);
  } catch (_) {
    // ..
  }
});

it('runs', async () => {
  const { stdout } = await execP('npm start');
  expect(stdout).toContain('done');
});
