import { Component } from '@angular/core';
import { DashboardService } from '../../../../dashboard.service';
import { GalleryItem, WeddingEvent } from '../../../../services/wedding-data.service';
import { DiamondThemeOneComponent } from '../diamond-theme-one/diamond-theme-one.component';

interface DiamondGardenGalleryItem {
  photo: string;
  alt: string;
}

@Component({
  selector: 'wc-diamond-theme-two',
  templateUrl: './diamond-theme-two.component.html',
  styleUrls: ['./diamond-theme-two.component.scss'],
})
export class DiamondThemeTwoComponent extends DiamondThemeOneComponent {
  constructor(svc: DashboardService) {
    super(svc);
  }

  override getPrimaryDisplayName(): string {
    return this.getBrideNickname() || 'Sena';
  }

  override getSecondaryDisplayName(): string {
    return this.getGroomNickname() || 'Arya';
  }

  override getBrideFullName(): string {
    return this.getBrideName() || 'Sena Marsina';
  }

  override getGroomFullName(): string {
    return this.getGroomName() || 'Arya Guru Wibawa';
  }

  getHeroLabel(): string {
    return 'Wedding Invitation';
  }

  getOpeningQuote(): string {
    return this.getInvitationIntro();
  }

  getMomentGalleryItems(): DiamondGardenGalleryItem[] {
    const items = this.getSafeGalleryPhotos()
      .slice(0, 4)
      .map((item, index) => ({
        photo: item.photo,
        alt: this.getGalleryAlt(item, index),
      }))
      .filter((item) => !!item.photo);

    if (items.length) {
      return items;
    }

    return [
      { photo: this.getCoverPhoto(), alt: `${this.getPrimaryDisplayName()} & ${this.getSecondaryDisplayName()}` },
      { photo: this.getBridePortrait(), alt: this.getBrideFullName() },
      { photo: this.getGroomPortrait(), alt: this.getGroomFullName() },
      { photo: this.getCoverPhoto(), alt: 'Momen bahagia mempelai' },
    ];
  }

  getEventDay(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date ? String(date.getDate()).padStart(2, '0') : '--';
  }

  getEventMonthName(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date
      ? date.toLocaleDateString('id-ID', { month: 'long' })
      : 'Bulan';
  }

  getEventYear(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date ? String(date.getFullYear()) : '----';
  }

  getWishBadgeClass(kehadiran: string): string {
    switch (kehadiran) {
      case 'hadir':
        return 'diamond-garden-wish__badge--hadir';
      case 'mungkin':
        return 'diamond-garden-wish__badge--mungkin';
      default:
        return 'diamond-garden-wish__badge--tidak';
    }
  }

  override getGiftAddress(bank?: any): string {
    return bank?.nama_pemilik ? `a/n ${bank.nama_pemilik}` : 'Atas nama mempelai';
  }

  getMapPreviewCaption(event: WeddingEvent): string {
    return this.getEventAddress(event);
  }

  private toValidDate(dateValue?: string | null): Date | null {
    if (!dateValue) {
      return null;
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
