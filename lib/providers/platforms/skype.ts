export default class Skype {
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
   * @param data 
   */
  public card(data) {
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
