/**
 * This module handles calls out to ALSA.
 */

const { execSync } = require('child_process');
const debug = require('debug')('vcrd:audio');
const loudness = require('loudness');

function errorHandler(error) {
  if (!error) {
    return;
  }
  debug(error);
}

function resetAlsaMixer() {
  execSync('alsactl restore -f /home/pi/asound.state');
}

function setVolume(volume) {
  loudness.setVolume(volume, errorHandler);
}

module.exports.resetAlsaMixer = resetAlsaMixer;
module.exports.setVolume = setVolume;
