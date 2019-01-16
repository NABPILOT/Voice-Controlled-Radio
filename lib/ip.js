const http = require('http');

const defaultTestUrl = 'http://www.apple.com/library/test/success.html';
const defaultExpectedResponse = '<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>';

function testIP({ url = defaultTestUrl, expectedResponse = defaultExpectedResponse } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.setEncoding('utf8');
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (body === expectedResponse) {
          resolve();
        } else {
          const error = new Error(`Body '${body}' does not match expected body '${expectedResponse}'`);
          reject(error);
        }
      });
    });
    request.on('error', () => {
      const error = new Error(`Error making request to ${url}`);
      reject(error);
    });
  });
}

module.exports.testIP = testIP;
