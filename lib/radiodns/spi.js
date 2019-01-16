/**
 * This module encapsulates support for RadioDNS' SPI standards for obtaining metadata for broadcast
 * radio services.
 */

const http = require('http');
const XmlStream = require('xml-stream');

function getBearer({
  $: {
    id: uri,
    mimeValue,
    bitrate,
    cost,
    offset,
  },
}) {
  const bearer = { uri };
  if (mimeValue) {
    bearer.mimeValue = mimeValue;
  }
  if (bitrate) {
    bearer.bitrate = parseInt(bitrate, 10);
  }
  if (cost) {
    bearer.cost = parseInt(cost, 10);
  }
  if (offset) {
    bearer.offset = parseInt(offset, 10);
  }
  return bearer;
}

function byCost({ cost: aCost }, { cost: bCost }) {
  return aCost - bCost;
}

async function allBearersForBearer({ name: host, port }, targetBearer) {
  return new Promise((resolve, reject) => {
    let timeout;
    const request = http
      .get(`http://${host}:${port}/radiodns/spi/3.1/SI.xml`, (response) => {
        response.setEncoding('utf8');
        const xml = new XmlStream(response);
        xml.collect('bearer');
        let didResolve = false;
        xml.on('endElement: service', (element) => {
          const bearers = element.bearer.map(getBearer);
          const isMatchingBearer = bearers.some(bearer => bearer.uri === targetBearer);
          if (!isMatchingBearer) {
            return;
          }
          clearTimeout(timeout);
          didResolve = true;
          resolve(bearers.sort(byCost).map(bearer => bearer.uri));
        });
        xml.on('end', () => {
          clearTimeout(timeout);
          if (!didResolve) {
            const error = new Error('No matching bearers');
            reject(error);
          }
        });
      })
      .on('error', reject);
    timeout = setTimeout(() => {
      const error = new Error('Took too long to get bearer details');
      request.abort();
      reject(error);
    }, 5000);
  });
}

module.exports.allBearersForBearer = allBearersForBearer;
