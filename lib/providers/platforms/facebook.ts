export default class Facebook {
  /**
   * 
   * @param data 
   */
  public text(data) {
    return { type: 0, speech: data.text };
  }
  /**
   * 
   * @param data 
   */
  public quick_replies(data) {
    const replies = data.quick_replies.map(reply => reply.title.substr(0, 19));
    return { type: 2, title: data.text, replies };
  }
  /**
   * 
   * @param data 
   */
  public image(data) {
    return { type: 3, imageUrl: data.image_url };
  }
  /**
   * 
   * @param param0 
   */
  public card({ text = "", buttons = [] }) {
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
