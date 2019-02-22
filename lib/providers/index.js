// export { default as Skype } from './Skype';
export { default as Generic } from './Generic';
export { default as Slack } from './Slack';
export { default as Facebook } from './Facebook';

export class Provider {
  constructor(p) {
    let mod;
    let isGeneric = false;
    try {
      mod = require(`./${p.replace(/^\w/, p.substr(0, 1).toUpperCase())}`);
    } catch (_) {
      mod = require('./Generic');
      isGeneric = true;
    }
    this.isGeneric = isGeneric;
    this.platform = new mod();
  }
  create(type, data) {
    const platform = this.platform.constructor.name.toLowerCase();
    if (typeof this.platform[type] !== 'function') {
      throw new Error(`${type} is unsupported`);
    }
    return {
      ...this.platform[type](data),
      platform: !this.isGeneric ? platform : undefined,
      lang: 'en'
    };
  }
}
