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
    const method = Object.getOwnPropertyNames(Object.getPrototypeOf(this.platform)).find(
      prop => type.includes(prop)
    );
    if (!method) {
      throw new Error(`${type} is unsupported`);
    }
    return {
      ...this.platform[method](data),
      platform: !this.isGeneric ? platform : undefined,
      lang: 'en'
    };
  }
}
