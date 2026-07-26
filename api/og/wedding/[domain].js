const API_BASE_URL = process.env.OG_API_BASE_URL || 'https://cloud-api.sena-digital.com/api';
const FRONTEND_ORIGIN = process.env.OG_FRONTEND_ORIGIN || 'https://www.sena-digital.com';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');
const DEFAULT_IMAGE = `${FRONTEND_ORIGIN}/assets/logos.png`;
const DESCRIPTION = 'Kami mengundang Bapak/Ibu/Saudara/i untuk hadir di acara pernikahan kami.';

module.exports = async function handler(req, res) {
  const domain = getDomain(req);
  const publicUrl = buildPublicWeddingUrl(domain, req.query || {});
  let weddingData = null;

  try {
    weddingData = await fetchWeddingData(domain);
  } catch (error) {
    console.error('[OG Wedding] failed to fetch wedding data', error);
  }

  const title = buildTitle(weddingData);
  const image = resolveCoverImage(weddingData);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(renderHtml({
    title,
    description: DESCRIPTION,
    url: publicUrl,
    image,
    imageType: resolveImageType(image),
  }));
};

function getDomain(req) {
  const raw = Array.isArray(req.query?.domain) ? req.query.domain[0] : req.query?.domain;
  return String(raw || '').trim().replace(/^\/+|\/+$/g, '');
}

function buildPublicWeddingUrl(domain, query) {
  const url = new URL(`/wedding/${encodeURIComponent(domain)}`, FRONTEND_ORIGIN);
  ['guest', 'guest_token', 'to'].forEach((key) => {
    const value = Array.isArray(query?.[key]) ? query[key][0] : query?.[key];
    if (value) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function fetchWeddingData(domain) {
  if (!domain) return null;

  const endpoints = [
    `${API_BASE_URL.replace(/\/$/, '')}/v1/wedding/${encodeURIComponent(domain)}`,
    `${API_BASE_URL.replace(/\/$/, '')}/v1/wedding-profile/public/${encodeURIComponent(domain)}`,
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        'user-agent': 'SenaDigitalOpenGraph/1.0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      continue;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      continue;
    }

    const payload = await response.json();
    const data = unwrapWeddingData(payload);
    if (data) {
      return data;
    }
  }

  return null;
}

function unwrapWeddingData(payload) {
  const candidates = [
    payload?.data?.wedding,
    payload?.data?.invitation,
    payload?.data?.undangan,
    payload?.data,
    payload?.wedding,
    payload?.invitation,
    payload?.undangan,
    payload,
  ];

  return candidates.find((candidate) => {
    return candidate && typeof candidate === 'object' && (
      candidate.mempelai ||
      candidate.gallery ||
      candidate.photos ||
      candidate.cover_photo ||
      candidate.cover_photo_url ||
      candidate.domain ||
      candidate.settings
    );
  }) || null;
}

function buildTitle(data) {
  const groom = firstText(data, [
    'mempelai.pria.nama_panggilan',
    'mempelai.pria.nama_lengkap',
    'mempelai.pria.nama',
    'pria.nama_panggilan',
    'pria.nama_lengkap',
    'groom.name',
    'male_name',
    'nama_pria',
  ]);
  const bride = firstText(data, [
    'mempelai.wanita.nama_panggilan',
    'mempelai.wanita.nama_lengkap',
    'mempelai.wanita.nama',
    'wanita.nama_panggilan',
    'wanita.nama_lengkap',
    'bride.name',
    'female_name',
    'nama_wanita',
  ]);

  return groom && bride
    ? `Undangan Pernikahan ${groom} & ${bride}`
    : 'Undangan Pernikahan';
}

function resolveCoverImage(data) {
  const direct = firstText(data, [
    'cover_photo_url',
    'mempelai.cover_photo_url',
    'mempelai.cover_photo',
    'cover_photo',
  ]);

  if (isPublicImageUrl(direct)) {
    return absolutizeMediaUrl(direct);
  }

  const gallery = getGalleryItems(data);
  const featured = gallery.find((item) => normalizeBoolean(item?.is_featured));
  const typedCover = gallery.find((item) => String(item?.photo_type || '').toLowerCase() === 'cover');
  const firstGallery = gallery.find((item) => !isVideoItem(item));
  const galleryImage = resolveItemImage(featured) || resolveItemImage(typedCover) || resolveItemImage(firstGallery);

  return isPublicImageUrl(galleryImage) ? absolutizeMediaUrl(galleryImage) : DEFAULT_IMAGE;
}

function getGalleryItems(data) {
  const raw = [
    data?.gallery,
    data?.galleries,
    data?.photos,
    data?.foto_gallery,
    data?.gallery_photos,
    data?.media,
    data?.data?.gallery,
    data?.data?.photos,
  ].find(Array.isArray);

  return raw || [];
}

function resolveItemImage(item) {
  if (!item) return '';
  return firstText(item, [
    'cover_photo_url',
    'photo_url',
    'image_url',
    'preview_url',
    'thumbnail_url',
    'photo',
    'image',
    'url',
  ]);
}

function isVideoItem(item) {
  return !!(
    item?.url_video ||
    item?.video_url ||
    item?.link_video ||
    String(item?.media_type || '').toLowerCase() === 'video'
  );
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function firstText(source, paths) {
  for (const path of paths) {
    const value = readPath(source, path);
    const text = String(value || '').trim();
    if (text) return text;
  }

  return '';
}

function readPath(source, path) {
  return String(path || '')
    .split('.')
    .reduce((value, key) => {
      if (Array.isArray(value)) {
        return value[Number(key)] || value[0]?.[key];
      }
      return value && typeof value === 'object' ? value[key] : undefined;
    }, source);
}

function isPublicImageUrl(url) {
  const value = String(url || '').trim();
  return !!value &&
    !value.startsWith('blob:') &&
    !value.startsWith('data:') &&
    !/localhost|127\.0\.0\.1/i.test(value);
}

function absolutizeMediaUrl(url) {
  const value = String(url || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('assets/')) return `${FRONTEND_ORIGIN}/${value}`;

  const cleanPath = value.replace(/^\/+/, '');
  if (cleanPath.startsWith('storage/')) {
    return `${API_ORIGIN}/${cleanPath}`;
  }

  return `${API_ORIGIN}/storage/${cleanPath}`;
}

function resolveImageType(image) {
  const path = new URL(image).pathname.toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function renderHtml({ title, description, url, image, imageType }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(url);
  const safeImage = escapeHtml(image);
  const safeImageType = escapeHtml(imageType);

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:type" content="${safeImageType}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  <link rel="canonical" href="${safeUrl}">
  <meta http-equiv="refresh" content="0;url=${safeUrl}">
</head>
<body>
  <a href="${safeUrl}">Buka Undangan</a>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
