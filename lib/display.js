/**
 * This module provides a wrapper around FBI.
 */

const { exec } = require('child_process');
const debug = require('debug')('vcrd:display');
const { resolve } = require('path');

function updateDisplay(imageName) {
  debug(`displaying ${imageName}`);
  const path = resolve(__dirname, `../res/${imageName}`);
  exec(`fbi -T 2 -d /dev/fb1 -noverbose -a ${path}`, (error) => {
    if (error) {
      debug(`error setting display: ${error}`);
    }
  });
}

module.exports.updateDisplay = updateDisplay;
