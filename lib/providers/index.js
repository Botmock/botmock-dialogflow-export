// export { default as Skype } from './Skype';
export { default as Generic } from './Generic';
export { default as Slack } from './Slack';
export { default as Facebook } from './Facebook';

export class Provider {
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
    const method = Object.getOwnPropertyNames(Object.getPrototypeOf(this.platform)).find(
      prop => type.includes(prop)
    );
    if (!method) {
      return {
        type: 4,
        payload: {
          [platform]: JSON.stringify(data)
        },
        lang: 'en'
      };
    }
    return {
      ...this.platform[method](data),
      platform: platform !== 'generic' ? platform : undefined,
      lang: 'en'
    };
  }
}
