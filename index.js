const env = require('node-env-file');
env(`${__dirname}/.env`);
const minimist = require('minimist');
const Botmock = require('botmock');
const mkdirp = require('mkdirp');
const Sema = require('async-sema');
const fs = require('fs');
const { promisify } = require('util');
// const { cpus } = require('os');
// const { brotliCompress } = require('zlib');
// const { findRootParentId } = require('./lib/util');
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
    await mkdirpP(`${__dirname}/output/intents`);
    await mkdirpP(`${__dirname}/output/entities`);
    const { board } = await client.boards(...args);
    const { name, platform } = await client.projects(...args.slice(0, 2));
    const provider = new Provider(platform);
    const template = JSON.parse(
      await fs.promises.readFile(`${__dirname}/templates/intent.json`, 'utf8')
    );
    // TODO: doc
    await Promise.all(
      board.messages.map(async m => {
        await s.acquire();
        const is = [];
        for (const i of m.next_message_ids.map(n => n.intent)) {
          if (!i.value) {
            continue;
          }
          is.push(await client.intent(...args.slice(0, 2).concat([i.value])));
        }
        console.log(is.slice(-1));
        // await fs.promises.writeFile(
        //   `${__dirname}/output/intents${m.message_id}_usersays_en.json`,
        //   JSON.stringify(intentTemplate.map(i => i))
        // );
        // TODO: utterances -> "training phrases"
        const [response = {}] = template.responses;
        await fs.promises.writeFile(
          `${__dirname}/output/intents/${m.message_id}.json`,
          JSON.stringify({
            ...template,
            responses: [
              { ...response, messages: provider.create(m.message_type, m.payload) }
            ],
            // rootParentId: findRootParentId(m.previous_message_ids),
            parentId: m.previous_message_ids.length
              ? m.previous_message_ids[0].message_id
              : undefined,
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
    const NS_PER_MS = 1e6;
    const [seconds, nanoseconds] = process.hrtime(start);
    console.log(
      `done in ${((seconds * NS_PER_SEC + nanoseconds) / NS_PER_MS).toFixed(2)}ms`
    );
  } catch (err) {
    if (s.nrWaiting() > 0) {
      await s.drain();
    }
    console.error(err.stack);
    process.exit(1);
  }
})();
