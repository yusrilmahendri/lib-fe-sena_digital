import { Component, EventEmitter, Input, OnInit, Output, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import * as QRCode from 'qrcode';

@Component({
  selector: 'wc-qr-code-modal',
  templateUrl: './qr-code-modal.component.html',
  styleUrls: ['./qr-code-modal.component.scss']
})
export class QRCodeModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() url: string = '';
  @Input() title: string = '';
  @Input() description: string = '';
  @Output() close = new EventEmitter<void>();

  @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef<HTMLCanvasElement>;

  isGenerating: boolean = false;
  errorMessage: string = '';
  qrCodeGenerated: boolean = false;
  currentQrUrl: string = '';
  noticeMessage: string = '';

  constructor(public bsModalRef: BsModalRef) {}

  ngOnInit(): void {
    this.currentQrUrl = window.location.href;
    this.url = this.currentQrUrl;
    this.title = this.getQrModalTitle();
    this.description = this.getQrModalDescription();
  }

  ngAfterViewInit(): void {
    if (this.url) {
      setTimeout(() => {
        this.generateQRCode();
      }, 100);
    } else {
      this.errorMessage = 'URL QR tidak tersedia.';
    }
  }

  ngOnDestroy(): void {}

  hasGuestName(): boolean {
    const params = new URLSearchParams(window.location.search);
    return !!params.get('to');
  }

  getGuestNameFromUrl(): string {
    const params = new URLSearchParams(window.location.search);
    return decodeURIComponent(params.get('to') || '').replace(/-/g, ' ');
  }

  getQrModalTitle(): string {
    return this.hasGuestName() ? 'QR Undangan Tamu' : 'QR Undangan Umum';
  }

  getQrModalDescription(): string {
    return this.hasGuestName()
      ? 'Scan QR ini untuk membuka undangan personal dan mencatat kehadiran saat acara.'
      : 'QR ini tidak dapat digunakan untuk mencatat kehadiran karena tidak memiliki nama tamu undangan.';
  }

  /**
   * Generate QR code from the provided URL
   */
  private async generateQRCode(): Promise<void> {
    this.currentQrUrl = window.location.href;
    this.url = this.currentQrUrl;

    if (!this.url) {
      this.errorMessage = 'URL QR tidak tersedia.';
      return;
    }

    if (!this.qrCanvas) {
      this.errorMessage = 'Canvas QR tidak ditemukan.';
      return;
    }

    this.isGenerating = true;
    this.errorMessage = '';

    try {
      const canvas = this.qrCanvas.nativeElement;

      const options = {
        errorCorrectionLevel: 'M' as const,
        type: 'image/png' as const,
        quality: 0.92,
        margin: 2,
        color: {
          dark: '#2a2118',
          light: '#FFFFFF'
        },
        width: 260,
        scale: 4
      };

      await QRCode.toCanvas(canvas, this.url, options);

      this.qrCodeGenerated = true;
      this.isGenerating = false;

    } catch (error) {
      this.errorMessage = 'Gagal membuat QR. Silakan coba lagi.';
      this.isGenerating = false;
    }
  }

  /**
   * Retry generating QR code
   */
  retryGeneration(): void {
    this.generateQRCode();
  }

  /**
   * Copy URL to clipboard
   */
  async copyUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url);
      this.showNotice('Link berhasil disalin.');
    } catch (error) {
      this.fallbackCopyUrl();
    }
  }

  /**
   * Fallback copy method for older browsers
   */
  private fallbackCopyUrl(): void {
    const textArea = document.createElement('textarea');
    textArea.value = this.url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      this.showNotice('Link berhasil disalin.');
    } catch (error) {
      this.showNotice('Gagal menyalin link.');
    }

    document.body.removeChild(textArea);
  }

  /**
   * Share URL using Web Share API or fallback
   */
  async shareUrl(): Promise<void> {
    if (navigator.share) {
      try {
        await navigator.share({
          title: this.title,
          text: this.description,
          url: this.url
        });
      } catch (error) {
        this.copyUrl();
      }
    } else {
      this.copyUrl();
    }
  }

  /**
   * Close the modal
   */
  closeModal(): void {
    this.close.emit();
    this.bsModalRef.hide();
  }

  private showNotice(message: string): void {
    this.noticeMessage = message;
    window.setTimeout(() => {
      if (this.noticeMessage === message) {
        this.noticeMessage = '';
      }
    }, 2500);
  }
}
