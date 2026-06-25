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
          nama_lengkap: 'Ketut',
          nama_panggilan: 'Ketut',
          photo: 'assets/landing/template-2.png',
          ayah: 'Bapak Ketut',
          ibu: 'Ibu Ketut',
          created_at: '',
          updated_at: '',
        },
        wanita: {
          id: 2,
          user_id: 0,
          nama_lengkap: 'Isabela',
          nama_panggilan: 'Isabela',
          photo: 'assets/landing/template-1.png',
          ayah: 'Bapak Isabela',
          ibu: 'Ibu Isabela',
          created_at: '',
          updated_at: '',
        },
        urutan_mempelai: 'pria',
        cover_photo: 'assets/landing/template-2.png',
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
      stories: [],
      quotes: [],
      gallery: [],
      bank_accounts: [],
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
      guest_wishes: [],
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
