export * from "./platforms/Skype";
export * from "./platforms/Slack";
export * from "./platforms/Facebook";
export * from "./platforms/Google";
export * from "./platforms/Generic";

export default class {
  private readonly platform: any;
  /**
   * Creates new instance of PlatformProvider
   * @param platform string
   */
  constructor(platform: string) {
    let mod: any;
    // assign the platform's class to the instance of the provider
    try {
      mod = require(`./${platform.replace(
        /^\w/,
        platform.substr(0, 1).toUpperCase()
      )}`);
    } catch (_) {
      // fallback to generic if unable to import corresponding module
      mod = require("./platforms/Generic");
    }
    this.platform = new mod();
  }
  /**
   * Creates json containing platform-specific data
   * @param type string
   * @param data any
   * @returns object
   */
  create(type: string, data: any): object {
    const platform = this.platform.constructor.name.toLowerCase();
    // get the correct method on the correct class
    let method = Object.getOwnPropertyNames(
      Object.getPrototypeOf(this.platform)
    ).find(prop => type.includes(prop));
    // coerce odd types
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
