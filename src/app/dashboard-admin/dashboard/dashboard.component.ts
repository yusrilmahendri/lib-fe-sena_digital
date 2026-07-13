import { Component, OnInit, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import {
  ADMIN_MISSING_INVOICE_MESSAGE,
  getStatusDataFromNormalized,
  normalizeAdminDashboardResponse,
  normalizePaymentStatus,
} from '../admin-payment-response.util';

@Component({
  selector: 'wc-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  readonly missingInvoiceMessage = ADMIN_MISSING_INVOICE_MESSAGE;

  rows: Array<any> = [];
  columns: Array<any> = [];
  paketList: any[] = [];
  isLoading: boolean = false;

  user: any
  salary: any;
  total_users: any;
  pending_req: any;
  pagination: any = null;

  // Modal and form properties
  modalRef?: BsModalRef;
  confirmPaymentForm: FormGroup;
  selectedUser: any = null;
  private notyf: Notyf;

  constructor(
    private dashboardSvc: DashboardService,
    private modalService: BsModalService,
    private fb: FormBuilder
  ) {
    // Initialize Notyf
    this.notyf = new Notyf({
      duration: 1000,
      position: {
        x: 'right',
        y: 'top'
      }
    });

    // Initialize form
    this.confirmPaymentForm = this.fb.group({
      user_id: ['', Validators.required],
      kode_pemesanan: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.getPaketUndangan();
    this.columns = [
      { name: 'No Invoice', prop: 'invoice' },
      { name: 'Pengguna', prop: 'pengguna' },
      { name: 'Domain', prop: 'domain' },
      { name: 'Status', prop: 'status', type: 'html' }
    ];
  }

  getPaketUndangan() {
    this.isLoading = true;
    this.dashboardSvc.list(DashboardServiceType.MNL_MD_PACK_INVITATION,).subscribe({
      next: (res) => {
        console.log('[DashboardAdmin] Raw paket-undangan response:', res);
        this.paketList = res?.data ?? [];
        this.getDetailUser();
      },
      error: (error) => {
        console.error('[DashboardAdmin] Error paket-undangan response:', {
          status: error?.status,
          url: error?.url,
          error: error?.error,
        });
        this.paketList = [];
        this.getDetailUser();
      }
    });
  }

  getDetailUser() {
    this.isLoading = true;
    this.dashboardSvc.getParam(DashboardServiceType.ADM_IDX_DASHBOARD, '').subscribe({
      next: (res) => {
        console.log('[DashboardAdmin] Raw get-users response:', res);
        const normalized = normalizeAdminDashboardResponse(res, this.paketList);

        this.salary = normalized.metrics.totalRevenue;
        this.total_users = normalized.metrics.totalUsers;
        this.pending_req = normalized.metrics.pendingRequests;
        this.pagination = normalized.metrics.pagination;
        this.rows = normalized.rows;

        this.isLoading = false;
      },
      error: (error) => {
        console.error('[DashboardAdmin] Error get-users response:', {
          status: error?.status,
          url: error?.url,
          error: error?.error,
        });
        this.salary = 0;
        this.total_users = 0;
        this.pending_req = 0;
        this.pagination = null;
        this.rows = [];
        this.isLoading = false;
      }
    });
  }

  getStatusData(code: string | null): {text: string, class: string, ariaLabel: string} {
    return getStatusDataFromNormalized(normalizePaymentStatus(code));
  }

  onConfirmClicked(row: any, template: TemplateRef<any>) {
    if (!row.hasInvoice) {
      this.notyf.error(this.missingInvoiceMessage);
      return;
    }

    this.selectedUser = row;

    // Populate form with selected user data
    this.confirmPaymentForm.patchValue({
      user_id: row.id,
      kode_pemesanan: row.invoicePayload
    });

    // Open modal with custom class for styling
    this.modalRef = this.modalService.show(template, {
      class: 'modal-lg custom-payment-modal',
      backdrop: 'static',
      keyboard: false
    });
  }

  onSubmitPaymentConfirmation() {
    if (this.confirmPaymentForm.valid) {
      const kodePemesanan = String(this.confirmPaymentForm.value.kode_pemesanan || '').trim().replace(/^#+/, '');
      if (!kodePemesanan || kodePemesanan === '-' || kodePemesanan === '–') {
        this.notyf.error(this.missingInvoiceMessage);
        return;
      }

      const payload = {
        ...this.confirmPaymentForm.value,
        kode_pemesanan: kodePemesanan,
      };

      this.dashboardSvc.update(DashboardServiceType.RDM_CONFIRM_PAYMENT, '', payload).subscribe({
        next: (res) => {
          this.notyf.success('Berhasil konfirmasi pembayaran');
          this.modalRef?.hide();
          this.confirmPaymentForm.reset();
          this.selectedUser = null;
          this.getDetailUser(); // Refresh data
        },
        error: (error) => {
          console.error('Error confirming payment:', error);
          this.notyf.error(this.getPaymentConfirmationError(error));
        }
      });
    } else {
      this.notyf.error('Mohon lengkapi semua field yang diperlukan');
    }
  }

  onCancelModal() {
    this.modalRef?.hide();
    this.confirmPaymentForm.reset();
    this.selectedUser = null;
  }

  onEditClicked(row: any) {
    console.log('Edit action:', row);
  }

  onDeleteClicked(row: any) {
    console.log('Delete action:', row);
  }

  private getPaymentConfirmationError(error: any): string {
    const validationMessages = error?.error?.errors?.kode_pemesanan;
    if (Array.isArray(validationMessages) && validationMessages.length) {
      return validationMessages[0];
    }

    return error?.error?.message || 'Gagal konfirmasi pembayaran';
  }

  canSubmitPaymentConfirmation(): boolean {
    return this.confirmPaymentForm.valid && !!this.selectedUser?.hasInvoice;
  }
}
