export * from "./Skype";
export * from "./Slack";
export * from "./Facebook";
export * from "./Google";
export * from "./Generic";

// export const TEXT_TYPE = 0;
// export const CARD_TYPE = 1;
// export const QUICK_REPLIES_TYPE = 2;
// export const IMAGE_TYPE = 3;

export class Provider {
  platform: any;

  constructor(platform) {
    let mod: any;
    // assign the platform's class to the instance of the provider
    try {
      mod = require(`./${platform.replace(
        /^\w/,
        platform.substr(0, 1).toUpperCase()
      )}`);
    } catch (_) {
      // fallback to generic if unable to import corresponding module
      mod = require("./Generic");
    }
    this.platform = new mod();
  }

  create(type, data) {
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
