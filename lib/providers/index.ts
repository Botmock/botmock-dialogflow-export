export * from "./platforms/skype";
export * from "./platforms/slack";
export * from "./platforms/google";
export * from "./platforms/generic";
export * from "./platforms/facebook";

export type MessagePayload = {};

export default class {
  private readonly platform: any;
  /**
   * Creates new instance of PlatformProvider
   * @param platformName string
   */
  constructor(platformName: string) {
    let mod: any;
    let platform = platformName;
    if (platformName.startsWith("google")) {
      platform = "google";
    }
    try {
      mod = require(`./platforms/${platform}`).default;
    } catch (_) {
      mod = require("./platforms/generic").default;
    }
    this.platform = new mod();
  }
  /**
   * Creates json containing platform-specific data
   * @param type string
   * @param data MessagePayload
   * @returns object
   */
  create(type: string, data: MessagePayload): object {
    let methodToCallOnClass: string;
    switch (type) {
      case "api":
      case "jump":
      case "delay":
        methodToCallOnClass = undefined;
        break;
      case "button":
        methodToCallOnClass = "quick_replies";
      case "generic":
        methodToCallOnClass = "card";
        break;
      case "carousel":
        methodToCallOnClass = "list";
        break;
      default:
        methodToCallOnClass = Object.getOwnPropertyNames(
          Object.getPrototypeOf(this.platform)).find(prop => type.includes(prop)
        );
    }
    const platform = this.platform.constructor.name.toLowerCase();
    if (!methodToCallOnClass) {
      return {
        type: 4,
        payload: {
          [platform]: JSON.stringify(data),
        },
        lang: "en",
      };
    }
    return {
      ...this.platform[methodToCallOnClass](data),
      platform: platform !== "generic" ? platform : undefined,
      lang: "en",
      condition: "",
    };
  }
}
