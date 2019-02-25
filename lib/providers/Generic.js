module.exports = class Generic {
  text(data) {
    return { type: 0, speech: data.text };
  }
  image(data) {
    return { type: 3, imageUrl: data.image_url };
  }
  quick_replies(data) {
    const replies = data.quick_replies.map(reply => reply.label);
    return { type: 2, title: data.text, replies };
  }
};
