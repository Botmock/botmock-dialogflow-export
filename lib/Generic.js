module.exports = class Generic {
  text(data) {
    return { type: 0, speech: data.text };
  }
};
