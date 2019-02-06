module.exports = class Facebook {
  text(data) {
    return [{ type: 0, lang: 'en', speech: data.text }];
  }
  button(data) {
    return [{ type: 0, lang: 'en', speech: data.text }];
  }
  quick_replies(data) {
    return [{ type: 0, lang: 'en', speech: data.text }];
  }
};
