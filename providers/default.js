/**
 * Default only supports text message type.
 *
 */

function Default() {
  this.text = function(data) {
    /*
    * data should look something like:
    *   {
    *     text: <text>,
    *   }
    */

    return {
      speech: data.text,
      type: 0
    };
  }

  this.custom = function(data) {
    /*
    * data should look something like:
    *   {
    *     text: <text>,
    *   }
    */

    return {
      payload: data,
      type: 4
    };
  }
}

module.exports = Default;
