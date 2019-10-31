import { trimText } from "../";

export default class Skype {
  /**
   * 
   * @param data any
   * @returns object
   */
  public text(data: any): object {
    return { speech: data.text };
  }
  /**
   * 
   * @param data any
   * @returns object
   */
  public quick_replies(data: any): object {
    const replies = data.quick_replies.map((reply: any) => trimText(reply.title));
    return { title: data.text, replies };
  }
  /**
   * 
   * @param data any
   * @returns object
   */
  public image(data: any): object {
    return { imageUrl: data.image_url };
  }
  /**
   * 
   * @param data any
   * @returns object
   */
  public card(data: any): object {
    return {
      title: data.text,
      subtitle: data.text,
      imageUrl: data.image_url,
      buttons: data.buttons.map((button: any) => ({
        text: button.title,
      })),
    };
  }
};
