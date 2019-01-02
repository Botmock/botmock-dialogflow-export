/**
 * This class will decide which provider to choose from.
 *
 * usage:
 * const p = new Provider("facebook")
 * p.create('text', {
 *  text: 'abc',
 * })
 */

function Provider(platform) {
  var platform_module = require("./" + platform + ".js");
  this.platform = new platform_module();
  this.platform_name = platform;
}

Provider.prototype.create = function(type, data) {
  return this.platform[type](data);
}

module.exports = Provider;
