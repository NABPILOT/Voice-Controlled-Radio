/**
 * This module wraps up access to hardware inputs (e.g. buttons, rotary control.)
 */

const EventEmitter = require('events');
const rpio = require('rpio');

const bounceDelay = 500;

class RotaryEncoder extends EventEmitter {
  constructor({
    clkPin = 11,
    dtPin = 36,
    pushPin = 33,
    min = 0,
    max = 100,
    initialValue = 50,
  } = {}) {
    super();

    this.value = initialValue;
    this.min = min;
    this.max = max;

    rpio.open(clkPin, rpio.INPUT, rpio.PULL_UP);
    rpio.open(dtPin, rpio.INPUT, rpio.PULL_UP);
    rpio.open(pushPin, rpio.INPUT, rpio.PULL_UP);

    rpio.read(clkPin);
    rpio.read(dtPin);
    rpio.read(pushPin);

    rpio.poll(clkPin, () => {
      const clkState = rpio.read(clkPin);
      const dtState = rpio.read(dtPin);
      if (clkState !== dtState) {
        this.value = Math.min(this.max, this.value += 1);
      } else {
        this.value = Math.max(this.min, this.value -= 1);
      }
      this.emit('change', this.value);
    }, rpio.POLL_LOW);

    let lastEvent;
    rpio.poll(pushPin, () => {
      const now = new Date();
      if (now - lastEvent < bounceDelay) {
        return;
      }
      lastEvent = now;
      this.emit('click');
    }, rpio.POLL_LOW);
  }
}

class ButtonEncoder extends EventEmitter {
  constructor(encoderPins = [7, 29, 31], triggerPin = 32) {
    super();

    encoderPins.map(pin => rpio.open(pin, rpio.INPUT, rpio.PULL_UP));
    rpio.open(triggerPin, rpio.INPUT, rpio.PULL_UP);

    let isFirstEvent = true;
    let lastEvent;
    rpio.poll(triggerPin, () => {
      if (isFirstEvent) {
        isFirstEvent = false;
        return;
      }
      const now = new Date();
      if (now - lastEvent < bounceDelay) {
        return;
      }
      lastEvent = now;
      let value = 0;
      if (rpio.read(encoderPins[0]) === 0) {
        value += 1;
      }
      if (rpio.read(encoderPins[1]) === 0) {
        value += 2;
      }
      if (rpio.read(encoderPins[2]) === 0) {
        value += 4;
      }
      this.emit('change', value);
    }, rpio.POLL_LOW);
  }
}

class Button extends EventEmitter {
  constructor(pin = 15) {
    super();

    rpio.open(pin, rpio.INPUT, rpio.PULL_UP);
    rpio.read(pin);

    let isFirstEvent = true;
    let lastEvent;
    rpio.poll(pin, () => {
      if (isFirstEvent) {
        isFirstEvent = false;
        return;
      }
      const now = new Date();
      if (now - lastEvent < bounceDelay) {
        return;
      }
      lastEvent = now;
      this.emit('click');
    });
  }
}

module.exports.RotaryEncoder = RotaryEncoder;
module.exports.ButtonEncoder = ButtonEncoder;
module.exports.Button = Button;
