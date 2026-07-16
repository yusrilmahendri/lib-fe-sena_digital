import { GalleryItem, WeddingEvent, WeddingStory } from '../services/wedding-data.service';
import {
  getYoutubeThumbnailUrl,
  isInvitationVideoMedia,
  normalizeInvitationMediaUrl,
  resolveInvitationPhotoUrl,
  resolveInvitationVideoUrl,
} from './user-photo.model';

export interface ResolvedWeddingStory {
  id: number;
  title: string;
  description: string;
  date: string;
  image: string;
  sortOrder: number;
  [key: string]: any;
}

export interface ResolvedYoutubeVideo {
  id: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  title: string;
  source: any;
}

type WeddingSection =
  | 'cover'
  | 'couple'
  | 'mempelai'
  | 'events'
  | 'acara'
  | 'gallery'
  | 'galery'
  | 'stories'
  | 'cerita'
  | 'wishes'
  | 'ucapan'
  | 'gift'
  | 'rekening'
  | 'location'
  | 'lokasi'
  | 'quote'
  | 'qoute'
  | 'video';

const INVALID_TEXT = new Set(['', '-', 'null', 'undefined']);

export function resolveGuestName(data: any, queryGuestName?: string | null): string {
  const candidates = [
    data?.guest?.name,
    data?.guest?.nama,
    data?.guest?.guest_name,
    data?.guest?.nama_tamu,
    data?.guest_name,
    data?.nama_tamu,
    data?.filter_undangan?.guest_name,
    data?.filter_undangan?.nama_tamu,
    data?.guest_book?.[0]?.nama,
    data?.guest_book?.[0]?.name,
    queryGuestName,
  ];

  return candidates
    .map((value) => normalizeGuestNameValue(value))
    .find((value) => !!value) || 'Tamu Undangan';
}

export function formatGuestNameFromQuery(value: any): string {
  const decoded = safeDecodeURIComponent(String(value || '').replace(/\+/g, ' '));
  return normalizeGuestNameValue(decoded.replace(/-/g, ' '));
}

export function resolveWeddingEvents(data: any): WeddingEvent[] {
  const candidates = [
    data?.events,
    data?.acara,
    data?.event,
    data?.invitation_package?.events,
    data?.invitation_package?.acara,
    data?.data?.events,
    data?.data?.acara,
    data?.data?.event,
  ];
  const rows = candidates.find((item) => Array.isArray(item)) || [];
  return rows.filter((event: any) => !!event && typeof event === 'object');
}

export function resolveEventMapUrl(event: any): string | null {
  const directLink = [
    event?.maps_url,
    event?.map_url,
    event?.google_maps_url,
    event?.google_map_url,
    event?.location_url,
    event?.link_maps,
    event?.maps,
    event?.url_maps,
    event?.google_maps,
    event?.maps_link,
  ].map((value) => String(value || '').trim()).find((value) => !!value);

  if (isValidExternalUrl(directLink)) {
    return directLink || null;
  }

  const latitude = String(event?.latitude || event?.lat || '').trim();
  const longitude = String(event?.longitude || event?.lng || event?.long || '').trim();
  if (latitude && longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  const query = [
    event?.nama_lokasi,
    event?.nama_tempat,
    event?.location_name,
    event?.venue,
    event?.tempat,
    event?.lokasi,
    event?.address,
    event?.alamat,
  ].map((value) => String(value || '').trim()).find((value) => !!value);

  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

export function resolveStories(data: any): ResolvedWeddingStory[] {
  const candidates = [
    data?.stories,
    data?.cerita,
    data?.list_cerita,
    data?.wedding_stories,
    data?.love_stories,
    data?.cerita_cinta,
    data?.invitation_package?.stories,
    data?.invitation_package?.cerita,
    data?.data?.stories,
    data?.data?.cerita,
    data?.data?.list_cerita,
    data?.data?.wedding_stories,
  ];
  const rows: any[] = candidates.find((item) => Array.isArray(item)) || [];

  return rows
    .map((story: any, index: number) => normalizeStory(story, index))
    .filter((story: ResolvedWeddingStory) => !!(story.title || story.description || story.date || story.image))
    .sort((a: ResolvedWeddingStory, b: ResolvedWeddingStory) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      const timeA = new Date(a.date || 0).getTime() || Number.MAX_SAFE_INTEGER;
      const timeB = new Date(b.date || 0).getTime() || Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) return timeA - timeB;
      return Number(a.id || 0) - Number(b.id || 0);
    });
}

