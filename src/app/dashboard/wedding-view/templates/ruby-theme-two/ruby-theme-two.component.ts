import { Component } from '@angular/core';
import { GalleryItem, WeddingEvent } from '../../../../services/wedding-data.service';
import { RubyThemeOneComponent } from '../ruby-theme-one/ruby-theme-one.component';

@Component({
  selector: 'wc-ruby-theme-two',
  templateUrl: './ruby-theme-two.component.html',
  styleUrls: ['./ruby-theme-two.component.scss'],
})
export class RubyThemeTwoComponent extends RubyThemeOneComponent {
  override getPrimaryDisplayName(): string {
    return this.getGroomNickname() || 'Sena';
  }

  override getSecondaryDisplayName(): string {
    return this.getBrideNickname() || 'Arya';
  }

  override getGuestName(): string {
    return 'Tamu Undangan';
  }

  override getMapPreviewLabel(): string {
    return this.getMapsLink() ? 'Peta lokasi acara' : 'Peta lokasi akan segera diperbarui';
  }

  override getCountdownHeading(): string {
    return 'MENUJU HARI BAHAGIA';
  }

  getGalleryPhotos(): GalleryItem[] {
    return this.getSafeGalleryPhotos();
  }

  getLoveStoryItems(): Array<{ title: string; date: string; description: string }> {
    const stories = this.getStories();
    if (stories.length) {
      return stories.slice(0, 4).map((story, index) => ({
        title: story.title || this.getFallbackStoryTitle(index),
        date: this.getStoryDate(story),
        description: this.getStoryLead(story) || this.getFallbackStoryDescription(index),
      }));
    }

    return [
      {
        title: 'Pertemuan Pertama',
        date: '2019',
        description: 'Pertemuan di sebuah acara sederhana menjadi awal kisah yang penuh kehangatan.',
      },
      {
        title: 'Menjalin Hubungan',
        date: '2020',
        description: 'Kami saling mengenal lebih dekat dan tumbuh menjadi tempat pulang satu sama lain.',
      },
      {
        title: 'Lamaran',
        date: '2025',
        description: 'Dengan restu keluarga, kami mantap melangkah menuju ikatan yang lebih sakral.',
      },
      {
        title: 'Hari Bahagia',
        date: '2026',
        description: 'Kini kami mengundang Anda untuk menjadi bagian dari hari istimewa kami.',
      }
    ];
  }

  getAkadMapLink(): string | null {
    return this.getAkadCard().link_maps || this.getMapsLink();
  }

  getReceptionMapLink(): string | null {
    return this.getReceptionCard().link_maps || this.getMapsLink();
  }

  getStoryTrackBy(index: number, item: { title: string; date: string; description: string }): string {
    return `${index}-${item.title}`;
  }

  getHeroDateLabel(): string {
    const primaryEvent = this.getPrimaryEvent();
    return primaryEvent ? this.formatDate(primaryEvent.tanggal_acara, 'long') : 'Tanggal menyusul';
  }

  getDetailEventVenue(event: WeddingEvent): string {
    return event.nama_acara || 'Lokasi menyusul';
  }

  private getFallbackStoryTitle(index: number): string {
    return ['Pertemuan Pertama', 'Menjalin Hubungan', 'Lamaran', 'Hari Bahagia'][index] || 'Cerita Kami';
  }

  private getFallbackStoryDescription(index: number): string {
    return [
      'Kami dipertemukan dalam sebuah momen yang sederhana, lalu saling menemukan alasan untuk bertahan.',
      'Perjalanan kami dipenuhi percakapan hangat, tawa, dan dukungan yang membuat cinta tumbuh semakin kuat.',
      'Dengan restu keluarga besar, kami memutuskan untuk melangkah ke tahap yang lebih serius.',
      'Hari ini menjadi awal baru bagi kami untuk membangun kisah rumah tangga bersama.'
    ][index] || 'Cerita cinta kami akan terus bertumbuh.';
  }
}
