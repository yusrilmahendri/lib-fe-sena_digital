import { Component, Input, OnInit } from '@angular/core';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from '../../dashboard.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { SuccessConfirmPaymentComponent } from '../success-confirm-payment/success-confirm-payment.component';

@Component({
  selector: 'wc-payment-confirm',
  templateUrl: './payment-confirm.component.html',
  styleUrls: ['./payment-confirm.component.scss']
})
export class PaymentConfirmComponent implements OnInit {

  private notyf: Notyf;
  kodePayment: any;
  inputKodePayment: string = '';
  @Input() userId!: number;
  form!: FormGroup;

  /** Payment submit state, shown in the template near the confirm button. */
  isPaymentSubmitting = false;
  paymentErrorMessage = '';

  constructor(
    private fb: FormBuilder,
    private dashboardSvc: DashboardService,
    private modalService: BsModalService,
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

    // Legacy payload kept unchanged: { user_id, kode_pemesanan }.
    const payload = this.form.value;
    this.dashboardSvc.update(DashboardServiceType.RDM_CONFIRM_PAYMENT, '', payload).subscribe({
      next: () => {
        this.isPaymentSubmitting = false;
        this.notyf.success('Berhasil konfirmasi pembayaran');
        this.modalService.hide();
        setTimeout(() => {
          this.modalService.show(SuccessConfirmPaymentComponent, {
            initialState: {
              message: 'Konfirmasi berhasil!'
            }
          });
        }, 300);
      },
      error: (err) => {
        // Never redirect, logout, clear the token, or close the modal on error.
        // Keep the user in the flow with a clear, user-friendly message.
        this.isPaymentSubmitting = false;
        this.paymentErrorMessage = this.mapPaymentError(err);
      }
    });
  }

  /** Map a payment error to a clear, user-friendly Indonesian message. */
  private mapPaymentError(err: any): string {
    const status = err?.status;
    const backendMessage = err?.error?.message || err?.message;

    if (backendMessage) {
      return backendMessage;
    }

    if (status === 401) {
      return 'Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.';
    }
    if (status === 403) {
      return 'Akun Anda belum memiliki akses untuk melanjutkan pembayaran. ' +
        'Silakan lengkapi data undangan terlebih dahulu atau hubungi admin.';
    }
    if (status === 422) {
      const validationMsg = this.firstValidationError(err);
      return (
        validationMsg ||
        backendMessage ||
        'Data pembayaran belum lengkap. Silakan periksa kembali.'
      );
    }
    if (status === 500) {
      return 'Terjadi gangguan pada server pembayaran. Silakan coba beberapa saat lagi.';
    }
    if (status === 0 || status == null) {
      return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    }

    return 'Pembayaran belum dapat diproses. Silakan coba kembali.';
  }

  private firstValidationError(err: any): string | null {
    const errors = err?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const firstVal = firstKey ? errors[firstKey] : null;
      if (Array.isArray(firstVal) && firstVal.length) {
        return firstVal[0];
      }
      if (typeof firstVal === 'string') {
        return firstVal;
      }
    }
    return null;
  }

}
