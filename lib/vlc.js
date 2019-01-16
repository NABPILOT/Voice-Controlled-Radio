/* eslint-disable class-methods-use-this */

/**
 * This module provides a simple wrapper around VLC.
 *
 * It has no error handling at this stage.
 */

const debug = require('debug')('vcrd:vlc');

const ExternalProcess = require('./external-process');

class VLC extends ExternalProcess {
  constructor({ command = 'cvlc', args, killSignal } = {}) {
    super(command, args, killSignal);
    this.currentUrl = null;
  }

  async play(url) {
    if (this.process) {
      if (this.currentUrl === url) {
        debug('requesting to play the current URL, ignoring');
        return;
      }
      debug('process already running, stopping');
      this.stop();
    }
    this.currentUrl = url;
    super.spawn([url]);
  }

  async stop() {
    if (this.process) {
      super.kill();
    }
    this.currentUrl = null;
  }

  spawn() {} // prevent spawning without going via play function

  kill() {} // prevent killing without going via stop function
}

module.exports = VLC;
