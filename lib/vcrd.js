/* eslint-disable no-console */
const asyncFind = require('async-find');
const debug = require('debug')('index');

const Alexa = require('./alexa');
const audio = require('./audio');
const { cacheIPBearersForBroadcastBearer, getBroadcastBearers } = require('./broadcast');
const { updateDisplay } = require('./display');
const { Button, RotaryEncoder } = require('./input');
const { testIP } = require('./ip');
const system = require('./system');
const Tuner = require('./tuner');
const VLC = require('./vlc');

const listeningVolume = 50;

let currentVolume = 85;
let dipEnabled = false;

async function vcr(ecc, options = {}) {
  if (!Number.isInteger(ecc) || ecc < 0x11 || ecc > 0xFF) {
    const error = new Error('ecc must be an integer value between 0x11 and 0xFF');
    throw error;
  }
  const {
    tuner: tunerOptions = {},
    alexa: alexaOptions = {},
    vlc: vlcOptions = {},
  } = options;

  updateDisplay('boot.png');

  debug('checking for IP connectivity');
  try {
    await testIP();
  } catch ({ message }) {
    updateDisplay('ip_fail.png');
    debug(`unable to verify IP connectivity: ${message}`);
    return;
  }

  debug('starting radiod child process');
  const tuner = new Tuner(tunerOptions);
  await tuner.spawn();

  tuner.on('platform', (platform) => {
    if (platform !== null) {
      updateDisplay(`${platform}.png`);
    } else {
      updateDisplay('prompt.png');
    }
  });

  debug('setting audio environment');
  audio.resetAlsaMixer();
  await tuner.setVolume(currentVolume);
  audio.setVolume(currentVolume);

  debug('performing initial scans for broadcast bearer availability');
  updateDisplay('scanning.png');
  await tuner.mute(true);
  const fmBearers = (await tuner.scan('fm')).map((bearer) => {
    const [, pi] = bearer.split('.');
    const gcc = `${pi.substring(0, 1)}${ecc.toString(16)}`;
    return bearer.replace(':*.', `:${gcc}.`);
  });
  let dabBearers = [];
  if (tunerOptions.dab) {
    dabBearers = await tuner.scan('dab');
  } else {
    debug('DAB scanning is disabled, skipping DAB scan');
  }
  await tuner.stop();
  await tuner.mute(false);
  const availableBearers = fmBearers.concat(dabBearers);
  debug(`found ${availableBearers.length} available bearers`);

  debug('caching hybrid radio meta');
  for (const bearer of availableBearers) { // eslint-disable-line no-restricted-syntax
    await cacheIPBearersForBroadcastBearer(bearer); // eslint-disable-line no-await-in-loop
  }

  debug('starting alexa child process');
  const alexa = new Alexa(alexaOptions);
  await alexa.spawn();

  const vlc = new VLC(vlcOptions);

  alexa.on('listening', () => {
    debug('alexa child process has notified of listening state');
    // display
    updateDisplay('listening.png');
    // audio
    dipEnabled = true;
    if (currentVolume > listeningVolume) {
      tuner.setVolume(listeningVolume);
      audio.setVolume(listeningVolume);
    }
  });

  alexa.on('thinking', () => {
    debug('alexa child process has notified of thinking state');
    // display
    updateDisplay('thinking.png');
  });

  alexa.on('speaking', () => {
    debug('alexa child process has notified of speaking state');
    // display
    updateDisplay('speaking.png');
    // audio
    dipEnabled = false;
    tuner.setVolume(currentVolume);
    audio.setVolume(currentVolume);
  });

  alexa.on('idle', () => {
    debug('alexa child process has notified of idle state');
    // display
    if (tuner.platform !== null) {
      updateDisplay(`${tuner.platform}.png`);
    } else {
      updateDisplay('prompt.png');
    }
    // audio
    dipEnabled = false;
    tuner.setVolume(currentVolume);
    audio.setVolume(currentVolume);
  });

  alexa.on('play', async (url) => {
    debug(`alexa child process has requested to play URL ${url}`);
    tuner.stop();
    vlc.stop();
    const allCandidates = await getBroadcastBearers(url);
    const availableCandidates = allCandidates.reduce((accumulator, bearer) => {
      if (availableBearers.includes(bearer)) {
        return accumulator.concat([bearer]);
      }
      const isWildcard = bearer.startsWith('fm:') && bearer.endsWith('.*');
      if (isWildcard) {
        const [platformGcc, pi] = bearer.split('.');
        const prefix = `${platformGcc}.${pi}.`;
        const availableMatch = availableBearers
          .find(availableBearer => availableBearer.startsWith(prefix));
        if (availableMatch) {
          return accumulator.concat([availableMatch]);
        }
      }
      return accumulator;
    }, []);
    debug(`found ${allCandidates.length} broadcast bearers, of which ${availableCandidates.length} are available`);
    try {
      await asyncFind(availableCandidates.map(bearer => async () => {
        try {
          await tuner.play(bearer);
        } catch (error) {
          debug(`failed playing bearer ${bearer}: ${error.message}`);
          debug(error);
          throw error;
        }
      }));
    } catch (error) {
      debug('failed using broadcast bearers, falling back to original URL');
      updateDisplay('ip.png');
      vlc.play(url);
    }
  });

  alexa.on('stop', () => {
    debug('alexa child process has requested to stop');
    updateDisplay('prompt.png');
    tuner.stop();
    vlc.stop();
  });

  const rotaryEncoder = new RotaryEncoder({ initialValue: currentVolume });
  rotaryEncoder.on('change', (value) => {
    currentVolume = value;
    if (!dipEnabled) {
      tuner.setVolume(value);
      audio.setVolume(value);
    }
  });
  rotaryEncoder.on('click', () => {
    debug('rotary button pressed');
    updateDisplay('prompt.png');
    tuner.stop();
    vlc.stop();
  });

  const button = new Button();
  button.on('click', () => {
    debug('power button pressed, shutting down');
    tuner.stop();
    vlc.stop();
    updateDisplay('shutdown.png');
    system.shutdown();
  });

  updateDisplay('prompt.png');
}

module.exports = vcr;
