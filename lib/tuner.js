/* eslint-disable no-underscore-dangle */
/**
 * This module provides a wrapper around the radiod tuner control process.
 */

const debug = require('debug')('vcrd:tuner');

const ExternalProcess = require('./external-process');

class Tuner extends ExternalProcess {
  constructor({ command = 'radiod', args, killSignal }) {
    super(command, args, killSignal);
    this.isPlaying = false;
    this.currentCommand = null;
    this.buffer = [];
  }

  set platform(platform) {
    if (platform === this.platform) {
      return;
    }
    this._platform = platform;
    this.emit('platform', platform);
  }

  get platform() {
    return this._platform !== undefined ? this._platform : null;
  }

  async sendCommand(command) {
    this.assertRunning();
    debug('<', command);
    this.currentCommand = command;
    this.process.stdin.write(`${command}\n`);
    return new Promise(resolve => this.once(command, resolve));
  }

  async scan(platform) {
    debug(`issuing scan command to radiod for ${platform} platform`);
    return this.sendCommand(`scan ${platform}`);
  }

  async play(bearer) {
    debug(`issuing play command to radiod for bearer ${bearer}`);
    this.isPlaying = true;
    const [platform, components] = bearer.split(':');
    let promise;
    switch (platform) {
      case 'fm': {
        this.platform = 'fm';
        const [,, frequency] = components.split('.');
        promise = this.sendCommand(`play fm ${frequency}`);
        break;
      }
      case 'dab': {
        this.platform = 'dab';
        const [gcc, eid, sid, scids] = components.split('.');
        promise = this.sendCommand(`play dab ${gcc.substring(1, 3)} ${eid} ${sid} ${scids}`);
        break;
      }
      default: {
        const error = new Error('Unrecognised bearer format');
        throw error;
      }
    }
    await promise;
  }

  async stop() {
    debug('issuing stop command to radiod');
    this.platform = null;
    await this.sendCommand('stop');
    this.isPlaying = false;
  }

  async setVolume(value) {
    const valueInt = parseInt(value, 10);
    if (Number.isNaN(valueInt) || valueInt < 1 || valueInt > 100) {
      const error = new Error('Volume value must be between 0 and 100');
      throw error;
    }
    debug(`issuing volume command to radiod with value ${value}`);
    await this.sendCommand(`volume ${valueInt}`);
  }

  async mute(on) {
    debug(`issuing mute command to radiod with ${on ? 'true' : 'false'} value`);
    await this.sendCommand(`mute ${on ? 'on' : 'off'}`);
  }

  handleResponse(line) {
    debug(`received line: ${line}`);
    if (line === '') {
      return;
    }
    if (line === '>') {
      debug('command complete');
      this.emit(this.currentCommand, this.buffer);
      this.currentCommand = null;
      this.buffer = [];
      return;
    }
    this.buffer.push(line);
  }
}

module.exports = Tuner;
