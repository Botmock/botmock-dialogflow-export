export default class Skype {
  /**
   * 
   * @param data any
   * @returns object
   */
  public text(data: any): object {
    return { type: 0, speech: data.text };
  }
  /**
   * 
   * @param data any
   * @returns object
   */
  public quick_replies(data: any): object {
    const replies = data.quick_replies.map((reply: any) => reply.title.substr(0, 19));
    return { type: 2, title: data.text, replies };
  }
  /**
   * 
   * @param data any
   * @returns object
   */
  public image(data: any): object {
    return { type: 3, imageUrl: data.image_url };
  }
  /**
   * 
   * @param data any
   * @returns object
   */
  public card(data: any): object {
    return {
      type: 1,
      title: data.text,
      subtitle: data.text,
      imageUrl: "",
      buttons: data.buttons.map(button => ({
        text: button.title,
      })),
    };
  }
};
