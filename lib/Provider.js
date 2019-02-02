module.exports = class Provider {
  constructor(p) {
    const mod = require(`./${p.replace(/^\w/, p.substr(0, 1).toUpperCase())}`);
    this.platform = new mod();
  }
  create(type, data) {
    return {
      type: 0,
      lang: 'en',
      speech: this.platform[type](data)
    };
  }
};
