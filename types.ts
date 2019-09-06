interface BotmockConfig {}

export interface Config extends BotmockConfig {
  name?: string;
  teams?: string[] | string;
}
