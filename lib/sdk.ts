// import botmock from "botmock-js";
import { EventEmitter } from "events";

interface Config {}

type JSONResponse = {};

export default class SDKWrapper extends EventEmitter {
  constructor(config: Config) {
    super();
  }
  /**
   * Fetches Botmock project data using the botmock SDK
   * @returns Promise<JSONResponse>
   */
  public async fetch(): Promise<{ data: JSONResponse }> {
    return { data: {} }
  }
}
