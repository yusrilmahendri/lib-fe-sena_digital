import { Component, OnInit } from '@angular/core';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';

interface PaketUndangan {
  id: number;
  jenis_paket?: string;
  name_paket: string;
  name_paket_display?: string;
  package_tier?: string;
  price: string | number;
  masa_aktif?: number;
  halaman_buku?: number | string;
  kirim_wa?: number | string;
  bebas_pilih_tema?: number | string;
  kirim_hadiah?: number | string;
  import_data?: number | string;
  created_at?: string;
  updated_at?: string;
}

type Tier = 'ruby' | 'sapphire' | 'diamond';

interface PriceParts {
  prefix: string; // e.g. "Rp"
  amount: string; // e.g. "10"
  suffix: string; // e.g. "rb"
}

interface PricingCard {
  tier: Tier;
  name: string;
  subtitle: string;
  badge?: string;
  featured: boolean;
  priceLabel: string;
  features: string[];
}

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'wc-testimonials',
  templateUrl: './testimonials.component.html',
  styleUrls: ['./testimonials.component.scss'],
})
export class TestimonialsComponent implements OnInit {
  paketList: PaketUndangan[] = [];
  pricingCards: PricingCard[] = [];

  isLoading = true;
  hasError = false;

  /* Fallback used when the API fails or returns no usable data. */
  private fallbackCards: PricingCard[] = [
    {
      tier: 'ruby',
      name: 'Ruby',
      subtitle: 'Untuk undangan sederhana',
      featured: false,
      priceLabel: 'Rp 10 rb',
      features: [
        'Edit tanpa batas',
        'Buku tamu',
        'Amplop digital',
        'Galeri foto',
        'Background music',
      ],
    },
    {
      tier: 'sapphire',
      name: 'Sapphire',
      subtitle: 'Paling populer',
      badge: 'Rekomendasi',
      featured: true,
      priceLabel: 'Rp 11 rb',
      features: [
        'Edit tanpa batas',
        'Kirim undangan via WhatsApp',
        'Kirim hadiah',
        'Buku tamu',
        'Amplop digital',
        'Background music',
      ],
    },
    {
      tier: 'diamond',
      name: 'Diamond',
      subtitle: 'Lebih personal & eksklusif',
      featured: false,
      priceLabel: 'Rp 12 rb',
      features: [
        'Bebas pilih tema',
        'Edit tanpa batas',
        'Kirim undangan via WhatsApp',
        'Import data tamu',
        'Halaman buku',
        'Kirim hadiah',
        'Buku tamu',
        'Amplop digital',
        'Galeri foto',
        'Background music',
      ],
    },
  ];

  /* FAQ accordion (static landing content). First item open by default. */
  faqs: FaqItem[] = [
    {
      question: 'Berapa lama undangan saya bisa diakses?',
      answer:
        'Tergantung paket: Basic aktif 3 bulan, Premium 6 bulan, dan Exclusive sampai 12 bulan setelah pembelian. Kamu juga bisa memperpanjang masa aktif kapan saja.',
    },
    {
      question: 'Apakah saya bisa mengganti tema setelah membayar?',
      answer:
        'Bisa. Kamu dapat mengganti tema sesuai paket yang dipilih. Untuk paket tertentu, pilihan tema lebih fleksibel.',
    },
    {
      question: 'Bagaimana cara membagikan undangan ke tamu?',
      answer:
        'Undangan dapat dibagikan melalui link personal ke WhatsApp, media sosial, atau langsung dikirim ke daftar tamu.',
    },
    {
      question: 'Apakah amplop digital aman?',
      answer:
        'Aman. Informasi pembayaran ditampilkan sesuai data yang kamu atur, dan transaksi dapat diarahkan melalui metode pembayaran yang tersedia.',
    },
    {
      question: 'Bagaimana jika saya butuh bantuan teknis?',
      answer:
        'Tim kami siap membantu melalui WhatsApp atau email selama jam operasional.',
    },
    {
      question: 'Apakah ada masa percobaan gratis?',
      answer:
        'Ketersediaan masa percobaan mengikuti ketentuan paket dan promo yang sedang berlaku.',
    },
  ];

  openFaqIndex = 0;

  constructor(private dashboardSvc: DashboardService) {}

  ngOnInit(): void {
    this.getPaketUndangan();
  }

  toggleFaq(index: number): void {
    this.openFaqIndex = this.openFaqIndex === index ? -1 : index;
  }

