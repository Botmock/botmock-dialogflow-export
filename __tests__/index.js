const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execP = promisify(exec);

afterEach(async () => {
  // Cleanup output directory
  try {
    await fs.promises.access(`${process.cwd()}/output`, fs.constants.R_OK);
    await execP(`rm -rf ${process.cwd()}/output`);
  } catch (_) {}
});

test('runs', async () => {
  const { stderr } = await execP('npm start');
  expect(stderr).toBeFalsy();
});
