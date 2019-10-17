export default class Facebook {
  /**
   * 
   * @param data 
   */
  public text(data: any) {
    return { type: 0, speech: data.text };
  }
  /**
   * 
   * @param data 
   */
  public quick_replies(data: any) {
    const replies = data.quick_replies.map((reply: any) => reply.title.substr(0, 19));
    return { type: 2, title: data.text, replies };
  }
  /**
   * 
   * @param data 
   */
  public image(data: any) {
    return { type: 3, imageUrl: data.image_url };
  }
  /**
   * 
   * @param data
   */
  public card(data: any) {
    const { text = "", buttons = [] } = data;
    return {
      type: 1,
      title: text,
      buttons: buttons.map(button => ({
        text: button.title,
        postback: button.payload,
      })),
    };
  }
};
