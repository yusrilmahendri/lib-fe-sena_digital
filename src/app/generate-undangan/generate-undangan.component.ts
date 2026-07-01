import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  isHandlingMidtransCallback = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
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

    this.formData.step = this.normalizeStep(this.formData.step);

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
    const step = this.normalizeStep(this.formData.step);

    if (step === 1) {
      this.formData.registrasi = data;
    } else if (step === 2) {
      this.formData.informasiMempelai = data;
    } else if (step === 3) {
      this.formData.cerita = data;
    }

    this.formData.step = step + 1;
    this.persistFormData();
  }

  goToPreviousStep(): void {
    const beforeStep = this.normalizeStep(this.formData.step);
    console.log('[CreateInvitationBack]', { beforeStep });

    if (beforeStep > 1) {
      this.formData = {
        ...this.formData,
        step: beforeStep - 1,
      };
      this.persistFormData();
      this.scrollToTop();
    }

    console.log('[CreateInvitationBackDone]', {
      afterStep: this.normalizeStep(this.formData.step),
    });
  }

  private normalizeStep(step: unknown): number {
    const numeric = Number(step);
    if (!Number.isFinite(numeric) || numeric < 1) {
      return 1;
    }
    return Math.floor(numeric);
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Persist resumable fields while keeping password only in component state. */
  private persistFormData(): void {
    const persisted = JSON.parse(JSON.stringify(this.formData));
    persisted.step = this.normalizeStep(persisted.step);
    if (persisted?.registrasi?.password) {
      delete persisted.registrasi.password;
    }
    if (persisted?.registrasi?.formData?.password) {
      delete persisted.registrasi.formData.password;
    }
    localStorage.setItem('formData', JSON.stringify(persisted));
  }

  private handleMidtransCallback(): void {
    const params = this.route.snapshot.queryParams;
    const paymentStatus = `${params['payment'] || ''}`.toLowerCase();
    const orderId = params['order_id'];
    const statusCode = params['status_code'];
    const transactionStatus = params['transaction_status'];
    const isMidtransCallback =
      ['finish', 'unfinish', 'error'].includes(paymentStatus) ||
      (!!orderId && (!!statusCode || !!transactionStatus));

    if (!isMidtransCallback) {
      return;
    }

    this.isHandlingMidtransCallback = true;
    this.paymentStatusMessage = 'Memverifikasi status pembayaran...';

    if (!orderId) {
      this.redirectToBill('Status pembayaran tidak dapat diverifikasi karena Order ID tidak ditemukan.');
      return;
    }

    this.verifyMidtransPayment(orderId);
  }

  private verifyMidtransPayment(orderId: string): void {
    this.dashboardSvc.create(
      DashboardServiceType.MIDTRANS_CHECK_STATUS,
      { order_id: orderId }
    ).subscribe({
      next: (res: any) => {
        const status = this.resolveMidtransStatus(res);

        if (this.isPaidStatus(status)) {
          this.clearSavedMidtransRedirect();
          this.router.navigate(['/dashboard/overview'], {
            replaceUrl: true,
            state: {
              paymentStatusMessage: 'Pembayaran berhasil. Selamat datang di dashboard.',
            },
          });
          return;
        }

        if (this.isPendingStatus(status)) {
          this.redirectToBill('Pembayaran masih menunggu penyelesaian. Silakan cek status pembayaran Anda.');
          return;
        }

        if (this.isFailedStatus(status)) {
          this.redirectToBill('Pembayaran belum berhasil atau sudah kedaluwarsa. Silakan cek status pembayaran Anda.');
          return;
        }

        this.redirectToBill(res?.message || 'Status pembayaran belum dapat dipastikan. Silakan cek kembali status pembayaran Anda.');
      },
      error: (err: any) => {
        const message =
          err?.error?.message ||
          err?.message ||
          'Tidak dapat memverifikasi status pembayaran. Silakan cek kembali status pembayaran Anda.';
        this.redirectToBill(message);
      },
    });
  }

  private resolveMidtransStatus(res: any): string {
    const transactionStatus = (
      res?.transaction_status ||
      res?.data?.transaction_status ||
      res?.data?.status ||
      ''
    ).toString().toLowerCase();
    const paymentStatus = (
      res?.payment_status ||
      res?.data?.payment_status ||
      ''
    ).toString().toLowerCase();

    if (['paid', 'success'].includes(paymentStatus)) {
      return 'success';
    }

    if (['failed', 'expired', 'refunded'].includes(paymentStatus)) {
      return transactionStatus || paymentStatus;
    }

    return transactionStatus || paymentStatus;
  }

  private isPaidStatus(status: string): boolean {
    return ['settlement', 'capture', 'success', 'paid'].includes(status);
  }

  private isPendingStatus(status: string): boolean {
    return ['pending', 'challenge'].includes(status);
  }

  private isFailedStatus(status: string): boolean {
    return ['deny', 'cancel', 'expire', 'expired', 'failure', 'failed', 'error', 'refund', 'refunded'].includes(status);
  }

  private redirectToBill(message: string): void {
    this.paymentStatusMessage = message;
    this.router.navigate(['/dashboard/bill'], {
      replaceUrl: true,
      state: {
        paymentStatusMessage: message,
      },
    });
  }

  private clearSavedMidtransRedirect(): void {
    const invitationId =
      this.formData?.registrasi?.response?.invitation?.id ??
      this.formData?.response?.invitation?.id;

    if (invitationId) {
      localStorage.removeItem(`midtrans_redirect_${invitationId}`);
    }
  }

}
