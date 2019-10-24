export default class Google {
  /**
   * 
   * @param data 
   * @returns object
   */
  public text(data: any): object {
    return { type: "simple_response", textToSpeech: data.text };
  }
  /**
   * 
   * @param data 
   * @returns object
   */
  public suggestion_chips(data: any): object {
    const suggestions = data.quick_replies.map((reply: any) => ({
      title: reply.title.substr(0, 19),
    }));
    return { type: "suggestion_chips", suggestions };
  }
  /**
   * 
   * @param data 
   * @returns object
   */
  public list(data: any): object {
    const items = data.elements.map((element: any) => {
      let title: any, description: any;
      try {
        const { value: deserialDesc } = JSON.parse(element.description);
        description = deserialDesc;
      } catch (_) {
        description = element.description;
      }
      try {
        const { value: deserialTitle } = JSON.parse(title.title);
        title = deserialTitle;
      } catch (_) {
        title = element.title;
      }
      return {
        optionInfo: {
          key: element.option_key || title,
          synonyms: [],
        },
        title,
        description,
        image: {
          url: element.image_url,
          accessibilityText: title,
        },
      };
    });
    return {
      type: "list_card",
      title: data.list_title,
      items,
    };
  }
  /**
   * 
   * @param data 
   * @returns object
   */
  public card(data: any): object {
    return {
      type: "basic_card",
      title: data.title,
      subtitle: data.subtitle,
      formattedText: data.text,
      image: {
        url: data.image_url,
        accessibilityText: data.text,
      },
      buttons: [
        {
          title: data.title,
          openUrlAction: {
            url: data.link,
          },
        },
      ],
    };
  }
};
