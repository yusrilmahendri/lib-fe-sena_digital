import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { WeddingData } from '../services/wedding-data.service';
import {
  resolveThemeRenderKey,
  resolveThemeSlug,
  ThemeRenderKey,
  ThemeSlug,
} from '../theme-render.registry';

@Component({
  selector: 'wc-theme-preview',
  templateUrl: './theme-preview.component.html',
  styleUrls: ['./theme-preview.component.scss']
})
export class ThemePreviewComponent implements OnInit, OnDestroy {
  slug: ThemeSlug = 'soft-ivory';
  activeThemeRenderKey: ThemeRenderKey = 'ruby-theme-one';
  previewData: WeddingData = this.buildPreviewData('soft-ivory');
  private subscriptions = new Subscription();

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      const rawSlug = params.get('slug') || 'soft-ivory';
      this.slug = resolveThemeSlug(rawSlug) || 'soft-ivory';
      this.activeThemeRenderKey = resolveThemeRenderKey(this.slug);
      this.previewData = this.buildPreviewData(this.slug);
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private buildPreviewData(slug: ThemeSlug): WeddingData {
    const themedName = this.toTitle(slug);
    const renderKey = resolveThemeRenderKey(slug);
    const isRubyThemeTwo = renderKey === 'ruby-theme-two';
    const groomPreviewName = isRubyThemeTwo ? 'Arya' : 'Ketut';
    const bridePreviewName = isRubyThemeTwo ? 'Sena' : 'Isabela';
    const coverPreviewImage = isRubyThemeTwo ? 'assets/landing/template-3.png' : 'assets/landing/template-2.png';
    const bridePreviewImage = isRubyThemeTwo ? 'assets/landing/template-3.png' : 'assets/landing/template-1.png';
    const groomPreviewImage = isRubyThemeTwo ? 'assets/landing/template-6.png' : 'assets/landing/template-2.png';

    const preview: any = {
      user_info: {
        id: 0,
        name: 'Preview User',
        email: 'preview@example.com',
        whatsapp: '',
        role: '',
        created_at: '',
        updated_at: '',
        package_info: {
          id: 0,
          id_paket: 0,
          token: '',
          invitation_count: 0,
          invitation_quota: 0,
          created_at: '',
          updated_at: '',
          paket_data: null,
        },
      },
      mempelai: {
        pria: {
          id: 1,
          user_id: 0,
          nama_lengkap: groomPreviewName,
          nama_panggilan: groomPreviewName,
          photo: groomPreviewImage,
          ayah: `Bapak ${groomPreviewName}`,
          ibu: `Ibu ${groomPreviewName}`,
          created_at: '',
          updated_at: '',
        },
        wanita: {
          id: 2,
          user_id: 0,
          nama_lengkap: bridePreviewName,
          nama_panggilan: bridePreviewName,
          photo: bridePreviewImage,
          ayah: `Bapak ${bridePreviewName}`,
          ibu: `Ibu ${bridePreviewName}`,
          created_at: '',
          updated_at: '',
        },
        urutan_mempelai: 'pria',
        cover_photo: coverPreviewImage,
      },
      invitation_package: {
        id: 0,
        nama_paket: 'Ruby',
        deskripsi: 'Preview mode',
        harga: 0,
        status: '',
        created_at: '',
        updated_at: '',
      },
      events: [{
        id: 1,
        user_id: 0,
        nama_acara: 'Resepsi',
        tanggal_acara: new Date().toISOString().slice(0, 10),
        start_acara: '10:00',
        end_acara: '13:00',
        alamat: `Preview tema ${themedName}`,
        google_maps: '',
        created_at: '',
        updated_at: '',
      }],
      stories: isRubyThemeTwo ? [
        { id: 1, title: 'Pertemuan Pertama', lead_cerita: 'Pertemuan sederhana yang mengawali cerita kami.', tanggal_cerita: '2019-05-12', created_at: '' },
        { id: 2, title: 'Menjalin Hubungan', lead_cerita: 'Kami belajar tumbuh bersama dan saling mendukung.', tanggal_cerita: '2020-10-20', created_at: '' },
        { id: 3, title: 'Lamaran', lead_cerita: 'Dengan restu keluarga, kami memutuskan melangkah ke tahap berikutnya.', tanggal_cerita: '2025-03-08', created_at: '' },
      ] : [],
      quotes: [],
      gallery: [
        { id: 1, photo: coverPreviewImage, url_video: '', nama_foto: 'Preview 1', status: 1, created_at: '' },
        { id: 2, photo: bridePreviewImage, url_video: '', nama_foto: 'Preview 2', status: 1, created_at: '' },
        { id: 3, photo: groomPreviewImage, url_video: '', nama_foto: 'Preview 3', status: 1, created_at: '' },
      ],
      bank_accounts: [
        { id: 1, kode_bank: 'BCA', nomor_rekening: '1234 5678 90', nama_bank: 'BCA', nama_pemilik: groomPreviewName, methode_pembayaran: 'transfer', photo_rek: null },
        { id: 2, kode_bank: 'BNI', nomor_rekening: '0987 6543 21', nama_bank: 'BNI', nama_pemilik: bridePreviewName, methode_pembayaran: 'transfer', photo_rek: null },
      ],
      settings: {
        id: 0,
        user_id: 0,
        domain: '',
        token: null,
        musik: '',
        salam_pembuka: 'Bismillahirrahmanirrahim',
        salam_atas: 'Preview desain tema.',
        salam_bawah: 'Terima kasih telah berkunjung.',
        created_at: '',
        updated_at: '',
      },
      filter_undangan: {
        halaman_sampul: 1,
        halaman_mempelai: 1,
        halaman_acara: 1,
        halaman_ucapan: 1,
        halaman_galery: 1,
        halaman_cerita: 1,
        halaman_lokasi: 1,
        halaman_send_gift: 1,
        halaman_qoute: 1,
      },
      guest_wishes: [
        { id: 1, nama: 'Rani', kehadiran: 'hadir', pesan: 'Semoga lancar sampai hari bahagia.', created_at: new Date().toISOString() },
        { id: 2, nama: 'Dimas', kehadiran: 'mungkin', pesan: 'Turut berbahagia untuk kalian berdua.', created_at: new Date().toISOString() },
      ],
      guest_book: [],
      testimonials: [],
      themes: [],
      selected_theme: {
        id: 0,
        slug,
        name: themedName,
        category_slug: 'minimalis',
      },
      metadata: {
        profile_created_at: '',
        profile_updated_at: '',
        total_events: 1,
        total_stories: 0,
        total_quotes: 0,
        total_gallery_items: 0,
        total_guest_wishes: 0,
        is_public_view: true,
      },
    };

    return preview as WeddingData;
  }

  private toTitle(value: string): string {
    return String(value || '')
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
