export default class Slack {
  /**
   * 
   * @param data any
   * @returns object
   */
  public text(data: any): object {
    return { type: 0, speech: data.text };
  }
  /**
   * @param data any
   * @returns object
   */
  public quick_replies(data: any): object {
    const replies = data.quick_replies.map((reply: any) => reply.title.substr(0, 19));
    return { type: 2, title: data.title, replies };
  }
};
