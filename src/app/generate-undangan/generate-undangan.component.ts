import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DashboardService, DashboardServiceType } from '../dashboard.service';

@Component({
  selector: 'wc-generate-undangan',
  templateUrl: './generate-undangan.component.html',
  styleUrls: ['./generate-undangan.component.scss'],
})
export class GenerateUndanganComponent implements OnInit {

  titles: string[] = ['Isi Data Akun', 'Informasi Mempelai', 'Konfirmasi Data', 'Pembayaran'];

  formData: any = {
    registrasi: {},
    informasiMempelai: {},
    cerita: {},
    pembayaran: {},
    step: 1,
  };

  /** Shown when the user is redirected from the landing modal after one-step. */
  onboardingNotice = '';

  /** Payment status message from Midtrans callback */
  paymentStatusMessage = '';

  constructor(
    private route: ActivatedRoute,
    private dashboardSvc: DashboardService
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('formData');
    if (saved) {
      this.formData = JSON.parse(saved);
    }

    const temporaryPassword = history.state?.registrationDraft?.password;
    if (temporaryPassword && this.formData?.registrasi) {
      this.formData.registrasi = {
        ...this.formData.registrasi,
        formData: {
          ...(this.formData.registrasi.formData || this.formData.registrasi),
          password: temporaryPassword,
        },
      };
    }
    if (history.state?.registrationDraft) {
      const { registrationDraft, ...navigationState } = history.state;
      history.replaceState(navigationState, document.title);
    }

    // Also removes password left by older versions of this flow.
    this.persistFormData();

    const notice = sessionStorage.getItem('landingOnboardingNotice');
    if (notice) {
      this.onboardingNotice = notice;
      sessionStorage.removeItem('landingOnboardingNotice');
    }

    // Handle Midtrans callback
    this.handleMidtransCallback();

    console.log('all formdata:', this.formData);
  }

  get title(): string {
    return this.titles[this.formData.step - 1] || 'Form';
  }

  get progress(): number {
    return (this.formData.step / this.titles.length) * 100;
  }


  nextStep(data: any): void {
    this.formData = {
      ...this.formData,
      registrasi: data?.formData || this.formData?.registrasi,
    };
    const step = this.formData.step;

    if (step === 1) {
      this.formData.registrasi = data;
    } else if (step === 2) {
      this.formData.informasiMempelai = data;
    } else if (step === 3) {
      this.formData.cerita = data;
    }

    // Naikkan step
    this.formData.step = step + 1;
    this.persistFormData();
  }


  prevStep(): void {
    if (this.formData.step > 1) {
      this.formData.step--;
      this.persistFormData();

    }
  }

  /** Persist resumable fields while keeping password only in component state. */
  private persistFormData(): void {
    const persisted = JSON.parse(JSON.stringify(this.formData));
    if (persisted?.registrasi?.password) {
      delete persisted.registrasi.password;
    }
    if (persisted?.registrasi?.formData?.password) {
      delete persisted.registrasi.formData.password;
    }
    localStorage.setItem('formData', JSON.stringify(persisted));
  }

  private handleMidtransCallback(): void {
    this.route.queryParams.subscribe((params) => {
      const paymentStatus = params['payment'];
      const orderId = params['order_id'];
      const statusCode = params['status_code'];

      // Only handle if payment query param exists
      if (!paymentStatus) {
        return;
      }

      // Don't navigate based on URL - require API verification
      if (paymentStatus === 'finish' && statusCode && orderId) {
        this.verifyMidtransPayment(orderId, statusCode);
      } else if (paymentStatus === 'unfinish' && orderId) {
        this.handleMidtransUnfinish(orderId);
      } else if (paymentStatus === 'error' && orderId) {
        this.handleMidtransError(orderId);
      }

      // Clean up query params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    });
  }

  private verifyMidtransPayment(orderId: string, statusCode: string): void {
    this.dashboardSvc.getParam(
      DashboardServiceType.MIDTRANS_CHECK_STATUS,
      '',
      { order_id: orderId }
    ).subscribe({
      next: (res: any) => {
        const transactionStatus = res?.data?.transaction_status;

        if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
          // Payment successful
          this.paymentStatusMessage = 'Pembayaran berhasil! Terima kasih.';
          this.formData.step = 4;
          this.persistFormData();
          // Clear saved redirect URL after successful payment
          const invitationId = this.formData?.registrasi?.response?.invitation?.id;
          if (invitationId) {
            localStorage.removeItem(`midtrans_redirect_${invitationId}`);
          }
        } else if (transactionStatus === 'pending') {
          // Payment pending
          this.paymentStatusMessage = 'Pembayaran masih diproses. Silakan tunggu atau coba lagi nanti.';
          this.formData.step = 4;
          this.persistFormData();
        } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
          // Payment failed/cancelled
          this.paymentStatusMessage = `Pembayaran ${transactionStatus}. Silakan coba lagi.`;
          this.formData.step = 4;
          this.persistFormData();
        }
      },
      error: () => {
        this.paymentStatusMessage = 'Tidak dapat memverifikasi status pembayaran. Silakan hubungi support.';
        this.formData.step = 4;
        this.persistFormData();
      },
    });
  }

  private handleMidtransUnfinish(orderId: string): void {
    this.paymentStatusMessage = 'Pembayaran dibatalkan atau belum diselesaikan. Silakan coba lagi.';
    this.formData.step = 4;
    this.persistFormData();
  }

  private handleMidtransError(orderId: string): void {
    this.paymentStatusMessage = 'Terjadi kesalahan pada pembayaran. Silakan coba lagi.';
    this.formData.step = 4;
    this.persistFormData();
  }

}
