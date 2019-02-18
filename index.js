import { stdout } from 'single-line-log';
import mkdirp from 'mkdirp';
// import Sema from 'async-sema';
import uuid from 'uuid/v4';
import env from 'node-env-file';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Provider } from './lib/providers';
import { getArgs, SDKWrapper } from './lib/util';

env(`${__dirname}/.env`);

const mkdirpP = promisify(mkdirp);
const execP = promisify(exec);

const start = process.hrtime();
(async argv => {
  try {
    const { isInDebug = false, hostname = 'app' } = getArgs(argv);
    // Create an instance of the SDK and get the initial project payload
    const client = new SDKWrapper({ isInDebug, hostname });
    const { platform, board } = await client.init();

    // TODO: doc
    await mkdirpP(`${__dirname}/output/intents`);
    try {
      const provider = new Provider(platform);
      const intentTemplate = JSON.parse(
        fs.readFileSync(`${__dirname}/templates/intent.json`, 'utf8')
      );
      // const intentMap = new Map();
      // for (const message of board.messages.filter(message => !message.is_root)) {
      //   for (const { intent } of message.next_message_ids) {
      //     if (intent.value) {
      //       if (!intentMap.get(intent.value)) {
      //         intentMap.set(intent.value, [message.message_id]);
      //       } else {
      //         const existingValue = intentMap.get(intent.value);
      //         intentMap.set(intent.value, [...existingValue, message.message_id]);
      //       }
      //     }
      //   }
      // }
      await Promise.all(
        board.messages
          .filter(message => !message.is_root)
          .map(async (message, i) => {
            stdout(`\nprocessing ${i + 1} of ${board.messages.length - 1}`);
            const name = `${message.payload.nodeName}-${message.message_id}`;
            const responses = [
              {
                ...intentTemplate.responses[0],
                messages: provider.create(message.message_type, message.payload)
              }
            ];
            for (const { intent, message_id } of message.next_message_ids) {
              if (!intent.value) {
                const { message_type, payload } = board.messages.find(
                  message => message.message_id === message_id
                );
                responses.push({
                  ...intentTemplate.responses[0],
                  messages: provider.create(message_type, payload)
                });
              }
            }
            await fs.promises.writeFile(
              `${__dirname}/output/intents/${name}.json`,
              JSON.stringify({
                ...intentTemplate,
                events: [],
                responses,
                name,
                id: uuid()
              })
            );
          })
      );
    } catch (err) {
      // if (semaphore && semaphore.nrWaiting() > 0) {
      //   await semaphore.drain();
      // }
      throw err;
    }
    // TODO: write entities
    // Copy template files
    for (const filename of await fs.promises.readdir(`${__dirname}/templates`)) {
      if (filename.startsWith('intent') || filename.startsWith('entity')) {
        continue;
      }
      await fs.promises.copyFile(
        `${__dirname}/templates/${filename}`,
        `${__dirname}/output/${filename}`
      );
    }
    // Zip /output; remove it afterwards
    await execP(`zip -r ${__dirname}/output.zip ${__dirname}/output`);
    await execP(`rm -rf ${__dirname}/output`);
    const [seconds, nanoseconds] = process.hrtime(start);
    const NS_PER_SEC = 1e9;
    const NS_PER_MS = 1e6;
    stdout(`done in ${((seconds * NS_PER_SEC + nanoseconds) / NS_PER_MS).toFixed(2)}ms`);
  } catch (err) {
    console.error(err.stack);
    process.exit(1);
  }
})(process.argv);

process.on('unhandledRejection', err => {
  console.error(err.stack);
  process.exit(1);
});

process.on('uncaughtException', err => {
  console.error(err.stack);
  process.exit(1);
});
