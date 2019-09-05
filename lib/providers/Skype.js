module.exports = class Skype {
  text(data) {
    return { type: 0, speech: data.text };
  }

  quick_replies(data) {
    const replies = data.quick_replies.map(reply => reply.title.substr(0, 19));
    return { type: 2, title: data.text, replies };
  }

  image(data) {
    return { type: 3, imageUrl: data.image_url };
  }

  card(data) {
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
