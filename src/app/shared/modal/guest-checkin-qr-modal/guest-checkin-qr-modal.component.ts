import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import * as QRCode from 'qrcode';

@Component({
  selector: 'wc-guest-checkin-qr-modal',
  templateUrl: './guest-checkin-qr-modal.component.html',
  styleUrls: ['./guest-checkin-qr-modal.component.scss'],
})
export class GuestCheckinQrModalComponent implements AfterViewInit, OnDestroy {
  @Input() guestName = '';
  @Input() checkinUrl = '';
  @Input() downloadFileName = 'qr-kehadiran.png';

  @ViewChild('qrCanvas', { static: false }) qrCanvas?: ElementRef<HTMLCanvasElement>;

  isGenerating = false;
  errorMessage = '';
  qrCodeGenerated = false;
  noticeMessage = '';

  constructor(public bsModalRef: BsModalRef) {}

  ngAfterViewInit(): void {
    if (this.checkinUrl) {
      window.setTimeout(() => this.generateQRCode(), 100);
    } else {
      this.errorMessage = 'Link check-in belum tersedia.';
    }
  }

  ngOnDestroy(): void {
    this.noticeMessage = '';
  }

  closeModal(): void {
    this.bsModalRef.hide();
  }

  async copyCheckinLink(): Promise<void> {
    if (!this.checkinUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.checkinUrl);
      this.noticeMessage = 'Link check-in berhasil disalin.';
    } catch {
      this.fallbackCopy(this.checkinUrl);
    }
  }

  downloadQRCode(): void {
    if (!this.qrCanvas?.nativeElement || !this.qrCodeGenerated) {
      return;
    }

    const dataUrl = this.qrCanvas.nativeElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = this.downloadFileName || 'qr-kehadiran.png';
    link.href = dataUrl;
    link.click();
    this.noticeMessage = 'QR kehadiran berhasil diunduh.';
  }

  retryGeneration(): void {
    this.generateQRCode();
  }

  private async generateQRCode(): Promise<void> {
    if (!this.checkinUrl || !this.qrCanvas?.nativeElement) {
      this.errorMessage = 'Data QR kehadiran belum lengkap.';
      return;
    }

    this.isGenerating = true;
    this.errorMessage = '';

    try {
      await QRCode.toCanvas(this.qrCanvas.nativeElement, this.checkinUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        color: {
          dark: '#172033',
          light: '#FFFFFF',
        },
        width: 280,
      });

      this.qrCodeGenerated = true;
    } catch {
      this.errorMessage = 'Gagal membuat QR kehadiran. Silakan coba lagi.';
    } finally {
      this.isGenerating = false;
    }
  }

  private fallbackCopy(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand('copy');
      this.noticeMessage = 'Link check-in berhasil disalin.';
    } catch {
      this.noticeMessage = 'Gagal menyalin link check-in.';
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
