import Botmock from 'botmock';

export class SDKWrapper {
  constructor({ isInDebug, hostname }) {
    this.client = new Botmock({
      api_token: process.env.BOTMOCK_TOKEN,
      debug: isInDebug,
      url: hostname
    });
    this.args = [process.env.BOTMOCK_TEAM_ID, process.env.BOTMOCK_PROJECT_ID];
  }

  async init() {
    const { platform } = await this.client.projects(...this.args);
    const { board } = await this.client.boards(
      ...this.args,
      process.env.BOTMOCK_BOARD_ID
    );
    return { platform, board };
  }

  async getIntent(value) {
    return await this.client.intent(...this.args, value);
  }
}
