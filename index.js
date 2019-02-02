const env = require('node-env-file');
env(`${__dirname}/.env`);
const minimist = require('minimist');
const Botmock = require('botmock');
const mkdirp = require('mkdirp');
const Sema = require('async-sema');
const fs = require('fs');
const { promisify } = require('util');
// const { brotliCompress } = require('zlib');
const Provider = require('./lib/Provider');
const mkdirpP = promisify(mkdirp);
const { debug, host = 'app' } = minimist(process.argv.slice(2));
const client = new Botmock({
  api_token: process.env.BOTMOCK_TOKEN,
  debug: !!debug,
  url: host
});
const args = [
  process.env.BOTMOCK_TEAM_ID,
  process.env.BOTMOCK_PROJECT_ID,
  process.env.BOTMOCK_BOARD_ID
];
// We limit the number of concurrent writes in case of an unexpectedly large number
// of board messages (i.e. nodes).
const s = new Sema(5, { capacity: 100 });
(async () => {
  const start = process.hrtime();
  try {
    const { error, board } = await client.boards(...args);
    if (error) {
      throw new Error('Board not found. Check your env variables');
    }
    await mkdirpP(`${__dirname}/output/intents`);
    await mkdirpP(`${__dirname}/output/entities`);
    const [{ platform, name }] = await client.projects(args.slice(0, 2));
    // const provider = new Provider(platform);
    const template = JSON.parse(
      await fs.promises.readFile(`${__dirname}/templates/intent.json`, 'utf8')
    );
    await Promise.all(
      board.messages.map(async m => {
        // console.log(m);
        await s.acquire();
        await fs.promises.writeFile(
          `${__dirname}/output/intents/${m.message_id}.json`,
          JSON.stringify({
            ...template,
            parentId: m.previous_message_ids.length
              ? m.previous_message_ids[0].message_id
              : undefined,
            // rootParentId: '',
            name: `${name}-${m.message_id}`,
            id: m.message_id
          })
        );
        s.release();
      })
    );
    const fileNames = await fs.promises.readdir(`${__dirname}/templates`);
    for (const f of fileNames) {
      if (f.startsWith('intent')) {
        continue;
      }
      await fs.promises.copyFile(
        `${__dirname}/templates/${f}`,
        `${__dirname}/output/${f}`
      );
    }
    const NS_PER_SEC = 1e9;
    const [seconds, nanoseconds] = process.hrtime(start);
    console.log(`done in ${((seconds * NS_PER_SEC + nanoseconds) / 1e6).toFixed(2)}ms`);
  } catch (err) {
    if (s.nrWaiting() > 0) {
      await s.drain();
    }
    console.error(err.stack);
    process.exit(1);
  }
})();
