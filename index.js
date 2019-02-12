const env = require('node-env-file');
env(`${__dirname}/.env`);
const minimist = require('minimist');
const Botmock = require('botmock');
const mkdirp = require('mkdirp');
const Sema = require('async-sema');
const uuid = require('uuid/v4');
const fs = require('fs');
// const { brotliCompress } = require('zlib');
const { promisify } = require('util');
const { exec } = require('child_process');
const Provider = require('./lib/Provider');
const mkdirpP = promisify(mkdirp);
const execP = promisify(exec);
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
const entityTemplate = JSON.parse(
  fs.readFileSync(`${__dirname}/templates/entity.json`, 'utf8')
);
(async () => {
  const start = process.hrtime();
  let s;
  try {
    await mkdirpP(`${__dirname}/output/intents`);
    await mkdirpP(`${__dirname}/output/entities`);
    const { board } = await client.boards(...args);
    // We limit the number of concurrent writes in case of an unexpectedly large number
    // of board messages (i.e. nodes).
    s = new Sema(5, { capacity: board.messages.length });
    const intentDict = {};
    const intentlessDict = {};
    await Promise.all(
      board.messages.map(async m => {
        await s.acquire();
        for (const nm of m.next_message_ids) {
          if (!nm.intent.value) {
            if (Array.isArray(intentlessDict[m.message_id])) {
              intentlessDict[m.message_id].push(nm.message_id);
            } else {
              intentlessDict[m.message_id] = [nm.message_id];
            }
            continue;
          }
          const int = await client.intent(...args.slice(0, 2), ...[nm.intent.value]);
          if (!intentDict[nm.message_id] && int.hasOwnProperty('id')) {
            await fs.promises.writeFile(
              `${__dirname}/output/intents/${nm.message_id}_usersays_en.json`,
              JSON.stringify(
                int.utterances.map(u => ({
                  data: [{ text: u.text, userDefined: false }],
                  updated: Date.parse(int.updated_at.date),
                  isTemplate: false,
                  count: 0,
                  id: uuid()
                }))
              )
            );
            intentDict[nm.message_id] = { name: int.name };
          }
        }
        s.release();
      })
    );
    const { name, platform } = await client.projects(...args.slice(0, 2));
    const provider = new Provider(platform);
    await Promise.all(
      board.messages.map(async m => {
        await s.acquire();
        const [response = {}] = intentTemplate.responses;
        const followsFromRoot = m.previous_message_ids.some(i =>
          board.root_messages.includes(i.message_id)
        );
        let { name: action } = intentDict[m.message_id] || {};
        if (!typeof action === 'undefined' && followsFromRoot) {
          action = 'input.welcome';
        }
        const responses = [
          {
            ...response,
            action,
            messages: provider.create(m.message_type, m.payload)
          }
        ].concat(
          ...(Array.isArray(intentlessDict[m.message_id])
            ? intentlessDict[m.message_id].map(id => {
                const adjacentMessage = board.messages.find(m => m.message_id === id);
                return {
                  ...response,
                  action,
                  messages: provider.create(
                    adjacentMessage.message_type,
                    adjacentMessage.payload
                  )
                };
              })
            : [])
        );
        await fs.promises.writeFile(
          `${__dirname}/output/intents/${m.message_id}.json`,
          JSON.stringify({
            ...intentTemplate,
            responses,
            events: followsFromRoot ? intentTemplate.events : [],
            parentId:
              !m.previous_message_ids.length || followsFromRoot
                ? undefined
                : m.previous_message_ids[0].message_id,
            name: m.payload.nodeName || `${platform}-${m.message_id}`,
            id: m.message_id
          })
        );
        s.release();
      })
    );
    for (const e of await client.entities(...args.slice(0, 2))) {
      await fs.promises.writeFile(
        `${__dirname}/output/entities/${e.name}.json`,
        JSON.stringify({
          ...entityTemplate,
          name: e.name,
          id: e.id
        })
      );
      await fs.promises.writeFile(
        `${__dirname}/output/entities/${e.name}_entries_en.json`,
        JSON.stringify(e.data)
      );
    }
    for (const f of await fs.promises.readdir(`${__dirname}/templates`)) {
      if (f.startsWith('intent')) {
        continue;
      }
      await fs.promises.copyFile(
        `${__dirname}/templates/${f}`,
        `${__dirname}/output/${f}`
      );
    }
    await execP(`zip -r ${__dirname}/output.zip ${__dirname}/output`);
    await execP(`rm -rf ${__dirname}/output`);
    const NS_PER_SEC = 1e9;
    const NS_PER_MS = 1e6;
    const [seconds, nanoseconds] = process.hrtime(start);
    console.log(
      `done in ${((seconds * NS_PER_SEC + nanoseconds) / NS_PER_MS).toFixed(2)}ms`
    );
  } catch (err) {
    if (s && s.nrWaiting() > 0) {
      await s.drain();
    }
    console.error(err.stack);
    process.exit(1);
  }
})();
