export default class Generic {
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
  public card(data) {
    let buttons = [];
    if (data.elements) {
      buttons = data.elements.flatMap(element =>
        element.buttons.reduce((acc, button) => {
          return [...acc, { text: button.title, postback: button.payload }];
        }, [])
      );
    } else if (data.buttons) {
      buttons = data.buttons.map(button => ({
        text: button.title,
        postback: button.payload,
      }));
    }
    return { type: 1, title: data.text, buttons };
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
  public quick_replies(data) {
    const replies = data.quick_replies.map(reply => reply.label || reply.title);
    return { type: 2, title: data.text, replies };
  }
};
