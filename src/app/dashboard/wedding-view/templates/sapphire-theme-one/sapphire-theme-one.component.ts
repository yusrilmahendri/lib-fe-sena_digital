import { Component } from '@angular/core';
import { DashboardService } from '../../../../dashboard.service';
import { WeddingEvent } from '../../../../services/wedding-data.service';
import { RubyThemeTwoComponent } from '../ruby-theme-two/ruby-theme-two.component';

@Component({
  selector: 'wc-sapphire-theme-one',
  templateUrl: './sapphire-theme-one.component.html',
  styleUrls: ['./sapphire-theme-one.component.scss'],
})
export class SapphireThemeOneComponent extends RubyThemeTwoComponent {
  constructor(svc: DashboardService) {
    super(svc);
  }

  override getPrimaryDisplayName(): string {
    return this.getGroomNickname() || 'Ketut';
  }

  override getSecondaryDisplayName(): string {
    return this.getBrideNickname() || 'Isabela';
  }

  getGroomFullName(): string {
    return this.getGroomName() || 'Ketut Sugiyono';
  }

  getBrideFullName(): string {
    return this.getBrideName() || 'Isabela Amanda';
  }

  getCalendarLink(event: WeddingEvent): string | null {
    if (!event?.tanggal_acara) {
      return null;
    }

    const start = this.toCalendarStamp(event.tanggal_acara, event.start_acara);
    const end = this.toCalendarStamp(event.tanggal_acara, event.end_acara || event.start_acara);
    if (!start) {
      return null;
    }

    const title = encodeURIComponent(event.nama_acara || 'Acara Pernikahan');
    const location = encodeURIComponent(event.alamat || '');
    const dates = end ? `${start}/${end}` : start;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&location=${location}`;
  }

  private toCalendarStamp(date?: string | null, time?: string | null): string | null {
    if (!date) {
      return null;
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const datePart = parsed.toISOString().slice(0, 10).replace(/-/g, '');
    const safeTime = (time || '00:00').slice(0, 5).replace(':', '');
    return `${datePart}T${safeTime}00`;
  }
}
