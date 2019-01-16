/**
 * This module provides an abstract class for external processes to extend.
 */

const { spawn } = require('child_process');
const debug = require('debug')('vcrd:external-process');
const EventEmitter = require('events');

class ExternalProcess extends EventEmitter {
  constructor(command, args = [], killSignal = 'SIGINT') {
    super();
    this.command = command;
    this.args = args;
    this.killSignal = killSignal;
    this.process = null;
  }

  spawn(additionalArgs = []) {
    if (this.process) {
      const error = new Error('Process already running');
      throw error;
    }
    const args = this.args.concat(additionalArgs);
    debug(`spawning process ${this.command} (${args})`);
    this.process = spawn(this.command, args);
    this.process.stdout.on('data', data => data.toString('utf-8').trim().split('\n').map(line => this.handleResponse(line)));
    return new Promise((resolve) => {
      this.process.stdout.once('data', () => {
        debug('process returned data, assume ready');
        resolve();
      });
    });
  }

  assertRunning() {
    if (this.process) {
      return;
    }
    const error = new Error('No process running');
    throw error;
  }

  kill() {
    this.assertRunning();
    debug('killing process');
    this.process.kill(this.killSignal);
    this.process = null;
  }

  sendCommand(command) {
    this.assertRunning();
    debug('<', command);
    this.process.stdin.write(`${command}\n`);
  }

  handleResponse() {} // eslint-disable-line class-methods-use-this
}

module.exports = ExternalProcess;
