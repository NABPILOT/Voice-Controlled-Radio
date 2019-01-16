/**
 * This module handles system functions.
 */

const { execSync } = require('child_process');

function shutdown() {
  execSync('shutdown -h now');
}

module.exports.shutdown = shutdown;
