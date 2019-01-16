/**
 * This module provides support for the RadioDNS hybrid radio standard core, from broadcast service
 * lookup through to application discovery.
 */

const dns = require('dns');
const { promisify } = require('util');

const bearerPattern = /(fm:[a-f0-9]{3}\.[a-f0-9]{4}\.[0-9]{5}|dab:[a-f0-9]{3}\.[a-f0-9]{4}\.[a-f0-9]{4}\.[0-9]{1})/;
const defaultRdnsSuffix = 'radiodns.org.';
const uriSeperators = /:|\./;

const resolveCname = promisify(dns.resolveCname);
const resolveSrv = promisify(dns.resolveSrv);

function bearerStringToFQDN(bearerString, suffix = defaultRdnsSuffix) {
  const isValidBearer = bearerPattern.test(bearerString);
  if (!isValidBearer) {
    const error = new Error('Invalid bearer format');
    throw error;
  }
  const components = [suffix].concat(bearerString.split(uriSeperators));
  const fqdn = components.reverse().join('.');
  return fqdn;
}

async function resolveAuthorativeFqdn(name) {
  return resolveCname(name);
}

async function resolveApplication(application, authorativeFqdn) {
  const name = `_${application}._tcp.${authorativeFqdn}.`;
  const answers = await resolveSrv(name);
  return answers
    .sort((a, b) => ((a.priority === b.priority) ? b.weight - a.weight : a.priority - b.priority));
}

module.exports.bearerStringToFQDN = bearerStringToFQDN;
module.exports.resolveAuthorativeFqdn = resolveAuthorativeFqdn;
module.exports.resolveApplication = resolveApplication;
