import { Component, OnInit, Input } from '@angular/core';
import { WeddingEvent } from '../../../services/wedding-data.service';

@Component({
  selector: 'wc-akad-view',
  templateUrl: './akad-view.component.html',
  styleUrls: ['./akad-view.component.scss']
})
export class AkadViewComponent implements OnInit {
  @Input() events: WeddingEvent[] | undefined = [];
  @Input() eventType: string = 'akad';

  constructor() { }

  ngOnInit(): void {
    // Component initialization
    console.log('AkadViewComponent initialized with events:', this.events);
  }

  getEventData(): WeddingEvent | null {
    if (!this.events || this.events.length === 0) {
      return null;
    }

    // Find event by type (akad, resepsi) or return first event
    const targetEvent = this.events.find(event =>
      event.nama_acara.toLowerCase().includes(this.eventType.toLowerCase())
    );

    return targetEvent || this.events[0];
  }

  getFormattedDate(): string {
    const event = this.getEventData();
    if (!event) return 'Tanggal akan diumumkan';

    try {
      const date = new Date(event.tanggal_acara);
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return event.tanggal_acara;
    }
  }

  getFormattedTime(): string {
    const event = this.getEventData();
    if (!event) return 'Waktu akan diumumkan';

    return `${event.start_acara} - ${event.end_acara || 'Selesai'}`;
  }

  getLocation(): string {
    const event = this.getEventData();
    const data = event as any;
    return data?.address || event?.alamat || data?.location_name || 'Lokasi akan diumumkan';
  }

  getMapsLink(): string | null {
    const event = this.getEventData();
    const data = event as any;
    const directLink = String(data?.google_maps_url || event?.link_maps || data?.maps_url || data?.map_url || '').trim();
    if (directLink) {
      return directLink;
    }

    const latitude = String(data?.latitude || '').trim();
    const longitude = String(data?.longitude || '').trim();
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
    }

    const address = String(data?.address || event?.alamat || data?.location_name || '').trim();
    return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  }

  openMapsLocation(): void {
    const mapsLink = this.getMapsLink();
    if (mapsLink) {
      window.open(mapsLink, '_blank');
    }
  }

  hasValidEvent(): boolean {
    const event = this.getEventData();
    return !!(event && event.tanggal_acara && event.start_acara && event.alamat);
  }
}
