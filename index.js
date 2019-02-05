const env = require('node-env-file');
env(`${__dirname}/.env`);
const minimist = require('minimist');
const Botmock = require('botmock');
const mkdirp = require('mkdirp');
const Sema = require('async-sema');
const uuid = require('uuid/v4');
const fs = require('fs');
const { promisify } = require('util');
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
const intentTemplate = JSON.parse(
  fs.readFileSync(`${__dirname}/templates/intent.json`, 'utf8')
);
(async () => {
  const start = process.hrtime();
  // We limit the number of concurrent writes in case of an unexpectedly large number
  // of board messages (i.e. nodes).
  const s = new Sema(5, { capacity: 100 });
  try {
    await mkdirpP(`${__dirname}/output/intents`);
    // await mkdirpP(`${__dirname}/output/entities`);
    const { board } = await client.boards(...args);
    const intentDict = {};
    await Promise.all(
      board.messages.map(async m => {
        await s.acquire();
        // We associate unseen message ids with intents incident on them; writing a file
        // for an intent's utterances.
        for (const nm of m.next_message_ids) {
          if (!nm.intent.value) {
            continue;
          }
          const i = await client.intent(...args.slice(0, 2).concat([nm.intent.value]));
          if (!intentDict[nm.message_id] && i.hasOwnProperty('id')) {
            await fs.promises.writeFile(
              `${__dirname}/output/intents/${nm.message_id}_usersays_en.json`,
              JSON.stringify(
                i.utterances.map(u => ({
                  data: [{ text: u.text, userDefined: false }],
                  updated: Date.parse(i.updated_at.date),
                  isTemplate: false,
                  count: 0,
                  id: uuid()
                }))
              )
            );
            intentDict[nm.message_id] = i;
          }
        }
        s.release();
      })
    );
    const { name, platform } = await client.projects(...args.slice(0, 2));
    const provider = new Provider(platform);
    await Promise.all(
      board.messages.map(async m => {
        // TODO: all ancestor intents of this message -> "action" in each response
        // TODO: entities -> "parameters" in each response
        const [response = {}] = intentTemplate.responses;
        const { name: action } = intentDict[m.message_id] || {};
        await fs.promises.writeFile(
          `${__dirname}/output/intents/${m.message_id}.json`,
          JSON.stringify({
            ...intentTemplate,
            responses: [
              {
                ...response,
                action,
                messages: provider.create(m.message_type, m.payload)
              }
            ],
            events: m.is_root ? intentTemplate.events : [],
            // rootParentId: findRootParentId(m.previous_message_ids),
            parentId:
              !m.previous_message_ids.length ||
              m.previous_message_ids.every(i => board.root_messages.includes(i))
                ? undefined
                : m.previous_message_ids[0].message_id,
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
