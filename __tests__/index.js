const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
it('initializes', async () => {
  const { stdout } = await exec('node index.js --host=local');
  expect(stdout).toContain('done');
});
