import { Component, OnInit, OnDestroy } from '@angular/core';
import { DashboardService, TestimonialService, TestimonialData } from '../../../dashboard.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface StatItem {
  value: string;
  label: string;
}

interface ReviewItem {
  couple: string;
  date: string;
  text: string;
}

@Component({
  selector: 'wc-testemonial-footer',
  templateUrl: './testemonial-footer.component.html',
  styleUrls: ['./testemonial-footer.component.scss']
})
export class TestemonialFooterComponent implements OnInit, OnDestroy {
  /* Landing visual (FE-LP1C-2): static stats + reviews to match Figma. */
  stats: StatItem[] = [
    { value: '1.000+', label: 'Undangan Dibuat' },
    { value: '100+', label: 'Tema Elegan' },
    { value: '95%', label: 'Pengguna Puas' },
    { value: '4.9', label: 'Rating Rata-rata' },
  ];

  /* Static fallback reviews (match Figma). Used when API is empty/errors. */
  private fallbackReviews: ReviewItem[] = [
    {
      couple: 'Dinda & Reza',
      date: 'Maret 2026',
      text: 'Undangannya cantik, mudah diedit, dan sangat membantu untuk membagikan informasi acara ke keluarga.',
    },
    {
      couple: 'Ayu & Bagas',
      date: 'Februari 2026',
      text: 'Tampilannya elegan dan tamu bisa langsung RSVP. Sangat praktis — tim Sena Digital juga responsif.',
    },
    {
      couple: 'Nadira & Rafi',
      date: 'Januari 2026',
      text: 'Worth banget! Bisa custom musik, galeri, sampai cerita perjalanan kami. Tamu suka semua detailnya.',
    },
  ];

  reviews: ReviewItem[] = [...this.fallbackReviews];

  /* Existing public-testimonial API state (kept intact, not removed). */
  testimonials: TestimonialData[] = [];
  isLoading = true;
  hasError = false;
  currentPage = 1;
  itemsPerPage = 6;
  totalItems = 0;

  private destroy$ = new Subject<void>();
  private testimonialService: TestimonialService;

  constructor(private dashboardService: DashboardService) {
    this.testimonialService = new TestimonialService(this.dashboardService);
  }

  ngOnInit(): void {
    this.loadTestimonials();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load public testimonials from API (existing logic preserved).
   */
  loadTestimonials(): void {
    this.isLoading = true;
    this.hasError = false;

    this.testimonialService.getPublicTestimonials({
      limit: this.itemsPerPage,
      page: this.currentPage
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: any) => {
        const list: any[] = this.extractTestimoniList(response);
        if (list.length) {
          this.testimonials = list;
          this.totalItems = response?.meta?.total || list.length;
          const mapped = this.mapReviews(list);
          if (mapped.length) {
            this.reviews = mapped;
          }
        } else {
          // Empty payload -> keep static fallback reviews.
          this.testimonials = [];
          this.hasError = true;
        }
        this.isLoading = false;
      },
      error: () => {
        // Silent fallback: static reviews remain shown.
        console.warn('[Testimoni] public testimonials API unavailable, using static fallback.');
        this.testimonials = [];
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }

  /** Read the testimonial array from the various shapes the API might return. */
  private extractTestimoniList(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    return [];
  }

  /** Map up to 3 API testimonials into review cards with flexible fields. */
  private mapReviews(list: any[]): ReviewItem[] {
    return list
      .slice(0, 3)
      .map((item, i) => {
        const fallback = this.fallbackReviews[i] || this.fallbackReviews[0];
        const couple =
          item?.name || item?.nama || item?.nama_pasangan || item?.user?.name || fallback.couple;
        const text =
          item?.message || item?.testimoni || item?.isi || item?.content || item?.ulasan || fallback.text;
        const rawDate = item?.date || item?.tanggal || item?.created_at || '';
        const date = rawDate ? this.formatDate(rawDate) : fallback.date;
        return { couple, text, date } as ReviewItem;
      })
      .filter((r) => !!r.text);
  }

  /** Format an ISO/date string into Indonesian "Bulan Tahun" (best effort). */
  private formatDate(value: string): string {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  /**
   * Get initials for the avatar fallback circle.
   */
  getInitials(name: string): string {
    return name
      .split('&')
      .map((part) => part.trim().charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  trackByCouple(index: number, review: ReviewItem): string {
    return review.couple;
  }
}