  getPaketUndangan(): void {
    this.isLoading = true;
    this.hasError = false;

    this.dashboardSvc.list(DashboardServiceType.MNL_MD_PACK_INVITATION).subscribe({
      next: (res) => {
        this.paketList = res?.data ?? [];
        const mapped = this.buildCardsFromApi(this.paketList);
        // Use API-driven cards when all three tiers resolved, else fallback.
        this.pricingCards = mapped.length === 3 ? mapped : this.fallbackCards;
        this.isLoading = false;
      },
      error: () => {
        this.hasError = true;
        this.pricingCards = this.fallbackCards;
        this.isLoading = false;
      },
    });
  }

  /**
   * Map raw API packages into the Ruby / Sapphire / Diamond cards.
   * Returns an ordered array only when all three tiers are present.
   */
  private buildCardsFromApi(list: PaketUndangan[]): PricingCard[] {
    const byTier: Partial<Record<Tier, PaketUndangan>> = {};

    list.forEach((paket) => {
      const tier = this.resolveTier(paket);
      if (tier && !byTier[tier]) {
        byTier[tier] = paket;
      }
    });

    const order: Tier[] = ['ruby', 'sapphire', 'diamond'];
    const cards: PricingCard[] = [];

    for (const tier of order) {
      const paket = byTier[tier];
      if (!paket) {
        return []; // Missing a tier -> let caller use fallback.
      }
      const base = this.fallbackCards.find((c) => c.tier === tier)!;
      const features = this.buildFeatures(paket);
      cards.push({
        ...base,
        name: paket.name_paket_display || base.name,
        priceLabel: this.formatPrice(paket.price, base.priceLabel),
        features: features.length ? features : base.features,
      });
    }

    return cards;
  }

  /** Resolve a package tier from package_tier or name_paket aliases. */
  private resolveTier(paket: PaketUndangan): Tier | null {
    const raw = `${paket.package_tier || paket.name_paket || ''}`.toLowerCase();

    if (raw.includes('trial')) return null; // never show Trial on landing
    if (/ruby|silver|standar/.test(raw)) return 'ruby';
    if (/sapphire|gold/.test(raw)) return 'sapphire';
    if (/diamond|platinum/.test(raw)) return 'diamond';
    return null;
  }

  private isEnabled(value: number | string | undefined): boolean {
    return value === 1 || value === '1';
  }

  /** Build a feature list from API boolean-ish flags (best effort). */
  private buildFeatures(paket: PaketUndangan): string[] {
    const features: string[] = [];
    if (this.isEnabled(paket.bebas_pilih_tema)) features.push('Bebas pilih tema');
    features.push('Edit tanpa batas');
    if (this.isEnabled(paket.kirim_wa)) features.push('Kirim undangan via WhatsApp');
    if (this.isEnabled(paket.import_data)) features.push('Import data tamu');
    if (this.isEnabled(paket.halaman_buku)) features.push('Halaman buku');
    if (this.isEnabled(paket.kirim_hadiah)) features.push('Kirim hadiah');
    features.push('Buku tamu');
    features.push('Amplop digital');
    features.push('Galeri foto');
    features.push('Background music');
    return features;
  }

  /** Format a numeric API price into a short rupiah label (e.g. "Rp 10 rb"). */
  private formatPrice(price: string | number | undefined, fallback: string): string {
    if (price === undefined || price === null || price === '') return fallback;
    const num = typeof price === 'number' ? price : Number(price);
    if (isNaN(num) || num <= 0) return fallback;

    if (num >= 1_000_000) {
      const jt = num / 1_000_000;
      return `Rp ${this.trimDecimal(jt)} jt`;
    }
    if (num >= 1000) {
      const rb = num / 1000;
      return `Rp ${this.trimDecimal(rb)} rb`;
    }
    return `Rp ${num}`;
  }

  private trimDecimal(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace('.', ',');
  }

  /** Split "Rp 10 rb" into { prefix:"Rp", amount:"10", suffix:"rb" } for styling. */
  splitPrice(label: string): PriceParts {
    const match = label.match(/^(\D*)\s*([\d.,]+)\s*(.*)$/);
    if (!match) {
      return { prefix: '', amount: label, suffix: '' };
    }
    return {
      prefix: match[1].trim(),
      amount: match[2].trim(),
      suffix: match[3].trim(),
    };
  }

  onSelectPaket(tier: Tier): void {
    window.location.href = `/buat-undangan?paket=${tier}`;
  }
}
