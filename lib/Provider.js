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
    const platform = this.platform.constructor.name.toLowerCase();
    if (typeof this.platform[type] === 'function') {
      return [{ ...this.platform[type](data), platform, lang: 'en' }];
    } else {
      return [
        {
          lang: 'en',
          type: 4,
          platform,
          payload: {
            [platform]: {
              attachment: JSON.stringify(data)
            }
          }
        }
      ];
    }
  }
};
