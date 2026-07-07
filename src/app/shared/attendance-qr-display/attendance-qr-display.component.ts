import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as QRCode from 'qrcode';

@Component({
  selector: 'wc-attendance-qr-display',
  templateUrl: './attendance-qr-display.component.html',
  styleUrls: ['./attendance-qr-display.component.scss'],
})
export class AttendanceQrDisplayComponent implements AfterViewInit, OnChanges {
  @Input() qrData = '';
  @Input() title = 'QR Kehadiran Tamu';
  @Input() description = 'Tunjukkan QR ini kepada panitia saat hadir di acara.';

  @ViewChild('qrCanvas', { static: false }) qrCanvas?: ElementRef<HTMLCanvasElement>;

  isGenerating = false;
  hasError = false;

  ngAfterViewInit(): void {
    window.setTimeout(() => this.renderQr(), 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['qrData'] && !changes['qrData'].firstChange) {
      this.renderQr();
    }
  }

  private async renderQr(): Promise<void> {
    const url = String(this.qrData || '').trim();

    if (!url || !this.qrCanvas?.nativeElement) {
      return;
    }

    this.isGenerating = true;
    this.hasError = false;

    try {
      await QRCode.toCanvas(this.qrCanvas.nativeElement, url, {
        errorCorrectionLevel: 'M',
        margin: 2,
        color: {
          dark: '#172033',
          light: '#FFFFFF',
        },
        width: 220,
      });
    } catch {
      this.hasError = true;
    } finally {
      this.isGenerating = false;
    }
  }
}
