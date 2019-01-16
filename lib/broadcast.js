/**
 * This module deals with the broadcast-IP interfacing functionality.
 *
 * Service and Programme Information resolution is naive in that it doesn't attempt to verify a
 * bearer's registration, to make sure that an entry on a service in an SI also exists within
 * RadioDNS. This potentially means an SI author can "hijack" a bearer that don't operate.
 */

const asyncFind = require('async-find');
const debug = require('debug')('vcrd:broadcast');
const { writeFile } = require('fs');
const http = require('http');
const https = require('https');
const { resolve } = require('path');

const radiodns = require('./radiodns/core');
const radiospi = require('./radiodns/spi');

const overrideUrls = require('../override-urls.json');

const audioTypes = [
  'audio/mpeg',
  'audio/aac',
  'audio/aacp',
];
const playlistTypes = [
  'application/mpegurl',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'audio/mpegurl',
  'audio/x-mpegurl',
  'audio/x-scpls',
];
const streamLine = /^(File[0-999]=|)(http(|s):\/\/[^ $]+)/;

const resolvedBroadcastBearers = new Set();
const urlToBroadcastBearerMap = new Map();
const overrideUrlMap = new Map(Object.entries(overrideUrls));

/**
 * Flattens multi-dimensional arrays in to a single dimension of values.
 */
function flatten(arr) {
  return arr.reduce((flat, toFlatten) =>
    flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten), []);
}

/**
 * Requests the URL and analyses the response, iterating down the chain until it finds an audio
 * stream. This ensures we have all theoretical URLs a broadcaster could advertise.
 */
async function expandPossibleUrls(url) {
  debug(`reducing url ${url}`);
  const client = (url.startsWith('http:')) ? http : https;
  return new Promise((resolve, reject) => {
    const request = client.get(url, async (response) => {
      const { statusCode, headers: { 'content-type': contentType, location } } = response;
      const isPlaylistType = playlistTypes.includes(contentType);
      const isAudioType = audioTypes.includes(contentType);
      const isPlaylist = (isPlaylistType || !isAudioType);
      if (isPlaylist) {
        debug('suspected playlist');
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', async () => {
          const lines = data.split('\n');
          const promises = [];
          lines.forEach((line) => {
            const trimmedLine = line.trim();
            const [,, streamUrl] = trimmedLine.match(streamLine) || [];
            if (streamUrl === undefined) {
              return;
            }
            const promise = expandPossibleUrls(streamUrl);
            promises.push(promise);
          });
          const urls = [url].concat(flatten(await Promise.all(promises)));
          resolve(urls);
        });
      } else {
        request.abort();
        const isRedirect = (statusCode >= 300 && statusCode < 400 && location);
        const isOK = (statusCode === 200);
        if (isRedirect) {
          debug(`redirected to ${location}`);
          resolve(expandPossibleUrls(url));
        } else if (!isOK || !isAudioType) {
          debug('unrecognised format');
          const error = new Error('bad stuff');
          reject(error);
        } else {
          debug('suspected stream');
          resolve([url]);
        }
      }
    });
  });
}

function logExpandedUrls(expandedUrls) {
  const path = resolve(__dirname, '../expanded-url-dump.log');
  writeFile(path, expandedUrls.join('\n'), 'utf-8', () => {});
}

/**
 * Takes a URL and attempts to find broadcast bearers that match.
 */
async function getBroadcastBearers(url) {
  debug(`request to lookup broadcast bearers for url ${url}`);
  const expandedUrls = await expandPossibleUrls(url);
  logExpandedUrls(expandedUrls);
  const possibleUrls = expandedUrls.map((expandedUrl) => {
    const match = overrideUrlMap.get(expandedUrl);
    return (match !== undefined) ? match : expandedUrl;
  });
  let bearers;
  possibleUrls.some((possibleUrl) => {
    bearers = urlToBroadcastBearerMap.get(possibleUrl);
    debug(`looking up ${possibleUrl} = ${bearers !== undefined ? bearers.length : 0} bearers`);
    return (bearers !== undefined);
  });
  return bearers || [];
}

/**
 * Adds a new broadcast bearer to the internal cache.
 */
async function cacheIPBearersForBroadcastBearer(bearer) {
  const isBearerAlreadyResolved = resolvedBroadcastBearers.has(bearer);
  if (isBearerAlreadyResolved) {
    debug(`bearer ${bearer} already resolved`);
    return;
  }
  debug(`caching IP bearers for ${bearer}`);
  let spiHosts = [];
  try {
    let authorativeFqdn;
    try {
      const lookupFqdn = radiodns.bearerStringToFQDN(bearer);
      authorativeFqdn = await radiodns.resolveAuthorativeFqdn(lookupFqdn);
    } catch (error) {
      debug(`unable to lookup bearer ${bearer} in primary zone`, error.message);
      const altLookupFqdn = radiodns.bearerStringToFQDN(bearer, 'test.radiodns.org.');
      authorativeFqdn = await radiodns.resolveAuthorativeFqdn(altLookupFqdn);
    }
    spiHosts = await radiodns.resolveApplication('radioepg', authorativeFqdn);
  } catch (error) {
    debug(`unable to lookup bearer ${bearer} in test zone`, error.message);
    return;
  }
  const promises = spiHosts.map(spiHost => () => radiospi.allBearersForBearer(spiHost, bearer));
  try {
    const alternativeBearers = await asyncFind(promises);
    const broadcastBearers = alternativeBearers.filter(currentBearer => !currentBearer.startsWith('http'));
    const ipBearers = alternativeBearers.filter(currentBearer => currentBearer.startsWith('http'));
    broadcastBearers.forEach(currentBearer => resolvedBroadcastBearers.add(currentBearer));
    ipBearers.forEach(ipBearer => urlToBroadcastBearerMap.set(ipBearer, broadcastBearers));
    resolvedBroadcastBearers.add(bearer);
  } catch (error) {
    debug(`unable to find bearer ${bearer} in SI`, error.message);
  }
}

/**
 * Clears all existing broadcast bearers in the cache.
 */
function clearCache() {
  resolvedBroadcastBearers.clear();
  urlToBroadcastBearerMap.clear();
}

module.exports.getBroadcastBearers = getBroadcastBearers;
module.exports.cacheIPBearersForBroadcastBearer = cacheIPBearersForBroadcastBearer;
module.exports.clearCache = clearCache;
