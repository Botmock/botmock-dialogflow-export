module.exports = class Facebook {
  text(data) {
    return [
      {
        type: 0,
        lang: 'en',
        speech: data.text
      }
    ];
  }
};
