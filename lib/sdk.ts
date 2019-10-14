import Botmock from "@botmock-api/client";
import { EventEmitter } from "events";

interface Config {
  token: string;
  teamId: string;
  projectId: string;
  boardId: string;
}

type JSONResponse = {};

export default class SDKWrapper extends EventEmitter {
  private readonly client: any;
  constructor(config: Config) {
    super();
    this.client = new Botmock({ token: config.token });
  }
  /**
   * Fetches Botmock project data using the botmock SDK
   * @returns Promise<{ data: JSONResponse }>
   */
  public async fetch(): Promise<{ data: JSONResponse }> {
    try {
      const assets = await this.client.fetchAssets([
        "board",
        "intents",
        "entities",
        "variables"
      ]);
      return { data: null };
    } catch (err) {
      this.emit("error", err);
      return { data: {} };
    }
  }
}
