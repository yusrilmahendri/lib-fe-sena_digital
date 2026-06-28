import { Component, HostListener, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Notyf } from 'notyf';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { DashboardService, DashboardServiceType } from '../../../dashboard.service';
import { BankAccount } from '../../../services/wedding-data.service';
import { ModalComponent } from '../../../shared/modal/modal.component';

interface Bank {
  id: number;
  kode_bank: string;
  name: string;
  logo?: string;
}

interface BankAccountFormData {
  id?: number;
  kode_bank: any;
  nomor_rekening: any;
  nama_pemilik: any;
  photo_rek?: File | string | null;
  editMode?: boolean;
}

@Component({
  selector: 'wc-rekening',
  templateUrl: './rekening.component.html',
  styleUrls: ['./rekening.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class RekeningComponent implements OnInit, OnDestroy {
  rekeningForm!: FormGroup;
  listBank: Bank[] = [];
  bankAccounts: BankAccount[] = [];
  private notyf: Notyf;
  private modalRef?: BsModalRef;
  private objectUrls: string[] = []; // Track created object URLs for cleanup
  maxRekening = 2;
  isLoading = false;
  isSubmitting = false;  // Modal state
  pendingDeleteAccountId: number | null = null;
  pendingDeleteIndex: number | null = null;

  constructor(
    private fb: FormBuilder,
    private dashboardSvc: DashboardService,
    private modalService: BsModalService,
    private sanitizer: DomSanitizer
  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });
  }

  ngOnInit() {
    this.initializeForm();
    this.loadBankList();
    this.loadBankAccounts();
  }

  private initializeForm(): void {
    this.rekeningForm = this.fb.group({
      accounts: this.fb.array([])
    });
  }

  get accounts(): FormArray {
    return this.rekeningForm.get('accounts') as FormArray;
  }

  private createAccountFormGroup(data?: BankAccount): FormGroup {
    return this.fb.group({
      id: [data?.id || null],
      kode_bank: [data?.kode_bank || '', Validators.required],
      nomor_rekening: [data?.nomor_rekening || '', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      nama_pemilik: [data?.nama_pemilik || '', [Validators.required, Validators.minLength(2)]],
      photo_rek: [data?.photo_rek || null],
      editMode: [false]
    });
  }

  private loadBankList(): void {
    this.dashboardSvc.list(DashboardServiceType.MD_LIST_BANK).subscribe({
      next: (res) => {
        this.listBank = res?.data || [];
      },
      error: (err) => {
        console.error('Error loading bank list:', err);
        this.notyf.error('Gagal memuat daftar bank');
      }
    });
  }

  private loadBankAccounts(): void {
    this.isLoading = true;
    this.dashboardSvc.list(DashboardServiceType.REKENINGS_INDEX).subscribe({
      next: (res) => {
        this.bankAccounts = res?.data || [];
        this.populateFormWithAccounts();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading bank accounts:', err);
        this.notyf.error('Gagal memuat data rekening');
        this.isLoading = false;
      }
    });
  }

  private populateFormWithAccounts(): void {
    this.accounts.clear();

    // Add existing accounts
    this.bankAccounts.forEach(account => {
      this.accounts.push(this.createAccountFormGroup(account));
    });

    // Add empty form if less than max and no accounts exist
    if (this.accounts.length === 0) {
      this.addNewAccountForm();
    }
  }

  canAddNewAccount(): boolean {
    return this.accounts.length < this.maxRekening && !this.hasEmptyAccount() && !this.isAnyAccountInEditMode();
  }

  private hasEmptyAccount(): boolean {
    return this.accounts.controls.some(control => {
      const account = control.value;
      return !account.id && (!account.kode_bank || !account.nomor_rekening || !account.nama_pemilik);
    });
  }

  private isAnyAccountInEditMode(): boolean {
    return this.accounts.controls.some(control => control.get('editMode')?.value);
  }

  addNewAccountForm(): void {
    if (this.canAddNewAccount()) {
      this.accounts.push(this.createAccountFormGroup());
    }
  }

  removeAccountForm(index: number): void {
    const account = this.accounts.at(index).value;
    if (!account.id) {
      this.accounts.removeAt(index);
    }
  }

  onBankSelect(index: number, bankCode: any): void {
    const account = this.accounts.at(index);
    account.get('kode_bank')?.setValue(this.normalizeKodeBank(bankCode));
  }

  onFileSelect(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validate file
      if (!this.validateFile(file)) {
        // Reset file input if validation fails
        input.value = '';
        return;
      }

      const account = this.accounts.at(index);
      account.get('photo_rek')?.setValue(file);

      // Update file info display
      const fileInfo = input.parentElement?.querySelector('.file-info');
      if (fileInfo) {
        fileInfo.textContent = file.name;
      }
    } else {
      // Clear file if no file selected
      const account = this.accounts.at(index);
      account.get('photo_rek')?.setValue(null);

      const fileInfo = input.parentElement?.querySelector('.file-info');
      if (fileInfo) {
        fileInfo.textContent = 'No file chosen';
      }
    }
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

  getPhotoUrl(file: any): SafeUrl | string {
    if (file instanceof File) {
      const objectUrl = URL.createObjectURL(file);
      this.objectUrls.push(objectUrl); // Track for cleanup
      return this.sanitizer.bypassSecurityTrustUrl(objectUrl);
    }
    return file || '';
  }

  getBankName(kodeBank: string): string {
    const bank = this.listBank.find(b => b.kode_bank === kodeBank);
    return bank?.name || 'Bank tidak ditemukan';
  }

  getFileName(file: any): string {
    if (file instanceof File) {
      return file.name;
    }
    if (typeof file === 'string' && file) {
      // Extract filename from URL if it's a string URL
      return file.split('/').pop() || 'Existing file';
    }
    return 'No file chosen';
  }

  removePhoto(index: number): void {
    const account = this.accounts.at(index);
    account.get('photo_rek')?.setValue(null);

    // Clear file input
    const fileInput = document.getElementById(`photoRek${index}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // CRUD Operations
  onSubmit(): void {
    if (this.bankAccounts.length >= this.maxRekening) {
      this.notyf.error(`Anda sudah memiliki ${this.maxRekening} rekening. Silakan edit atau hapus rekening yang ada.`);
      return;
    }

    const newAccounts = this.getNewAccounts();
    if (newAccounts.length === 0) {
      this.notyf.error('Tidak ada rekening baru untuk disimpan');
      return;
    }

    if (!this.validateNewAccounts(newAccounts)) {
      return;
    }

    this.createBankAccounts(newAccounts);
  }

  private getNewAccounts(): BankAccountFormData[] {
    return this.accounts.controls
      .map(control => control.value)
      .filter((account: BankAccountFormData) => !account.id);
  }

  private validateNewAccounts(accounts: BankAccountFormData[]): boolean {
    for (let i = 0; i < accounts.length; i++) {
      const account = this.normalizeAccountPayload(accounts[i]);
      if (!account.kode_bank || !account.nomor_rekening || !account.nama_pemilik) {
        this.notyf.error(`Semua field wajib diisi untuk rekening #${i + 1}`);
        return false;
      }
    }
    return true;
  }

  private buildCreatePayload(account: BankAccountFormData): FormData {
    const normalized = this.normalizeAccountPayload(account);
    const formData = new FormData();

    formData.append('kode_bank', normalized.kode_bank);
    formData.append('nomor_rekening', normalized.nomor_rekening);
    formData.append('nama_pemilik', normalized.nama_pemilik);

    if (account.photo_rek instanceof File) {
      formData.append('foto_rekening', account.photo_rek);
    }

    return formData;
  }

  private createBankAccounts(accounts: BankAccountFormData[]): void {
    if (!accounts.length) {
      this.notyf.error('Tidak ada rekening baru untuk disimpan');
      return;
    }

    this.isSubmitting = true;
    this.submitBankAccountAtIndex(accounts, 0);
  }

  private submitBankAccountAtIndex(accounts: BankAccountFormData[], index: number): void {
    if (index >= accounts.length) {
      this.notyf.success('Rekening berhasil ditambahkan');
      this.loadBankAccounts();
      this.isSubmitting = false;
      return;
    }

    const payload = this.buildCreatePayload(accounts[index]);
    payload.forEach((value, key) => {
      console.log(key, value, typeof value);
    });

    this.dashboardSvc.uploadFile(DashboardServiceType.REKENINGS_STORE, payload).subscribe({
      next: () => {
        this.submitBankAccountAtIndex(accounts, index + 1);
      },
      error: (err) => {
        this.handleApiError(err);
        this.isSubmitting = false;
      }
    });
  }

  onEdit(index: number): void {
    this.accounts.at(index).get('editMode')?.setValue(true);
  }

  onCancelEdit(index: number): void {
    const originalAccount = this.bankAccounts[index];
    if (originalAccount) {
      this.accounts.at(index).patchValue({
        kode_bank: originalAccount.kode_bank,
        nomor_rekening: originalAccount.nomor_rekening,
        nama_pemilik: originalAccount.nama_pemilik,
        photo_rek: originalAccount.photo_rek,
        editMode: false
      });
    }
  }

  onUpdate(index: number): void {
    const accountForm = this.accounts.at(index);
    if (accountForm.invalid) {
      this.markFormGroupTouched(accountForm as FormGroup);
      this.notyf.error('Harap lengkapi semua field yang wajib diisi');
      return;
    }

    const accountData = accountForm.value;
    const normalized = this.normalizeAccountPayload(accountData);
    const accountId = accountData?.id;

    if (!accountId) {
      this.notyf.error('ID rekening tidak ditemukan.');
      return;
    }

    if (!normalized.kode_bank || !normalized.nomor_rekening || !normalized.nama_pemilik) {
      this.notyf.error('Harap lengkapi semua field yang wajib diisi');
      return;
    }

    this.isSubmitting = true;
    this.dashboardSvc.updateRekening(accountId, {
      kode_bank: normalized.kode_bank,
      nomor_rekening: normalized.nomor_rekening,
      nama_pemilik: normalized.nama_pemilik,
      photo_rek: accountData.photo_rek
    }).subscribe({
      next: (res: any) => {
        this.notyf.success(res?.message || 'Rekening berhasil diperbarui');
        accountForm.get('editMode')?.setValue(false);
        this.loadBankAccounts();
        this.isSubmitting = false;
      },
      error: (err: any) => {
        this.handleApiError(err);
        this.isSubmitting = false;
      }
    });
  }

  onDelete(index: number): void {
    const accountId = this.accounts.at(index).get('id')?.value;
    if (!accountId) {
      this.notyf.error('ID rekening tidak ditemukan');
      return;
    }

    // Store the pending delete info
    this.pendingDeleteAccountId = accountId;
    this.pendingDeleteIndex = index;

    // Show modal confirmation
    this.showDeleteConfirmationModal();
  }

  showDeleteConfirmationModal(): void {
    const modalData = {
      message: 'Apakah Anda yakin ingin menghapus rekening ini?'
    };

    this.modalRef = this.modalService.show(ModalComponent, {
      initialState: {
        message: modalData.message,
        submitMessage: 'Hapus',
        submitClicked: (data: any) => this.confirmDeleteBankAccount(),
        cancelClicked: () => this.cancelDeleteBankAccount()
      }
    });
  }

  confirmDeleteBankAccount(): void {
    if (this.pendingDeleteAccountId) {
      this.deleteBankAccount(this.pendingDeleteAccountId);
    }
    this.clearPendingDelete();
    this.modalRef?.hide();
  }

  cancelDeleteBankAccount(): void {
    this.clearPendingDelete();
    this.modalRef?.hide();
  }

  private clearPendingDelete(): void {
    this.pendingDeleteAccountId = null;
    this.pendingDeleteIndex = null;
  }

  private deleteBankAccount(accountId: number): void {
    this.isSubmitting = true;
    this.dashboardSvc.deleteV2(DashboardServiceType.REKENINGS_DELETE_JSON, accountId).subscribe({
      next: (res) => {
        this.notyf.success(res?.message || 'Rekening berhasil dihapus');
        this.loadBankAccounts();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.handleApiError(err);
        this.isSubmitting = false;
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private handleApiError(err: any): void {
    console.error('API Error:', err);

    if (err?.error?.errors) {
      // Handle validation errors
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

  // Utility methods
  isFormValid(index: number): boolean {
    return this.accounts.at(index).valid;
  }

  getFieldError(index: number, fieldName: string): string | null {
    const field = this.accounts.at(index).get(fieldName);
    if (field?.touched && field?.errors) {
      if (field.errors['required']) return `${fieldName} wajib diisi`;
      if (field.errors['pattern']) return `${fieldName} harus berupa angka`;
      if (field.errors['minlength']) return `${fieldName} minimal 2 karakter`;
    }
    return null;
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.rekeningForm.dirty) {
      $event.returnValue = 'Anda memiliki perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
    }
  }

  ngOnDestroy(): void {
    // Cleanup object URLs to prevent memory leaks
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  private normalizeKodeBank(value: any): string {
    if (!value) return '';

    if (typeof value === 'string') return value;

    if (typeof value === 'number') return String(value);

    if (typeof value === 'object') {
      return String(
        value.kode_bank ||
        value.kode ||
        value.value ||
        value.id ||
        value.nama_bank ||
        value.label ||
        value.name ||
        ''
      );
    }

    return String(value);
  }

  private normalizeAccountPayload(account: BankAccountFormData): BankAccountFormData {
    return {
      ...account,
      kode_bank: this.normalizeKodeBank(account?.kode_bank),
      nomor_rekening: String(account?.nomor_rekening || '').trim(),
      nama_pemilik: String(account?.nama_pemilik || '').trim(),
    };
  }
}
