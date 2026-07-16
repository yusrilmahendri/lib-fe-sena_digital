import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges, OnChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { ModalComponent } from 'src/app/shared/modal/modal.component';

@Component({
  selector: 'wc-data-registrasi',
  templateUrl: './data-registrasi.component.html',
  styleUrls: ['./data-registrasi.component.scss']
})
export class DataRegistrasiComponent implements OnInit {

  @Input() formData: any = {};
  @Output() next = new EventEmitter<any>();
  @Output() prev = new EventEmitter<void>();

  formRegis!: FormGroup;
  private notyf: Notyf;
  modalRef?: BsModalRef;
  paketOptions: any;
  selectedPrice: string = '';

  constructor(
    private fb: FormBuilder,
    private modalSvc: BsModalService,
    private dashboardSvc: DashboardService,
    private router: Router

  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: {
        x: 'right',
        y: 'top'
      }
    });
  }

  ngOnInit(): void {
    this.initMasterDataPaket();

    this.formRegis = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      paket_undangan_id: ['', Validators.required],
      price: [this.selectedPrice],
      domain: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      kode_pemesanan: [null],
    });

    if (this.formData && Object.keys(this.formData).length > 0) {
      this.formRegis.patchValue(this.formData.formData);
      this.persistWithoutPassword('formData', this.formData);
    }
    const savedFormData = localStorage.getItem('formRegis');
    if (savedFormData) {
      const parsedFormData = JSON.parse(savedFormData);
      this.formRegis.patchValue(parsedFormData);
      // Migrate drafts written by older versions without retaining password.
      this.persistWithoutPassword('formRegis', parsedFormData);
    }
    this.formRegis.valueChanges.subscribe((value) => {
      this.persistWithoutPassword('formRegis', value);
    });
    const savedData = localStorage.getItem('formData');

    if (savedData) {
      this.formData = JSON.parse(savedData);
      this.formRegis.patchValue(this.formData.formData);
      this.formRegis.patchValue({
        kode_pemesanan: JSON.parse(savedData).response.user.kode_pemesanan,
      });
    }

  }


  initMasterDataPaket(): void {
    this.dashboardSvc.list(DashboardServiceType.MNL_MD_PACK_INVITATION).subscribe({
      next: (res) => {
        this.paketOptions = res.data;
      },
    });
  }

  onPaketSelect(event: any): void {
    const selectedPaket = this.paketOptions.find((paket: any) => paket.id === event);
    if (selectedPaket) {
      this.selectedPrice = selectedPaket.price || '';
    } else {
      this.selectedPrice = '';
    }
    this.formRegis.patchValue({
      price: this.selectedPrice
    });
  }

  submit(): void {
    if (this.formRegis.valid) {
      const initialState = {
        message: 'Apakah anda ingin menyimpan data registrasi?',
        cancelClicked: () => this.handleCancelClicked(),
        submitClicked: () => this.saveRegistration(),
        submitMessage: 'Simpan',
      };
      this.modalRef = this.modalSvc.show(ModalComponent, { initialState });
      if (this.modalRef?.content) {
        this.modalRef.content.onClose.subscribe((res: any) => {
          if (res?.state === 'delete') {
            console.log('Delete action triggered');
          } else if (res?.state === 'cancel') {
            console.log('Action canceled');
          }
          this.modalRef?.hide();
        });
      }
    } else {
      this.formRegis.markAllAsTouched();
    }
  }

  saveRegistration(): void {
    const payload = new FormData();
    Object.keys(this.formRegis.value).forEach((key) => {
      payload.append(key, this.formRegis.get(key)?.value);
    });
    this.persistWithoutPassword('formData', this.formData);

    this.dashboardSvc.create(DashboardServiceType.MNL_STEP_ONE, payload).subscribe({
      next: (res) => {
        this.modalRef?.hide();
        localStorage.setItem('access_token', res.token);
        this.next.emit({ response: res, formData: this.formRegis.value, step: 2 });
        this.formRegis.patchValue(this.formData);
        this.notyf.success(res?.message || 'Data berhasil disimpan.');
      },
      error: (err) => {
        this.notyf.error(this.getBackendErrorMessage(err));
      }
    })
  }


  handleCancelClicked(): void {
    this.modalRef?.hide();
  }

  onCancel(){
    this.router.navigate(['/']);
  }

  private persistWithoutPassword(key: string, value: any): void {
    const persisted = JSON.parse(JSON.stringify(value || {}));
    delete persisted.password;
    if (persisted?.formData?.password) {
      delete persisted.formData.password;
    }
    localStorage.setItem(key, JSON.stringify(persisted));
  }

  getNameErrorMessage(): string {
    const control = this.formRegis?.get('name');
    if (!control?.touched || !control.errors) return '';
    if (control.errors['required']) return 'Nama pengguna wajib diisi.';
    if (control.errors['minlength']) return 'Nama pengguna minimal 3 karakter.';
    if (control.errors['maxlength']) return 'Nama pengguna maksimal 100 karakter.';
    return '';
  }

  private getBackendErrorMessage(error: any): string {
    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const firstValue = firstKey ? errors[firstKey] : null;
      const message = Array.isArray(firstValue) ? firstValue[0] : firstValue;
      if (message) return this.translateBackendMessage(String(message), firstKey);
    }

    return this.translateBackendMessage(error?.error?.message || error?.message || 'Ada kesalahan dalam sistem.');
  }

  private translateBackendMessage(message: string, field?: string): string {
    const lower = message.toLowerCase();
    if (field === 'name' || lower.includes('name')) {
      if (lower.includes('required') || lower.includes('wajib')) return 'Nama pengguna wajib diisi.';
      if (lower.includes('at least') || lower.includes('min') || lower.includes('minimal')) return 'Nama pengguna minimal 3 karakter.';
      if (lower.includes('greater than') || lower.includes('max') || lower.includes('maksimal')) return 'Nama pengguna maksimal 100 karakter.';
    }
    if (lower.includes('email') && (lower.includes('taken') || lower.includes('already'))) return 'Email sudah terdaftar.';
    return message || 'Ada kesalahan dalam sistem.';
  }

}
