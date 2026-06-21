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
    this.getMasterPayment()
    const allDataFromStepsStr = localStorage.getItem('formData');
    if (allDataFromStepsStr) {
      const allDataFromSteps = JSON.parse(allDataFromStepsStr);
      if (allDataFromSteps?.registrasi?.formData) {
        this.manualBill = allDataFromSteps.registrasi.formData.price;
      }
      const userId = allDataFromSteps?.registrasi?.response?.user?.id;
      this.userId = userId;
      this.invitationId =
        allDataFromSteps?.registrasi?.response?.invitation?.id ??
        allDataFromSteps?.response?.invitation?.id ??
        null;
      this.manualBill =
        allDataFromSteps?.registrasi?.response?.invitation?.package_price_snapshot ??
        this.manualBill;
    }
  }

  getMasterPayment() {
    this.dashboardSvc.getParam(DashboardServiceType.MNL_ACTIVE_PAYMENT_METHOD, '').subscribe((response) => {
      this.selectOptions.payment.items = response["data"];
    });
  }

  getMasterMethod() {
    this.dashboardSvc.getParam(DashboardServiceType.MNL_MD_METHOD, '').subscribe(res => {
      this.events = res?.data;
    })
  }

  getDetailMethod() {
    if (Number(this.selectedMethod) === 3) {
      this.bill = [];
      return;
    }
    const query = `?id_methode_pembayaran=${this.selectedMethod}`
    this.dashboardSvc.getParam(DashboardServiceType.MNL_MD_METHOD_DETAIL, query).subscribe(res => {
      this.bill = res?.data;
    })
  }

  onMetodeSelect(event: any) {
    console.log(event);
    this.selectedMethod = event;
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
          this.paymentError = 'Token pembayaran Midtrans tidak ditemukan.';
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
        this.paymentError =
          err?.error?.errors?.amount?.[0] ||
          err?.error?.errors?.invitation_id?.[0] ||
          err?.error?.message ||
          'Pembayaran Midtrans belum dapat dimulai.';
      },
    });
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
