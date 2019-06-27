module.exports = class Google {
  text(data) {
    return { type: "simple_response", textToSpeech: data.text };
  }

  suggestion_chips(data) {
    const suggestions = data.quick_replies.map(reply => ({
      title: reply.title.substr(0, 19),
    }));
    return { type: "suggestion_chips", suggestions };
  }

  list(data) {
    const items = data.elements.map(element => {
      let title, description;
      // TODO: hack; remove this
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

  card(data) {
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
