import TextTransformer from "../text";

export * from "./platforms/skype";
export * from "./platforms/slack";
export * from "./platforms/google";
export * from "./platforms/generic";
export * from "./platforms/facebook";

/**
 * Trims text to prevent errors on dialogflow import
 * @param text text to trim
 */
export function trimText(text: string): string {
  const dialogflowTextLengthLimit = 20;
  return text.slice(0, dialogflowTextLengthLimit - 1);
}

const messageTypes = new Map([
  ["text", 0],
  ["card", 1],
  ["quick_replies", 2],
  ["image", 3],
  ["custom_payload", 4],
]);

export type MessagePayload = {};

export default class PlatformProvider {
  static googlePlatformName = "google";
  private readonly platform: any;
  private readonly text: TextTransformer;
  /**
   * Creates new instance of PlatformProvider
   * @param platformName string
   */
  constructor(platformName: string) {
    let mod: any;
    let platform = platformName;
    const { googlePlatformName } = PlatformProvider;
    if (platformName.startsWith(googlePlatformName)) {
      platform = googlePlatformName;
    }
    try {
      mod = require(`./platforms/${platform}`).default;
    } catch (_) {
      mod = require("./platforms/generic").default;
    }
    this.platform = new mod();
    this.text = new TextTransformer();
  }
  /**
   * Creates json containing platform-specific data
   * @param contentBlockType string
   * @param messagePayload MessagePayload
   * @returns object
   */
  create(contentBlockType: string = "", messagePayload: MessagePayload): object {
    let methodToCallOnClass: string;
    switch (contentBlockType) {
      case "api":
      case "jump":
      case "delay":
        methodToCallOnClass = undefined;
        break;
      case "button":
      case "generic":
        methodToCallOnClass = "card";
        break;
      case "carousel":
        methodToCallOnClass = "list";
        break;
      default:
        methodToCallOnClass = Object.getOwnPropertyNames(
          Object.getPrototypeOf(this.platform)).find(prop => contentBlockType.includes(prop)
        );
    }
    const platform = this.platform.constructor.name.toLowerCase();
    if (!methodToCallOnClass) {
      return {
        type: messageTypes.get("custom_payload"),
        payload: {
          [platform]: JSON.stringify(messagePayload),
        },
        lang: "en",
      };
    }
    const generatedResponse: any = this.platform[methodToCallOnClass](messagePayload);
    const textlikeFields = ["text", "textToSpeech", "formattedText", "image"];
    for (const field of textlikeFields) {
      if (generatedResponse[field]) {
        if (field === "image" && generatedResponse[field].accessibilityText) {
          generatedResponse[field].accessibilityText = this.text.replaceVariableCharacterInText(generatedResponse[field].accessibilityText);
          continue;
        }
        generatedResponse[field] = this.text.replaceVariableCharacterInText(generatedResponse[field]);
      }
    }
    const { googlePlatformName } = PlatformProvider;
    return {
      ...generatedResponse,
      ...(platform !== googlePlatformName ? { type: messageTypes.get(methodToCallOnClass) } : {}),
      lang: "en",
      platform: platform !== "generic" ? platform : undefined,
      condition: "",
    };
  }
}
