/**
 * This module provides a wrapper around the modified Alexa Sample App.
 */

const debug = require('debug')('vcrd:alexa');

const ExternalProcess = require('./external-process');

const commandFormat = /VCR\.(PLAY|STOP|LISTENING|THINKING|SPEAKING|IDLE)(=(.+?)|)$/;
const playCommand = 'PLAY';
const stopCommand = 'STOP';
const listeningCommand = 'LISTENING';
const thinkingCommand = 'THINKING';
const speakingCommand = 'SPEAKING';
const idleCommand = 'IDLE';

const unrecognisedCommandErrorCode = 'ERR_UNRECOGNISED_COMMAND';

class Alexa extends ExternalProcess {
  constructor({ command = 'alexa', args, killSignal } = {}) {
    super(command, args, killSignal);
  }

  stop() {
    this.sendCommand('s');
  }

  handleResponse(line) {
    const result = line.match(commandFormat);
    if (result === null) {
      return;
    }
    const [, command] = result;
    switch (command) {
      case playCommand: {
        const [, , , url] = result;
        this.emit('play', url);
        return;
      }
      case stopCommand: {
        this.emit('stop');
        return;
      }
      case listeningCommand: {
        this.emit('listening');
        return;
      }
      case thinkingCommand: {
        this.emit('thinking');
        return;
      }
      case speakingCommand: {
        this.emit('speaking');
        return;
      }
      case idleCommand: {
        this.emit('idle');
        return;
      }
      default: {
        debug(`unrecognised command received: ${command}`);
        const error = new Error();
        error.code = unrecognisedCommandErrorCode;
        this.emit('error', error);
      }
    }
  }
}

module.exports = Alexa;
