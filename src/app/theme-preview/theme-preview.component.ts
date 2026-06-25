import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'wc-theme-preview',
  template: `
    <section class="theme-preview-shell">
      <div class="theme-preview-card">
        <span class="theme-preview-badge">Theme Preview</span>
        <h1>{{ displayName }}</h1>
        <p>
          Halaman preview untuk slug <strong>{{ slug }}</strong> berhasil dimuat.
        </p>
        <div class="theme-preview-note">
          Preview minimal aktif untuk memastikan route <code>/themes/:slug</code> tidak blank.
        </div>
      </div>
    </section>
  `,
  styles: [`
    .theme-preview-shell {
      align-items: center;
      background: linear-gradient(180deg, #fff9fc 0%, #fff 100%);
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }

    .theme-preview-card {
      background: #fff;
      border: 1px solid #f1dce8;
      border-radius: 18px;
      box-shadow: 0 16px 40px rgba(88, 30, 58, 0.08);
      max-width: 560px;
      padding: 28px;
      text-align: center;
      width: 100%;
    }

    .theme-preview-badge {
      background: #8b124c;
      border-radius: 999px;
      color: #fff;
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      margin-bottom: 12px;
      padding: 6px 12px;
      text-transform: uppercase;
    }

    .theme-preview-card h1 {
      color: #2b2431;
      font-size: 2rem;
      margin: 0 0 12px;
    }

    .theme-preview-card p {
      color: #6e6370;
      margin: 0;
    }

    .theme-preview-note {
      background: #fff3f8;
      border: 1px solid #f4d2e2;
      border-radius: 12px;
      color: #7e2550;
      font-size: 0.95rem;
      margin-top: 16px;
      padding: 12px;
    }
  `]
})
export class ThemePreviewComponent implements OnInit, OnDestroy {
  slug = 'soft-ivory';
  displayName = 'Soft Ivory';
  private subscriptions = new Subscription();

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      const rawSlug = params.get('slug') || 'soft-ivory';
      this.slug = this.normalizeSlug(rawSlug);
      this.displayName = this.slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private normalizeSlug(value: string): string {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || 'soft-ivory';
  }
}
