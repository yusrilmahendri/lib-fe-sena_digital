import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { PaymentConfirmComponent } from 'src/app/shared/payment-confirm/payment-confirm.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'wc-regis-pembayaran',
  templateUrl: './regis-pembayaran.component.html',
  styleUrls: ['./regis-pembayaran.component.scss']
})
export class RegisPembayaranComponent implements OnInit {

  @Input() formData: any;

  @Output() prev = new EventEmitter<void>();


  events: any = [];
  selectedMethod: any;
  bill: any;
  manualBill: any;
  private notyf: Notyf


  selectOptions: any = {
    payment: {
      items: [],
      defaultValue: [],
      FormControl: new FormControl(),
    }
  };
  userId: any;
  invitationId: number | null = null;
  isTrialPackage = false;
  paymentError = '';
  isStartingPayment = false;

  constructor(
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

  ngOnInit(): void {
    const allDataFromStepsStr = localStorage.getItem('formData');
    if (allDataFromStepsStr) {
      const allDataFromSteps = JSON.parse(allDataFromStepsStr);
      const invitation =
        allDataFromSteps?.registrasi?.response?.invitation ??
        allDataFromSteps?.response?.invitation;
      if (allDataFromSteps?.registrasi?.formData) {
        this.manualBill = allDataFromSteps.registrasi.formData.price;
      }
      const userId = allDataFromSteps?.registrasi?.response?.user?.id;
      this.userId = userId;
      this.invitationId = invitation?.id ?? null;
      this.manualBill =
        invitation?.package_price_snapshot ??
        this.manualBill;
      this.isTrialPackage = this.resolveIsTrialPackage(invitation);
    }
    this.getMasterPayment();
  }

  getMasterPayment() {
    this.paymentError = '';
    this.dashboardSvc.getParam(DashboardServiceType.MNL_ACTIVE_PAYMENT_METHOD, '').subscribe({
      next: (response: any) => {
        const expectedMethodId = this.isTrialPackage ? 4 : 3;
        const activeMethods = this.mapActivePaymentMethods(response);
        const expectedMethod = activeMethods.find(
          (method: any) => Number(method.id) === expectedMethodId
        );

        if (expectedMethod) {
          this.selectOptions.payment.items = [expectedMethod];
          this.selectedMethod = expectedMethod.id;
          return;
        }

        // The public active endpoint returns only one active method. Resolve
        // the correct package method from the safe master list instead of
        // falling a paid package back to Trial.
        this.loadPackagePaymentMethod(expectedMethodId);
      },
      error: (err: any) => {
        this.paymentError = this.getApiErrorMessage(err);
        this.loadPackagePaymentMethod(this.isTrialPackage ? 4 : 3);
      },
    });
  }

  private mapActivePaymentMethods(response: any): any[] {
    const rawData = Array.isArray(response?.data)
      ? response.data
      : response?.data
        ? [response.data]
        : [];

    return rawData
      .filter((item: any) => item?.is_active !== false)
      .map((item: any) =>
        item?.metode_transaction || item?.metodeTransaction || item
      )
      .filter((item: any) => item?.id != null && item?.name);
  }

  private loadPackagePaymentMethod(expectedMethodId: number): void {
    this.dashboardSvc.getParam(DashboardServiceType.MD_RGS_PAYMENT, '').subscribe({
      next: (response: any) => {
        const methods = Array.isArray(response?.data) ? response.data : [];
        const expectedMethod = methods.find(
          (method: any) => Number(method.id) === expectedMethodId
        );
        this.selectOptions.payment.items = expectedMethod ? [expectedMethod] : [];
        if (expectedMethod) {
          this.selectedMethod = expectedMethod.id;
        }
      },
      error: (err: any) => {
        this.selectOptions.payment.items = [];
        this.paymentError = this.getApiErrorMessage(err);
      },
    });
  }

  private resolveIsTrialPackage(invitation: any): boolean {
    if (typeof invitation?.is_trial === 'boolean') {
      return invitation.is_trial;
    }
    if (invitation?.is_trial === 1 || invitation?.is_trial === '1') {
      return true;
    }

    const snapshot = invitation?.package_features_snapshot || {};
    const packageName = `${snapshot?.jenis_paket || ''} ${snapshot?.name_paket || ''}`;
    return /trial/i.test(packageName);
  }

  getMasterMethod() {
    this.dashboardSvc.getParam(DashboardServiceType.MNL_MD_METHOD, '').subscribe(res => {
      this.events = res?.data;
    })
  }

  getDetailMethod() {
    if ([3, 4].includes(Number(this.selectedMethod))) {
      this.bill = [];
      return;
    }
    const query = `?id_methode_pembayaran=${this.selectedMethod}`
    this.dashboardSvc.getParam(DashboardServiceType.MNL_MD_METHOD_DETAIL, query).subscribe(res => {
      this.bill = res?.data;
    })
  }

  onMetodeSelect(event: any) {
    this.paymentError = '';
    this.selectedMethod = Number(event);
    this.getDetailMethod();
  }

  onBack() {
    this.prev.emit()
  }

  onNextClicked() {
    if (Number(this.selectedMethod) === 3) {
      this.startMidtransPayment();
      return;
    }

    if (Number(this.selectedMethod) === 4 && this.isTrialPackage) {
      this.modalService.show(PaymentConfirmComponent, {
        initialState: {
          userId: this.userId
        }
      });
      return;
    }

    if ([1, 2].includes(Number(this.selectedMethod))) {
      this.handleManualOrTripayPayment();
    }
  }

  private handleManualOrTripayPayment(): void {
    this.modalService.show(PaymentConfirmComponent, {
      initialState: {
        userId: this.userId
      }
    });
  }

  private startMidtransPayment(): void {
    if (this.isStartingPayment || this.invitationId == null) {
      this.paymentError = 'Data undangan untuk pembayaran tidak ditemukan.';
      return;
    }

    this.paymentError = '';
    this.isStartingPayment = true;
    this.dashboardSvc.create(DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN, {
      invitation_id: this.invitationId,
      amount: this.manualBill,
    }).subscribe({
      next: (res: any) => {
        const snapToken = res?.data?.snap_token;
        if (!snapToken) {
          this.isStartingPayment = false;
          this.paymentError = res?.message || 'Token pembayaran Midtrans tidak ditemukan.';
          return;
        }

        const host = environment.production
          ? 'https://app.midtrans.com'
          : 'https://app.sandbox.midtrans.com';
        window.location.assign(
          `${host}/snap/v2/vtweb/${encodeURIComponent(snapToken)}`
        );
      },
      error: (err: any) => {
        this.isStartingPayment = false;
        this.paymentError = this.getApiErrorMessage(err);
      },
    });
  }

  private getApiErrorMessage(err: any): string {
    return err?.error?.message || err?.message || String(err);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.notyf.success('Nomor rekening disalin!');
    }).catch(() => {
      this.notyf.error('Gagal menyalin.');
    });
  }

  copyTripayToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.notyf.success('Kode Tripay disalin!');
    }).catch(() => {
      this.notyf.error('Gagal menyalin.');
    });
  }

}
