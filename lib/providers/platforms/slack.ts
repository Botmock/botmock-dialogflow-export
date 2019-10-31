import { trimText } from "../";

export default class Slack {
  /**
   * 
   * @param data any
   * @returns object
   */
  public text(data: any): object {
    if (data.attachments) {
      return {
        payload: {
          slack: {
            text: data.text,
            attachments: data.attachments
          }
        }
      };
    }
    return { speech: data.text };
  }
  /**
   * @param data any
   * @returns object
   */
  public quick_replies(data: any): object {
    const replies = data.quick_replies.map((reply: any) => trimText(reply.title));
    return { title: data.title, replies };
  }
};
