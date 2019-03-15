import EventEmitter from 'events';
import Botmock from 'botmock';

export class SDKWrapper extends EventEmitter {
  constructor({ isInDebug, hostname }) {
    super();
    this.client = new Botmock({
      api_token: process.env.BOTMOCK_TOKEN,
      debug: isInDebug,
      url: hostname
    });
    this.args = [process.env.BOTMOCK_TEAM_ID, process.env.BOTMOCK_PROJECT_ID];
  }

  async init() {
    try {
      const { platform } = await this.client.projects(...this.args);
      const { board } = await this.client.boards(
        ...this.args,
        process.env.BOTMOCK_BOARD_ID
      );
      const intents = new Map(
        (await this.client.intents(...this.args)).reduce(
          (acc, { id, ...rest }) => [...acc, [id, rest]],
          []
        )
      );
      const messagesDirectlyFollowingIntents = new Map();
      for (const { next_message_ids } of board.messages) {
        for (const { message_id, intent } of next_message_ids) {
          if (intent.value) {
            messagesDirectlyFollowingIntents.set(message_id, intent.value);
          }
        }
      }
      return { platform, board, intents, messagesDirectlyFollowingIntents };
    } catch (err) {
      this.emit('error', err);
    }
  }

  async getEntities() {
    return await this.client.entities(...this.args);
  }
}