export function resolveYoutubeVideos(data: any): ResolvedYoutubeVideo[] {
  const candidates = [
    data?.youtube_url,
    data?.youtube_link,
    data?.video_url,
    data?.video_link,
    data?.link_youtube,
    data?.live_streaming?.youtube_url,
    data?.live_streaming?.link_youtube,
    data?.settings?.youtube_url,
    data?.setting?.youtube_url,
    data?.data?.youtube_url,
    data?.data?.video_url,
    ...resolveRawGalleryRows(data).flatMap((item) => [
      item?.youtube_url,
      item?.youtube_link,
      item?.video_url,
      item?.video_link,
      item?.link_youtube,
      item?.url_video,
      item?.link_video,
      item?.youtube,
      isInvitationVideoMedia(item) ? resolveInvitationVideoUrl(item) : '',
    ]),
  ];

  const seen = new Set<string>();
  return candidates
    .map((url, index) => {
      const embedUrl = normalizeYoutubeEmbedUrl(url);
      if (!embedUrl || seen.has(embedUrl)) return null;
      seen.add(embedUrl);
      const id = extractYoutubeVideoId(embedUrl);
      return {
        id,
        url: String(url || '').trim(),
        embedUrl,
        thumbnailUrl: getYoutubeThumbnailUrl(embedUrl),
        title: `Video ${index + 1}`,
        source: url,
      };
    })
    .filter((video): video is ResolvedYoutubeVideo => !!video);
}

