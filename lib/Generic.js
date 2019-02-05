module.exports = class Generic {
  text(data) {
    return [{ type: 0, lang: 'en', speeech: JSON.stringify(data) }];
  }
};
