import { Component } from '@angular/core';
import { DashboardService } from '../../../../dashboard.service';
import { WeddingEvent } from '../../../../services/wedding-data.service';
import { RubyThemeTwoComponent } from '../ruby-theme-two/ruby-theme-two.component';

@Component({
  selector: 'wc-diamond-theme-one',
  templateUrl: './diamond-theme-one.component.html',
  styleUrls: ['./diamond-theme-one.component.scss'],
})
export class DiamondThemeOneComponent extends RubyThemeTwoComponent {
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
    return this.getGroomName() || 'Ketut';
  }

  getBrideFullName(): string {
    return this.getBrideName() || 'Isabela';
  }

  getGroomPortrait(): string {
    return this.getGroom()?.photo || this.getCoverPhoto();
  }

  getBridePortrait(): string {
    return this.getBride()?.photo || this.getCoverPhoto();
  }

  getInvitingFamilies(): string[] {
    const families = [
      this.getGroomParentLine(),
      this.getBrideParentLine(),
    ].filter((line) => !!line && line.trim().length > 0);

    if (families.length) {
      return families;
    }

    return ['Keluarga Besar Mempelai Pria', 'Keluarga Besar Mempelai Wanita'];
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
