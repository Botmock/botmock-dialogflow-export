export * from "./platforms/skype";
export * from "./platforms/slack";
export * from "./platforms/google";
export * from "./platforms/generic";
export * from "./platforms/facebook";

export default class {
  private readonly platform: any;
  /**
   * Creates new instance of PlatformProvider
   * @param platformName string
   */
  constructor(platformName: string) {
    let mod: any;
    try {
      mod = require(`./platforms/${platformName}`).default;
    } catch (_) {
      mod = require("./platforms/generic").default;
    }
    this.platform = new mod();
  }
  /**
   * Creates json containing platform-specific data
   * @param data object
   * @returns object
   */
  create(type: string, data: any): object {
    const platform = this.platform.constructor.name.toLowerCase();
    // get the correct method on the correct class
    let method = Object.getOwnPropertyNames(
      Object.getPrototypeOf(this.platform)).find(prop => type.includes(prop)
    );
    // coerce method name for odd types
    switch (type) {
      case "api":
      case "delay":
        method = "text";
        break;
      case "carousel":
        method = "list";
        break;
    }
    if (type.endsWith("button") || type.endsWith("generic")) {
      method = "card";
    }
    if (!method) {
      return {
        type: 4,
        payload: {
          [platform]: JSON.stringify(data),
        },
        lang: "en",
      };
    }
    return {
      ...this.platform[method](data),
      platform: platform !== "generic" ? platform : undefined,
      lang: "en",
    };
  }
}
