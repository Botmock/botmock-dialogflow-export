module.exports = class Provider {
  constructor(p) {
    let mod;
    try {
      mod = require(`./${p.replace(/^\w/, p.substr(0, 1).toUpperCase())}`);
    } catch (_) {
      mod = require('./Generic');
    }
    this.platform = new mod();
  }
  create(type, data) {
    if (typeof this.platform[type] === 'function') {
      return this.platform[type](data);
    } else {
      return [];
    }
  }
};
