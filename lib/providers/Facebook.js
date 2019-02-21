module.exports = class Facebook {
  text(data) {
    return { type: 0, speech: data.text };
  }
  quick_replies(data) {
    const replies = data.quick_replies.map(reply => reply.title);
    return { type: 2, title: data.text, replies };
  }
  image(data) {
    return { type: 3, imageUrl: data.image_url };
  }
  generic(data) {
    const [{ title, subtitle, image_url, buttons }] = data.elements;
    return {
      type: 1,
      title,
      subtitle,
      imageUrl: image_url,
      buttons
    };
  }
};
