import { trimText } from "../";

export default class Facebook {
  /**
   * 
   * @param data 
   */
  public text(data: any) {
    return { speech: data.text };
  }
  /**
   * 
   * @param data 
   */
  public quick_replies(data: any) {
    const replies = data.quick_replies.map((reply: any) => trimText(reply.title));
    return { title: data.text, replies };
  }
  /**
   * 
   * @param data 
   */
  public image(data: any) {
    return { imageUrl: data.image_url };
  }
  /**
   * 
   * @param data
   */
  public card(data: any) {
    const { text = "", buttons = [] } = data;
    return {
      title: text,
      buttons: buttons.map((button: any) => ({
        text: trimText(button.title),
        postback: button.payload,
      })),
    };
  }
};
