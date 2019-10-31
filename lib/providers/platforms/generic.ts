import { trimText } from "../";

export default class Generic {
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
  public card(data: any): object {
    let buttons = [];
    if (data.elements) {
      buttons = data.elements.flatMap((element: any) =>
        element.buttons.reduce((acc: any, button: any) => {
          return [...acc, { text: trimText(button.title), postback: button.payload }];
        }, [])
      );
    } else if (data.buttons) {
      buttons = data.buttons.map((button: any) => ({
        text: trimText(button.title),
        postback: button.payload,
      }));
    }
    return { title: data.text, buttons };
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
  public quick_replies(data: any): object {
    const replies = data.quick_replies.map((reply: any) => trimText(reply.label || reply.title));
    return { title: data.text, replies };
  }
};
