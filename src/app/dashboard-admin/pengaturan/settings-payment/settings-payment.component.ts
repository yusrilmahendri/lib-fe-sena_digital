import { Component, OnInit } from '@angular/core';
import { DashboardService, DashboardServiceType, UserPaymentConfig } from '../../../dashboard.service';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Notyf } from 'notyf';
import { environment } from '../../../../environments/environment';
import { forkJoin } from 'rxjs';

/**
 * SettingsPaymentComponent
 *
 * Admin component for managing payment methods settings.
 * For manual payment method (rekening), implements full CRUD operations
 * according to the API contract specifications:
 *
 * - CREATE: POST /api/v1/admin/send-rekening
 * - READ:   GET /api/v1/admin/get-rekening
 * - UPDATE: PUT /api/v1/admin/update-rekening/{id}
 * - DELETE: DELETE /api/v1/admin/delete-rekening/{id}
 *
 * All operations support file upload for photo_rek (optional).
 * Validation includes bank code verification and file type/size checks.
 */

interface Bank {
  id: number;
  kode_bank: string;
  name: string;
  logo?: string;
}

interface PaymentMethodDetail {
  id: number;
  metodePembayaran: string;
  idMetodePembayaran: string;
  userId?: number;
  // Manual payment fields
  pengguna?: string;
  email?: string;
  noRekening?: string;
  namaBank?: string;
  kodeBank?: string;
  namaPemilik?: string;
  photoRek?: string | null;
  // Tripay fields
  urlTripay?: string;
  privateKey?: string;
  apiKey?: string;
  kodeMerchant?: string;
  // Midtrans fields
  url?: string;
  serverKey?: string;
  clientKey?: string;
  metodeProduction?: string;
  // Trial fields
  trialInfo?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RekeningApiResponse {
  id: number;
  kode_bank: string;
  nomor_rekening: string;
  nama_bank: string;
  nama_pemilik: string;
  photo_rek: string | null;
  bank_info: {
    id: number;
    name: string;
    kode_bank: string;
  };
  created_at: string;
  updated_at: string;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

interface ApiErrorResponse {
  message: string;
  errors?: { [key: string]: string[] };
}

@Component({
  selector: 'wc-settings-payment',
  templateUrl: './settings-payment.component.html',
  styleUrls: ['./settings-payment.component.scss']
})
export class SettingsPaymentComponent implements OnInit {
  private readonly adminRekeningBaseUrl = `${environment.apiBaseUrl}/v1/admin`;

  activePaymentMethod: 'manual' | 'midtrans' | null = null;
  paymentStatusError = '';

  // Bank list for manual payments
  bankList: Bank[] = [];

  // Forms
  paymentForm!: FormGroup;
  editPaymentForm?: FormGroup;

  // Data display
  paymentDetails: PaymentMethodDetail[] = [];

  // UI state for multiple rekenings
  isLoading = false;
  isSubmitting = false;
  selectedPhotoFile: File | null = null; // Single file for current form
  selectedEditPhotoFile: File | null = null; // Single file for edit mode
  maxRekenings = 2; // Maximum 2 rekenings as per Laravel backend

  // Modal state
  currentEditItem: PaymentMethodDetail | null = null;

  private notyf: Notyf;

  constructor(
    private fb: FormBuilder,
    private dashboardSvc: DashboardService
  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadBankList();
    this.loadPaymentDetails();
    this.loadActivePaymentStatus();
  }

  private loadBankList(): void {
    this.dashboardSvc.list(DashboardServiceType.MD_LIST_BANK).subscribe({
      next: (res) => {
        this.bankList = res?.data || [];
      },
      error: (err) => {
        console.error('Error loading bank list:', err);
        this.notyf.error('Gagal memuat daftar bank');
      }
    });
  }

  private initializeForm(): void {
    this.paymentForm = this.fb.group({
      kode_bank: new FormControl('', [Validators.required]),
      nomor_rekening: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]+$/)]),
      nama_pemilik: new FormControl('', [Validators.required, Validators.minLength(2)])
    });
  }

  onBankSelect(selectedItem: any): void {
    if (!this.paymentForm) return;

    // Extract the bank code from the selected item
    const bankCode = selectedItem?.kode_bank || selectedItem;
    this.paymentForm.get('kode_bank')?.setValue(bankCode);
  }

  private validateBankCode(bankCode: string): boolean {
    if (!this.bankList || this.bankList.length === 0) {
      return false;
    }
    return this.bankList.some(bank => bank.kode_bank === bankCode);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (!this.validateFile(file)) {
        return;
      }

      this.selectedPhotoFile = file;
    }
  }

  private loadPaymentDetails(): void {
    this.isLoading = true;
    this.loadManualPaymentDetails();
  }

  private loadActivePaymentStatus(): void {
    this.paymentStatusError = '';
    this.dashboardSvc.getUserPaymentConfig().subscribe({
      next: (response: UserPaymentConfig) => {
        const method = response?.payment_method || response?.data?.payment_method || null;
        this.activePaymentMethod = method === 'manual' || method === 'midtrans' ? method : null;
      },
      error: (err) => {
        this.activePaymentMethod = null;
        this.paymentStatusError = err?.error?.message || 'Gagal memuat status metode pembayaran aktif.';
      }
    });
  }

  private loadManualPaymentDetails(): void {
    this.dashboardSvc.httpSvc.get(`${this.adminRekeningBaseUrl}/get-rekening`).subscribe({
      next: (response: any) => {
        console.log('Manual payment API response:', response);
        this.mapManualPaymentDetails(response.data || []);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading manual payment details:', err);
        this.notyf.error('Gagal memuat detail rekening');
        this.isLoading = false;
      }
    });
  }

  private mapManualPaymentDetails(data: RekeningApiResponse[]): void {
    console.log('Mapping manual payment details:', data);

    this.paymentDetails = data.map((item: RekeningApiResponse) => {
      const detail: PaymentMethodDetail = {
        id: item.id,
        metodePembayaran: 'Manual',
        idMetodePembayaran: '1',
        userId: undefined,
        pengguna: item.nama_pemilik,
        email: '-',
        noRekening: item.nomor_rekening,
        namaBank: item.nama_bank,
        kodeBank: item.kode_bank,
        namaPemilik: item.nama_pemilik,
        photoRek: item.photo_rek,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      };

      return detail;
    });

    console.log('Mapped manual payment details:', this.paymentDetails);
  }

  private validateFile(file: File): boolean {
    const maxSize = 2 * 1024 * 1024; // 2MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

    if (file.size > maxSize) {
      this.notyf.error('Ukuran file maksimal 2MB');
      return false;
    }

    if (!allowedTypes.includes(file.type)) {
      this.notyf.error('Format file harus JPEG, PNG, atau JPG');
      return false;
    }

    return true;
  }

  onSubmitPayment(): void {
    if (!this.paymentForm || this.paymentForm.invalid || this.isSubmitting) {
      if (this.isSubmitting) {
        this.notyf.error('Proses sedang berlangsung, harap tunggu...');
      } else {
        this.paymentForm?.markAllAsTouched();
        this.notyf.error('Harap lengkapi semua field yang wajib diisi');
      }
      return;
    }

    const formValues = this.paymentForm.value;
    this.isSubmitting = true;
    this.submitManualPayment(formValues);
  }

  private submitManualPayment(formValues: any): void {
    // Check maksimal 2 rekening limit
    if (this.paymentDetails.length >= 2) {
      this.notyf.error('Maksimal hanya boleh memiliki 2 rekening');
      this.isSubmitting = false;
      return;
    }

    // Validate bank code exists
    if (!this.validateBankCode(formValues.kode_bank)) {
      this.notyf.error('Kode bank tidak valid');
      this.isSubmitting = false;
      return;
    }

    // Use FormData for file upload support as per API contract
    const formData = new FormData();

    // Append required fields according to API contract
    formData.append('kode_bank', formValues.kode_bank);
    formData.append('nomor_rekening', formValues.nomor_rekening);
    formData.append('nama_pemilik', formValues.nama_pemilik);

    // Add optional photo file
    if (this.selectedPhotoFile) {
      formData.append('photo_rek', this.selectedPhotoFile);
    }

    // Call admin endpoint as per API contract
    this.dashboardSvc.httpSvc.post(`${this.adminRekeningBaseUrl}/send-rekening`, formData).subscribe({
      next: (response: any) => {
        console.log('Create rekening response:', response);
        this.notyf.success(response?.message || 'Rekening berhasil ditambahkan');
        this.loadPaymentDetails();
        this.loadActivePaymentStatus();
        this.resetForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.handleRekeningApiError(err);
        this.isSubmitting = false;
      }
    });
  }

  private resetForm(): void {
    if (this.paymentForm) {
      this.paymentForm.reset();
      this.initializeForm();
    }
    this.selectedPhotoFile = null;
    this.selectedEditPhotoFile = null;
  }

  private handleApiError(err: any): void {
    console.error('API Error:', err);

    if (err?.error?.errors) {
      Object.values(err.error.errors).forEach((messages: any) => {
        if (Array.isArray(messages)) {
          messages.forEach(message => this.notyf.error(message));
        }
      });
    } else if (err?.error?.message) {
      this.notyf.error(err.error.message);
    } else {
      this.notyf.error('Terjadi kesalahan pada sistem');
    }
  }

  private handleRekeningApiError(err: any): void {
    console.error('Rekening API Error:', err);

    // Handle specific rekening API errors according to contract
    if (err.status === 422) {
      // Validation errors
      if (err.error?.errors) {
        Object.values(err.error.errors).forEach((messages: any) => {
          if (Array.isArray(messages)) {
            messages.forEach((message: string) => this.notyf.error(message));
          }
        });
      } else if (err.error?.message) {
        this.notyf.error(err.error.message);
      }
    } else if (err.status === 404) {
      this.notyf.error('Rekening tidak ditemukan');
    } else if (err.status === 401) {
      this.notyf.error('Tidak memiliki akses');
    } else if (err.status === 500) {
      this.notyf.error('Terjadi kesalahan server');
    } else if (err.error?.message) {
      this.notyf.error(err.error.message);
    } else {
      this.notyf.error('Terjadi kesalahan pada sistem');
    }
  }

  // Table display methods
  getTableColumns(): string[] {
    return ['noRekening', 'namaBank', 'namaPemilik', 'metodePembayaran'];
  }

  getColumnHeader(column: string): string {
    const headers: { [key: string]: string } = {
      pengguna: 'Pengguna',
      email: 'Email',
      noRekening: 'No Rekening',
      namaBank: 'Bank',
      namaPemilik: 'Nama Pemilik',
      urlTripay: 'URL Tripay',
      apiKey: 'API Key',
      kodeMerchant: 'Kode Merchant',
      url: 'URL',
      serverKey: 'Server Key',
      clientKey: 'Client Key',
      metodePembayaran: 'Metode Pembayaran',
      trialInfo: 'Trial Info'
    };
    return headers[column] || column;
  }

  getBankName(kodeBank: string): string {
    const bank = this.bankList.find(b => b.kode_bank === kodeBank);
    return bank?.name || 'Bank tidak ditemukan';
  }

  // Utility methods
  getFieldError(fieldName: string): string | null {
    if (!this.paymentForm) return null;

    const field = this.paymentForm.get(fieldName);
    if (field?.touched && field?.errors) {
      if (field.errors['required']) return `${this.getFieldDisplayName(fieldName)} wajib diisi`;
      if (field.errors['minlength']) return `${this.getFieldDisplayName(fieldName)} minimal 2 karakter`;
      if (field.errors['email']) return `Format email tidak valid`;
    }
    return null;
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'kode_bank': 'Bank',
      'nomor_rekening': 'Nomor Rekening',
      'nama_pemilik': 'Nama Pemilik',
      'url_tripay': 'URL Tripay',
      'private_key': 'Private Key',
      'api_key': 'API Key',
      'kode_merchant': 'Kode Merchant',
      'url': 'URL',
      'server_key': 'Server Key',
      'client_key': 'Client Key',
      'metode_production': 'Mode Production'
    };
    return fieldNames[fieldName] || fieldName;
  }

  isFormValid(): boolean {
    return this.paymentForm ? this.paymentForm.valid : false;
  }

  hasPaymentDetails(): boolean {
    return this.paymentDetails.length > 0;
  }

  // Helper method for displaying values in table (show '-' for empty values)
  getDisplayValue(value: string | undefined | null): string {
    return value && value.trim() !== '' ? value : '-';
  }

  // Helper method to get selected file name for display
  getSelectedFileName(): string {
    if (this.selectedPhotoFile) {
      return this.selectedPhotoFile.name;
    }
    return 'No file chosen';
  }

  // Helper method to get field error for form validation
  getFormFieldError(fieldName: string): string | null {
    if (!this.paymentForm) return null;

    const field = this.paymentForm.get(fieldName);
    if (field?.touched && field?.errors) {
      if (field.errors['required']) return `${fieldName} wajib diisi`;
      if (field.errors['minlength']) return `${fieldName} minimal 2 karakter`;
    }
    return null;
  }

  // Modal Methods
  openEditModal(detail: PaymentMethodDetail): void {
    console.log('Opening edit modal with detail:', detail); // Debug logging

    this.currentEditItem = detail;
    this.initializeEditForm(detail);

    // Show modal using Bootstrap
    const modalElement = document.getElementById('editPaymentModal');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  openDeleteModal(detail: PaymentMethodDetail): void {
    this.currentEditItem = detail;

    // Show modal using Bootstrap
    const modalElement = document.getElementById('deletePaymentModal');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  private initializeEditForm(detail: PaymentMethodDetail): void {
    console.log('Initializing edit form with detail:', detail); // Debug logging
    this.editPaymentForm = this.fb.group({
      kode_bank: [detail.kodeBank || '', Validators.required],
      nomor_rekening: [detail.noRekening || '', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      nama_pemilik: [detail.namaPemilik || '', [Validators.required, Validators.minLength(2)]]
    });

    console.log('Edit form created:', this.editPaymentForm.value); // Debug logging
  }

  onEditFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (!this.validateFile(file)) {
        return;
      }

      this.selectedEditPhotoFile = file;
    }
  }

  onSubmitEditPayment(): void {
    if (!this.editPaymentForm || this.editPaymentForm.invalid) {
      this.editPaymentForm?.markAllAsTouched();
      this.notyf.error('Harap lengkapi semua field yang wajib diisi');
      return;
    }

    const formValues = this.editPaymentForm.value;
    console.log('Form values being sent:', formValues); // Debug logging
    this.isSubmitting = true;
    this.updateManualPayment(formValues);
  }

  private updateManualPayment(formValues: any): void {
    // Validate bank code exists
    if (!this.validateBankCode(formValues.kode_bank)) {
      this.notyf.error('Kode bank tidak valid');
      this.isSubmitting = false;
      return;
    }

    // Use FormData for file upload support as per API contract
    const formData = new FormData();

    // Add Laravel method spoofing for PUT request with FormData
    formData.append('_method', 'PUT');

    // Append required fields according to API contract
    formData.append('kode_bank', formValues.kode_bank);
    formData.append('nomor_rekening', formValues.nomor_rekening);
    formData.append('nama_pemilik', formValues.nama_pemilik);

    // Add optional photo file if selected
    if (this.selectedEditPhotoFile) {
      formData.append('photo_rek', this.selectedEditPhotoFile);
    }

    const itemId = this.currentEditItem!.id;

    // Use POST with method spoofing for FormData compatibility with Laravel
    this.dashboardSvc.httpSvc.post(`${this.adminRekeningBaseUrl}/update-rekening/${itemId}`, formData).subscribe({
      next: (response: any) => {
        console.log('Update rekening response:', response);
        this.notyf.success(response?.message || 'Rekening berhasil diperbarui');
        this.loadPaymentDetails();
        this.loadActivePaymentStatus();
        this.closeEditModal();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.handleRekeningApiError(err);
        this.isSubmitting = false;
      }
    });
  }

  onConfirmDelete(): void {
    if (!this.currentEditItem) {
      return;
    }

    this.isSubmitting = true;
    this.deleteManualPayment();
  }

  private deleteManualPayment(): void {
    const itemId = this.currentEditItem!.id;

    // Call admin delete endpoint as per API contract
    this.dashboardSvc.httpSvc.delete(`${this.adminRekeningBaseUrl}/delete-rekening/${itemId}`).subscribe({
      next: (response: any) => {
        console.log('Delete rekening response:', response);
        this.notyf.success(response?.message || 'Rekening berhasil dihapus');
        this.loadPaymentDetails();
        this.loadActivePaymentStatus();
        this.closeDeleteModal();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.handleRekeningApiError(err);
        this.isSubmitting = false;
      }
    });
  }

  openUseMidtransModal(): void {
    const modalElement = document.getElementById('useMidtransModal');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  confirmUseMidtrans(): void {
    if (!this.paymentDetails.length || this.isSubmitting) {
      this.closeUseMidtransModal();
      this.loadActivePaymentStatus();
      return;
    }

    this.isSubmitting = true;
    const requests = this.paymentDetails
      .filter((item) => item.id != null)
      .map((item) => this.dashboardSvc.httpSvc.delete(`${this.adminRekeningBaseUrl}/delete-rekening/${item.id}`));

    forkJoin(requests).subscribe({
      next: () => {
        this.notyf.success('Pembayaran manual dinonaktifkan. User akan menggunakan Midtrans.');
        this.paymentDetails = [];
        this.resetForm();
        this.loadPaymentDetails();
        this.loadActivePaymentStatus();
        this.closeUseMidtransModal();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.handleRekeningApiError(err);
        this.isSubmitting = false;
      }
    });
  }

  private closeEditModal(): void {
    const modalElement = document.getElementById('editPaymentModal');
    if (modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
    this.currentEditItem = null;
    this.selectedEditPhotoFile = null;
  }

  private closeDeleteModal(): void {
    const modalElement = document.getElementById('deletePaymentModal');
    if (modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
    this.currentEditItem = null;
  }

  private closeUseMidtransModal(): void {
    const modalElement = document.getElementById('useMidtransModal');
    if (modalElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
  }
}
