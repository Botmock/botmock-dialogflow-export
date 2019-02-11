module.exports = class Facebook {
  text(data) {
    return { type: 0, speech: data.text };
  }
  button(data) {
    return { type: 0, speech: data.text };
  }
  quick_replies(data) {
    return { type: 2, speech: data.text };
  }
  card(data) {
    return {
      type: 1,
      title: data.title,
      subtitle: data.subtitle,
      imageUrl: data.image_url,
      buttons: data.buttons
    };
  }
};