export function resolveGalleryPhotos(data: any): GalleryItem[] {
  const media = resolveRawGalleryRows(data)
    .map((item, index) => normalizeGalleryItem(item, index))
    .filter((item) => !!(resolveInvitationPhotoUrl(item) || resolveInvitationVideoUrl(item)));

  const youtubeItems = resolveYoutubeVideos(data).map((video, index) => ({
    id: Number.MAX_SAFE_INTEGER - index,
    photo_type: 'gallery',
    media_type: 'video',
    nama_foto: video.title,
    description: video.title,
    photo_url: video.thumbnailUrl,
    thumbnail_url: video.thumbnailUrl,
    url_video: video.embedUrl,
    video_url: video.embedUrl,
    youtube_id: video.id,
    sort_order: Number.MAX_SAFE_INTEGER - 100 + index,
    is_featured: media.length === 0 && index === 0,
  } as any));

  const seen = new Set<string>();
  return [...media, ...youtubeItems].filter((item: any) => {
    const key = String(resolveInvitationPhotoUrl(item) || resolveInvitationVideoUrl(item) || item?.id || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isWeddingSectionEnabled(data: any, section: WeddingSection): boolean {
  const filter = data?.filter_undangan || data?.filters || data?.settings?.filter_undangan || data?.data?.filter_undangan || {};
  const aliases: Record<WeddingSection, string[]> = {
    cover: ['cover', 'halaman_sampul', 'sampul'],
    couple: ['couple', 'mempelai', 'halaman_mempelai'],
    mempelai: ['couple', 'mempelai', 'halaman_mempelai'],
    events: ['events', 'acara', 'halaman_acara'],
    acara: ['events', 'acara', 'halaman_acara'],
    gallery: ['gallery', 'galery', 'halaman_galery', 'halaman_gallery'],
    galery: ['gallery', 'galery', 'halaman_galery', 'halaman_gallery'],
    stories: ['stories', 'cerita', 'halaman_cerita'],
    cerita: ['stories', 'cerita', 'halaman_cerita'],
    wishes: ['wishes', 'ucapan', 'halaman_ucapan'],
    ucapan: ['wishes', 'ucapan', 'halaman_ucapan'],
    gift: ['gift', 'rekening', 'send_gift', 'halaman_send_gift'],
    rekening: ['gift', 'rekening', 'send_gift', 'halaman_send_gift'],
    location: ['location', 'lokasi', 'halaman_lokasi'],
    lokasi: ['location', 'lokasi', 'halaman_lokasi'],
    quote: ['quote', 'qoute', 'halaman_qoute', 'halaman_quote'],
    qoute: ['quote', 'qoute', 'halaman_qoute', 'halaman_quote'],
    video: ['video', 'youtube', 'halaman_video', 'live_streaming', 'livestreaming'],
  };

  for (const key of aliases[section] || [section]) {
    if (Object.prototype.hasOwnProperty.call(filter, key)) {
      return !isExplicitlyDisabled(filter[key]);
    }
  }

  return true;
}

export function normalizeYoutubeEmbedUrl(url: any): string {
  const videoId = extractYoutubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
}

function normalizeGuestNameValue(value: any): string {
  const raw = safeDecodeURIComponent(String(value ?? '').replace(/\+/g, ' ')).trim();
  if (INVALID_TEXT.has(raw.toLowerCase())) return '';

  const spaced = raw.replace(/\s+/g, ' ');
  return spaced
    .split(' ')
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
    .join(' ')
    .trim();
}

function normalizeStory(story: any, index: number): ResolvedWeddingStory {
  const date = String(story?.date || story?.tanggal || story?.tanggal_cerita || story?.year || story?.tahun || '').trim();
  return {
    ...story,
    id: Number(story?.id ?? index + 1),
    title: String(story?.title || story?.judul || story?.name || story?.nama_cerita || 'Cerita Kami').trim(),
    description: String(story?.description || story?.deskripsi || story?.lead_cerita || story?.cerita || story?.isi || story?.content || story?.story || '').trim(),
    lead_cerita: String(story?.lead_cerita || story?.description || story?.deskripsi || story?.cerita || '').trim(),
    tanggal_cerita: date,
    date,
    image: normalizeInvitationMediaUrl(story?.image || story?.photo || story?.foto || story?.image_url || story?.photo_url || ''),
    sortOrder: Number(story?.sort_order ?? story?.sortOrder ?? Number.MAX_SAFE_INTEGER),
  };
}

function normalizeGalleryItem(item: any, index: number): GalleryItem {
  const videoUrl = normalizeYoutubeEmbedUrl(
    item?.youtube_url ||
    item?.youtube_link ||
    item?.link_youtube ||
    item?.video_url ||
    item?.url_video ||
    item?.link_video ||
    item?.youtube
  ) || resolveInvitationVideoUrl(item);

  return {
    ...item,
    id: Number(item?.id ?? index + 1),
    photo_type: item?.photo_type || 'gallery',
    media_type: item?.media_type || (videoUrl ? 'video' : item?.type),
    photo_url: resolveInvitationPhotoUrl(item) || getYoutubeThumbnailUrl(videoUrl),
    thumbnail_url: item?.thumbnail_url || getYoutubeThumbnailUrl(videoUrl),
    url_video: videoUrl || item?.url_video,
    video_url: videoUrl || item?.video_url,
    sort_order: Number(item?.sort_order ?? item?.sortOrder ?? index),
    is_featured: item?.is_featured,
  } as any;
}

function resolveRawGalleryRows(data: any): any[] {
  const candidates = [
    data?.gallery,
    data?.galleries,
    data?.photos,
    data?.galery,
    data?.gallery_photos,
    data?.data?.gallery,
    data?.data?.galleries,
    data?.data?.photos,
    data?.invitation_package?.gallery,
  ];
  return candidates.find((item) => Array.isArray(item)) || [];
}

function extractYoutubeVideoId(value: any): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    const segments = url.pathname.split('/').filter(Boolean);
    if (hostname === 'youtu.be') return segments[0] || '';
    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      if (segments[0] === 'watch' || url.pathname === '/watch') return url.searchParams.get('v') || '';
      if (segments[0] === 'embed' || segments[0] === 'shorts') return segments[1] || '';
    }
  } catch {
    return /^[a-zA-Z0-9_-]{8,}$/.test(raw) ? raw : '';
  }

  return '';
}

function isValidExternalUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

function isExplicitlyDisabled(value: any): boolean {
  if (value === false || value === 0) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['0', 'false', 'no', 'off', 'inactive', 'nonaktif', 'disabled'].includes(normalized);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
