module.exports = class Slack {
  text(data) {
    return { type: 0, speech: data.text };
  }
};
