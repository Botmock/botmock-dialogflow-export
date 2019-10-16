export default class Slack {
  /**
   * 
   * @param data 
   */
  public text(data) {
    return { type: 0, speech: data.text };
  }
};
