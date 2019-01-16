#!/usr/bin/env node
/* eslint-disable no-console */

const vcrd = require('..');

if (process.argv.length < 3) {
  console.error('radiod expects at least a single argument, ecc');
  process.exit(1);
}

const ecc = parseInt(process.argv[2], 16);
if (Number.isNaN(ecc)) {
  console.error('ecc must be a hexidecimal value');
  process.exit(1);
}

let dab = true;
if (process.argv.length === 4 && process.argv[3] === '--no-dab') {
  dab = false;
}

const options = {
  alexa: {
    command: process.env.ALEXA_COMMAND || undefined,
    args: (process.env.ALEXA_ARGS ? process.env.ALEXA_ARGS.split(',') : undefined),
  },
  tuner: {
    command: process.env.TUNER_COMMAND || undefined,
    args: (process.env.TUNER_ARGS ? process.env.TUNER_ARGS.split(',') : undefined),
    dab,
  },
  vlc: {
    command: process.env.VLC_COMMAND || undefined,
    args: (process.env.VLC_ARGS ? process.env.VLC_ARGS.split(',') : undefined),
  },
};

vcrd(ecc, options).catch((error) => {
  console.error(error);
  process.exit(1);
});
