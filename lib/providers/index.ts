export * from "./Slack";
export * from "./Facebook";
export * from "./Google";
export * from "./Generic";

export class Provider {
  platform: any;

  constructor(platform) {
    let mod: any;
    // assign the platform's class to this provider instance
    try {
      mod = require(`./${platform.replace(
        /^\w/,
        platform.substr(0, 1).toUpperCase()
      )}`);
    } catch (_) {
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
    if (type === "carousel") {
      method = "list";
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
