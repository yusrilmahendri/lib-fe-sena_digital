import { WeddingData } from '../../services/wedding-data.service';
import {
  resolveThemeRenderKey,
  ThemeRenderKey,
  ThemeSlug,
} from '../../theme-render.registry';

const DAY_MS = 24 * 60 * 60 * 1000;
const PREVIEW_MUSIC_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPreviewWeddingDate(): string {
  return toIsoDate(new Date(Date.now() + 45 * DAY_MS));
}

function toTitle(value: string): string {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getThemePackageLabel(renderKey: ThemeRenderKey): string {
  if (renderKey === 'diamond-theme-one' || renderKey === 'diamond-theme-two') {
    return 'Diamond';
  }

  if (renderKey === 'sapphire-theme-one') {
    return 'Sapphire';
  }

  return 'Ruby';
}

export function isThemePreviewWeddingData(data: WeddingData | null | undefined): boolean {
  return !!(data as any)?.metadata?.is_preview || !!(data as any)?.is_preview;
}

export function appendPreviewGuestWish(
  data: WeddingData,
  wish: { nama: string; kehadiran: string; pesan: string }
): WeddingData {
  const currentWishes = Array.isArray(data?.guest_wishes) ? data.guest_wishes : [];

  return {
    ...(data as any),
    guest_wishes: [
      {
        id: Date.now(),
        nama: wish.nama,
        kehadiran: wish.kehadiran,
        pesan: wish.pesan,
        created_at: new Date().toISOString(),
      },
      ...currentWishes,
    ],
  } as WeddingData;
}

export function getThemePreviewDummyData(slug: ThemeSlug): WeddingData {
  const renderKey = resolveThemeRenderKey(slug);
  const weddingDate = getPreviewWeddingDate();
  const themedName = toTitle(slug);
  const packageLabel = getThemePackageLabel(renderKey);
  const isRubyThemeTwo = renderKey === 'ruby-theme-two';
  const isDiamondGarden = renderKey === 'diamond-theme-two';
  const groomName = isRubyThemeTwo || isDiamondGarden ? 'Arya Pradipta' : 'Ketut Mahardika';
  const groomNickname = isRubyThemeTwo || isDiamondGarden ? 'Arya' : 'Ketut';
  const brideName = isRubyThemeTwo || isDiamondGarden ? 'Sena Kirana' : 'Isabela Larasati';
  const brideNickname = isRubyThemeTwo || isDiamondGarden ? 'Sena' : 'Isabela';
  const coverPhoto = isDiamondGarden
    ? 'assets/landing/template-5.png'
    : isRubyThemeTwo
      ? 'assets/landing/template-3.png'
      : 'assets/landing/template-2.png';
  const bridePhoto = isDiamondGarden
    ? 'assets/landing/template-6.png'
    : isRubyThemeTwo
      ? 'assets/landing/template-3.png'
      : 'assets/landing/template-1.png';
  const groomPhoto = isDiamondGarden
    ? 'assets/landing/template-2.png'
    : isRubyThemeTwo
      ? 'assets/landing/template-6.png'
      : 'assets/landing/template-2.png';
  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=The%20Langham%20Jakarta';

  return {
    user_info: {
      id: 0,
      name: 'Theme Preview',
      email: 'preview@sena-digital.test',
      phone: '081234567890',
      kode_pemesanan: 'PREVIEW',
    },
    mempelai: {
      id: 0,
      cover_photo: coverPhoto,
      urutan_mempelai: isDiamondGarden ? 'wanita' : 'pria',
      pria: {
        photo: groomPhoto,
        photo_url: groomPhoto,
        image_url: groomPhoto,
        preview_url: groomPhoto,
        nama_lengkap: groomName,
        nama_panggilan: groomNickname,
        ayah: `Bapak ${groomNickname}`,
        ibu: `Ibu ${groomNickname}`,
        instagram: '@arya.preview',
      } as any,
      wanita: {
        photo: bridePhoto,
        photo_url: bridePhoto,
        image_url: bridePhoto,
        preview_url: bridePhoto,
        nama_lengkap: brideName,
        nama_panggilan: brideNickname,
        ayah: `Bapak ${brideNickname}`,
        ibu: `Ibu ${brideNickname}`,
        instagram: '@sena.preview',
      } as any,
      status: 'preview',
      kd_status: 'preview',
    },
    invitation_package: {
      id: 0,
      status: 'preview',
      paket_undangan: {
        id: 0,
        jenis_paket: packageLabel.toLowerCase(),
        name_paket: packageLabel,
        price: '0',
        masa_aktif: 365,
        features: {
          halaman_buku: 1,
          kirim_wa: 1,
          bebas_pilih_tema: 1,
          kirim_hadiah: 1,
          import_data: 1,
        },
      },
      name_paket: packageLabel,
      nama_paket: packageLabel,
      events: [],
      stories: [],
      cover: coverPhoto,
      music_url: PREVIEW_MUSIC_URL,
      video_url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      media_type: 'video',
    } as any,
    events: [
      {
        id: 1,
        nama_acara: 'Akad Nikah',
        tanggal_acara: weddingDate,
        start_acara: '09:00',
        end_acara: '10:30',
        alamat: 'The Langham Jakarta, District 8 SCBD, Jakarta Selatan',
        link_maps: mapsUrl,
        google_maps_url: mapsUrl,
        location_name: 'The Langham Jakarta',
        address: 'District 8 SCBD, Jakarta Selatan',
        countdown: weddingDate,
      },
      {
        id: 2,
        nama_acara: 'Resepsi',
        tanggal_acara: weddingDate,
        start_acara: '11:00',
        end_acara: '14:00',
        alamat: 'The Langham Jakarta, District 8 SCBD, Jakarta Selatan',
        link_maps: mapsUrl,
        google_maps_url: mapsUrl,
        location_name: 'The Langham Jakarta',
        address: 'District 8 SCBD, Jakarta Selatan',
        countdown: weddingDate,
      },
    ],
    stories: [
      {
        id: 1,
        title: 'Pertemuan Pertama',
        lead_cerita: 'Kami bertemu di sebuah acara kecil dan obrolan sederhana itu menjadi awal cerita panjang.',
        tanggal_cerita: '2021-05-12',
        created_at: '2021-05-12T00:00:00.000Z',
        photo: bridePhoto,
      } as any,
      {
        id: 2,
        title: 'Lamaran',
        lead_cerita: 'Dengan restu keluarga, kami memutuskan melangkah bersama menuju hari bahagia.',
        tanggal_cerita: '2025-03-08',
        created_at: '2025-03-08T00:00:00.000Z',
        photo: coverPhoto,
      } as any,
    ],
    quotes: [
      {
        id: 1,
        name: 'QS. Ar-Rum: 21',
        qoute: 'Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup.',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    gallery: [
      {
        id: 1,
        photo: coverPhoto,
        photo_url: coverPhoto,
        image_url: coverPhoto,
        preview_url: coverPhoto,
        photo_type: 'gallery',
        media_type: 'image',
        display_mode: 'cover',
        object_position: 'center center',
        is_featured: true,
        sort_order: 1,
        description: 'Foto cover preview',
        url_video: '',
        nama_foto: 'Cover Preview',
        status: 1,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        photo: bridePhoto,
        photo_url: bridePhoto,
        image_url: bridePhoto,
        preview_url: bridePhoto,
        photo_type: 'collage',
        media_type: 'image',
        display_mode: 'cover',
        object_position: 'center center',
        is_featured: false,
        sort_order: 2,
        description: 'Foto mempelai wanita preview',
        url_video: '',
        nama_foto: 'Bride Preview',
        status: 1,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 3,
        photo: groomPhoto,
        photo_url: groomPhoto,
        image_url: groomPhoto,
        preview_url: groomPhoto,
        photo_type: 'gallery',
        media_type: 'image',
        display_mode: 'cover',
        object_position: 'center center',
        is_featured: false,
        sort_order: 3,
        description: 'Foto mempelai pria preview',
        url_video: '',
        nama_foto: 'Groom Preview',
        status: 1,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 4,
        photo: '',
        photo_url: '',
        video_url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        media_type: 'video',
        photo_type: 'gallery',
        display_mode: 'cover',
        object_position: 'center center',
        is_featured: false,
        sort_order: 4,
        description: 'Video preview tema',
        url_video: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        nama_foto: 'Video Preview',
        status: 1,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    bank_accounts: [
      {
        id: 1,
        kode_bank: 'BCA',
        nomor_rekening: '1234567890',
        nama_bank: 'BCA',
        nama_pemilik: groomName,
        methode_pembayaran: 'transfer',
        photo_rek: null,
      },
      {
        id: 2,
        kode_bank: 'BNI',
        nomor_rekening: '0987654321',
        nama_bank: 'BNI',
        nama_pemilik: brideName,
        methode_pembayaran: 'transfer',
        photo_rek: null,
      },
    ],
    settings: {
      id: 0,
      domain: '',
      musik: PREVIEW_MUSIC_URL,
      salam_pembuka: 'Assalamu alaikum Warahmatullahi Wabarakatuh. Dengan memohon rahmat Tuhan Yang Maha Esa, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
      salam_atas: 'Kepada Yth. Bapak/Ibu/Saudara/i',
      salam_bawah: 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa restu.',
      resolved_music_url: PREVIEW_MUSIC_URL,
      custom_music_url: null,
      selected_music: null,
      default_music: null,
      music_source_type: 'preview',
      can_upload_custom_music: false,
      music_stream_url: PREVIEW_MUSIC_URL,
    },
    filter_undangan: {
      id: 0,
      halaman_sampul: 1,
      halaman_mempelai: 1,
      halaman_acara: 1,
      halaman_ucapan: 1,
      halaman_galery: 1,
      halaman_cerita: 1,
      halaman_lokasi: 1,
      halaman_prokes: 1,
      halaman_send_gift: 1,
      halaman_qoute: 1,
    },
    guest_wishes: [
      {
        id: 1,
        nama: 'Rani',
        kehadiran: 'hadir',
        pesan: 'Semoga lancar sampai hari bahagia dan selalu penuh berkah.',
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        nama: 'Dimas',
        kehadiran: 'mungkin',
        pesan: 'Turut berbahagia untuk kalian berdua.',
        created_at: new Date().toISOString(),
      },
    ],
    guest_book: [
      {
        id: 0,
        nama: 'Tamu Preview',
        name: 'Tamu Preview',
      },
    ],
    testimonials: [],
    themes: [],
    selected_theme: {
      id: 0,
      slug,
      name: themedName,
      category_slug: packageLabel.toLowerCase(),
    },
    metadata: {
      profile_created_at: '',
      profile_updated_at: '',
      total_events: 2,
      total_stories: 2,
      total_quotes: 1,
      total_gallery_items: 4,
      total_guest_wishes: 2,
      is_public_view: false,
      is_preview: true,
    } as any,
    is_preview: true,
    preview_mode: true,
    guest_name: 'Tamu Preview',
    nama_tamu: 'Tamu Preview',
    guest: {
      name: 'Tamu Preview',
      nama: 'Tamu Preview',
    },
    wedding_gift: {
      address: 'Jl. Preview Bahagia No. 12, Jakarta Selatan',
      recipient_name: `${groomNickname} & ${brideNickname}`,
    },
    quote_agama: 'Semoga cinta ini menjadi jalan ibadah, ketenangan, dan kasih sayang.',
    opening: {
      guest_name: 'Tamu Preview',
      greeting: 'Kepada Yth. Bapak/Ibu/Saudara/i',
      button_text: 'Buka Undangan',
      opening_text: 'Dengan penuh syukur, kami mengundang Anda untuk merayakan hari bahagia kami.',
    },
  } as WeddingData;
}
