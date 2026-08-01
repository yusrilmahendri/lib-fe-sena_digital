const SHARE_BASE_URL =
  process.env.OG_SHARE_BASE_URL ||
  'https://cloud-api.sena-digital.com/api/v1/public/wedding';

const SOCIAL_CRAWLER =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|TelegramBot|SkypeUriPreview|Googlebot|bingbot|DuckDuckBot/i;

const DOMAIN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_CACHE_CONTROL = 'public, s-maxage=900, stale-while-revalidate=3600';

module.exports = async function handler(req, res) {
  const domain = getDomain(req);
  const userAgent = getHeader(req, 'user-agent');

  if (!DOMAIN_PATTERN.test(domain)) {
    console.info('[OG Wedding] rejected invalid domain', {
      domain,
      userAgent,
      rewriteDestination: `/api/og/wedding/${domain}`,
    });
    sendText(res, 404, 'Not Found');
    return;
  }

  const backendUrl = buildShareUrl(domain);

  console.info('[OG Wedding] proxy request', {
    userAgent,
    rewriteDestination: `/api/og/wedding/${domain}`,
    backendUrl,
  });

  try {
    const response = await fetch(backendUrl, {
      headers: buildBackendHeaders(req),
      redirect: 'follow',
    });

    const html = await response.text();

    console.info('[OG Wedding] backend response', {
      userAgent,
      rewriteDestination: `/api/og/wedding/${domain}`,
      backendUrl: response.url || backendUrl,
      backendStatus: response.status,
    });

    res.statusCode = response.status;
    res.setHeader(
      'Content-Type',
      normalizeContentType(response.headers.get('content-type'))
    );
    res.setHeader(
      'Cache-Control',
      response.headers.get('cache-control') || DEFAULT_CACHE_CONTROL
    );
    res.end(html);
  } catch (error) {
    console.error('[OG Wedding] failed to fetch share HTML', {
      domain,
      userAgent,
      rewriteDestination: `/api/og/wedding/${domain}`,
      backendUrl,
      message: error && error.message,
    });
    sendText(res, 502, 'Bad Gateway');
  }
};

module.exports.SOCIAL_CRAWLER = SOCIAL_CRAWLER;
module.exports.buildBackendHeaders = buildBackendHeaders;
module.exports.buildShareUrl = buildShareUrl;

function getDomain(req) {
  const raw = Array.isArray(req.query && req.query.domain)
    ? req.query.domain[0]
    : req.query && req.query.domain;

  try {
    return decodeURIComponent(String(raw || '').trim()).replace(/^\/+|\/+$/g, '');
  } catch (error) {
    return '';
  }
}

function buildShareUrl(domain) {
  return `${SHARE_BASE_URL.replace(/\/$/, '')}/${encodeURIComponent(domain)}/share`;
}

function buildBackendHeaders(req) {
  const userAgent = getHeader(req, 'user-agent');
  const headers = {
    Accept: 'text/html',
  };

  if (typeof userAgent === 'string' && SOCIAL_CRAWLER.test(userAgent)) {
    headers['User-Agent'] = userAgent;
  }

  return headers;
}

function getHeader(req, name) {
  const headers = (req && req.headers) || {};
  const value = headers[name] || headers[name.toLowerCase()];

  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

function normalizeContentType(contentType) {
  const value = String(contentType || '').trim();
  if (value && /charset=/i.test(value)) {
    return value;
  }

  return 'text/html; charset=UTF-8';
}

function sendText(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.end(body);
}
