import { host } from '../../core/security';
import { httpClient } from '../internet-intelligence/http-client';
let bootstrap: { services: Array<[string[], string[]]>; expires: number } | undefined;
export async function lookupRegistration(input: string) {
  const domain = host(input).toLowerCase().replace(/\.$/, '');
  if (!domain.includes('.')) throw new Error('A registered domain name is required');
  if (!bootstrap || bootstrap.expires < Date.now()) {
    const response = await httpClient.request('https://data.iana.org/rdap/dns.json', { timeoutMs: 8000, retries: 0 });
    const body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (!Array.isArray(body?.services)) throw new Error('Invalid RDAP bootstrap response');
    bootstrap = { services: body.services, expires: Date.now() + 86400000 };
  }
  const tld = domain.split('.').pop()!;
  const endpoints = bootstrap.services.find(service => Array.isArray(service[0]) && service[0].includes(tld))?.[1];
  const endpoint = endpoints?.find(url => typeof url === 'string' && url.startsWith('https://'));
  if (!endpoint) throw new Error('No HTTPS RDAP service is available for this domain');
  const url = new URL('domain/' + encodeURIComponent(domain), endpoint.endsWith('/') ? endpoint : endpoint + '/').href;
  const response = await httpClient.request(url, { timeoutMs: 8000, retries: 0, headers: { Accept: 'application/rdap+json, application/json' } });
  const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  if (!data || data.objectClassName !== 'domain' || typeof data.ldhName !== 'string') throw new Error('Invalid RDAP domain response');
  if (data.ldhName.toLowerCase().replace(/\.$/, '') !== domain) throw new Error('RDAP domain does not match the query');
  return { source: url, queriedAt: Date.now(), data };
}
