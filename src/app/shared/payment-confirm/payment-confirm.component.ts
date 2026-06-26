import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'wc-payment-confirm',
  templateUrl: './payment-confirm.component.html',
  styleUrls: ['./payment-confirm.component.scss']
})
export class PaymentConfirmComponent implements OnInit {
  private readonly adminWhatsappNumber = '628817587308';

  private notyf: Notyf;
  kodePayment: any;
  inputKodePayment: string = '';
  @Input() userId!: number;
  @Input() isTrialPackage = false;
  form!: FormGroup;

  /** Payment submit state, shown in the template near the confirm button. */
  isPaymentSubmitting = false;
  paymentErrorMessage = '';

  constructor(
    private fb: FormBuilder,
    private modalService: BsModalService,
    private router: Router,
  ) {
    this.notyf = new Notyf({
      duration: 1000,
      position: {
        x: 'right',
        y: 'top'
      }
    });
  }

  ngOnInit() {
    const allDataFromStepsStr = localStorage.getItem('formData');
    console.log('userId', this.userId);

    let kodePemesanan = '';

    if (allDataFromStepsStr) {
      const allDataFromSteps = JSON.parse(allDataFromStepsStr);

      const kodeFromForm = allDataFromSteps?.registrasi?.formData?.kode_pemesanan;
      const kodeFromUser = allDataFromSteps?.registrasi?.response.user?.kode_pemesanan;

      if (kodeFromForm) {
        kodePemesanan = kodeFromForm;
      } else if (kodeFromUser) {
        kodePemesanan = kodeFromUser;
      }

      this.kodePayment = kodePemesanan;
    }

    this.form = this.fb.group({
      user_id: [this.userId],
      kode_pemesanan: [this.kodePayment || '']
    });
  }


  copyMidtrans(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.notyf.success('berhasil disalin!');
    }).catch(() => {
      this.notyf.error('Gagal menyalin.');
    });
  }

  onConfirm() {
    if (this.isPaymentSubmitting) {
      return;
    }
    this.isPaymentSubmitting = true;
    this.paymentErrorMessage = '';

    // For Trial packages: skip API call and go directly to dashboard
    if (this.isTrialPackage) {
      this.modalService.hide();
      this.clearWizardState();
      this.router.navigate(['/dashboard']);
      return;
    }

    // For Manual payment: users must NOT call admin-only confirmation endpoint.
    // Redirect user to admin WhatsApp with order code for manual verification.
    const kodePemesanan = String(this.form.get('kode_pemesanan')?.value || this.kodePayment || '').trim();
    if (!kodePemesanan) {
      this.isPaymentSubmitting = false;
      this.paymentErrorMessage = 'Kode pemesanan tidak ditemukan. Silakan salin ulang kode pemesanan Anda.';
      return;
    }

    const whatsappUrl = this.buildAdminWhatsappUrl(kodePemesanan);
    this.isPaymentSubmitting = false;
    this.paymentErrorMessage =
      'Konfirmasi manual hanya dapat diverifikasi oleh admin. Silakan kirim kode pemesanan ke admin.';

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  private buildAdminWhatsappUrl(kodePemesanan: string): string {
    const text = encodeURIComponent(
      `Halo Admin, saya ingin konfirmasi pembayaran manual.\n` +
      `Kode pemesanan: ${kodePemesanan}\n` +
      `Mohon dibantu verifikasi pembayaran saya.`
    );
    return `https://wa.me/${this.adminWhatsappNumber}?text=${text}`;
  }

  private clearWizardState(): void {
    try {
      localStorage.removeItem('formData');
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('midtrans_redirect_')) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Ignore localStorage errors
    }
  }

}
