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
    const replies = data.quick_replies.map((reply: any) => reply.title.substr(0, 19));
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
      buttons: buttons.map(button => ({
        text: button.title,
        postback: button.payload,
      })),
    };
  }
};
