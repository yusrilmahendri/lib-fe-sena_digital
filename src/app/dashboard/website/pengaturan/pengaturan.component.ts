import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { ModalComponent } from 'src/app/shared/modal/modal.component';
import {
  DEFAULT_SALAM_ATAS,
  DEFAULT_SALAM_BAWAH,
  DEFAULT_SALAM_PEMBUKA,
  normalizeSalamValue,
} from 'src/app/shared/salam-defaults';

@Component({
  selector: 'wc-pengaturan',
  templateUrl: './pengaturan.component.html',
  styleUrls: ['./pengaturan.component.scss'],
})
export class PengaturanComponent implements OnInit {
  readonly DEFAULT_SALAM_PEMBUKA = DEFAULT_SALAM_PEMBUKA;
  readonly DEFAULT_SALAM_ATAS = DEFAULT_SALAM_ATAS;
  readonly DEFAULT_SALAM_BAWAH = DEFAULT_SALAM_BAWAH;

  domainTokenForm!: FormGroup;
  salamForm!: FormGroup;
  filterForm!: FormGroup;


  isInitialLoading = false;
  isLoadingDomain = false;
  isLoadingSalam = false;
  isLoadingFilter = false;


  private modalRef?: BsModalRef;
  private notyf: Notyf;


  dataFilter: any;
  settingData: any;
  filterData: any;
  isFilterExisting = false;

  constructor(
    private fb: FormBuilder,
    private dashboardSvc: DashboardService,
    private modalSvc: BsModalService
  ) {
    this.initializeForms();
    this.notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  private initializeForms(): void {

    this.domainTokenForm = this.fb.group({
      domain: ['', [Validators.required]],
      token: ['']
    });

    this.salamForm = this.fb.group({
      salam_pembuka: [DEFAULT_SALAM_PEMBUKA, [Validators.required]],
      salam_atas: [DEFAULT_SALAM_ATAS, [Validators.required]],
      salam_bawah: [DEFAULT_SALAM_BAWAH, [Validators.required]]
    });


    this.filterForm = this.fb.group({
      halaman_sampul: [false],
      halaman_mempelai: [false],
      halaman_acara: [false],
      halaman_ucapan: [false],
      halaman_galery: [false],
      halaman_cerita: [false],
      halaman_lokasi: [false],
      halaman_prokes: [false],
      halaman_send_gift: [false],
      halaman_qoute: [false]
    });
  }

  private loadInitialData(): void {
    this.isInitialLoading = true;

    this.dashboardSvc.list(DashboardServiceType.SETTINGS_GET_FILTER).subscribe({
      next: (res) => {
        this.dataFilter = res?.['data'];
        this.settingData = res?.['setting'];
        this.filterData = res?.['filter_undangan'];

        this.populateFormsWithData();
        this.isInitialLoading = false;
      },
      error: (err) => {

        this.notyf.error('Gagal memuat data pengaturan');
        this.isInitialLoading = false;
      }
    });
  }

  private populateFormsWithData(): void {
    if (this.settingData) {
      this.domainTokenForm.patchValue({
        domain: this.settingData.domain || '',
        token: this.settingData.token || ''
      });
      this.salamForm.patchValue({
        salam_pembuka: this.normalizeSalamValue(
          this.settingData.salam_pembuka,
          this.DEFAULT_SALAM_PEMBUKA
        ),
        salam_atas: this.normalizeSalamValue(
          this.settingData.salam_atas,
          this.DEFAULT_SALAM_ATAS
        ),
        salam_bawah: this.normalizeSalamValue(
          this.settingData.salam_bawah,
          this.DEFAULT_SALAM_BAWAH
        ),
      });
    }
    // Patch filterForm with boolean values from backend (0/1 or '0'/'1')
    if (this.filterData) {
      this.isFilterExisting = true;
      const patchObj: any = {};
      Object.keys(this.filterForm.controls).forEach(key => {
        patchObj[key] = this.stringToBoolean(this.filterData[key]);
      });
      this.filterForm.patchValue(patchObj);
    }
  }

  private stringToBoolean(value: string | number | null | undefined): boolean {
    return value === '1' || value === 1 || value === 'true';
  }


  saveDomainToken(): void {
    if (!this.domainTokenForm.valid) {
      this.notyf.error('Mohon lengkapi form dengan benar');
      return;
    }

    const formData = new FormData();
    const formValue = this.domainTokenForm.value;

    formData.append('domain', formValue.domain || '');
    formData.append('token', formValue.token || '');

    const initialState = {
      message: 'Apakah anda ingin menyimpan semua data domain dan token?',
      cancelClicked: () => this.modalRef?.hide(),
      submitClicked: () => this.submitDomainToken(formData),
      submitMessage: 'Simpan',
    };

    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });
  }

  private submitDomainToken(formData: FormData): void {
    this.isLoadingDomain = true;

    this.dashboardSvc.create(DashboardServiceType.USER_SETTINGS_SUBMIT_DOMAIN, formData).subscribe({
      next: (res) => {
        this.notyf.success(res?.message || 'Data domain dan token berhasil disimpan');
        this.modalRef?.hide();
        this.isLoadingDomain = false;
      },
      error: (err) => {
        this.notyf.error(err?.error?.message || 'Gagal menyimpan data domain dan token');

        this.isLoadingDomain = false;
      }
    });
  }

  private normalizeSalamValue(value: unknown, fallback: string): string {
    return normalizeSalamValue(value, fallback);
  }

  saveSalam(): void {
    if (!this.salamForm.valid) {
      this.notyf.error('Mohon lengkapi semua field salam');
      return;
    }

    const formData = new FormData();
    const formValue = this.salamForm.value;
    const payload = {
      salam_pembuka: this.normalizeSalamValue(formValue.salam_pembuka, this.DEFAULT_SALAM_PEMBUKA),
      salam_atas: this.normalizeSalamValue(formValue.salam_atas, this.DEFAULT_SALAM_ATAS),
      salam_bawah: this.normalizeSalamValue(formValue.salam_bawah, this.DEFAULT_SALAM_BAWAH),
    };

    formData.append('salam_pembuka', payload.salam_pembuka);
    formData.append('salam_atas', payload.salam_atas);
    formData.append('salam_bawah', payload.salam_bawah);

    const initialState = {
      message: 'Apakah anda ingin menyimpan semua data salam?',
      cancelClicked: () => this.modalRef?.hide(),
      submitClicked: () => this.submitSalam(formData),
      submitMessage: 'Simpan',
    };

    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });
  }

  private submitSalam(formData: FormData): void {
    this.isLoadingSalam = true;

    this.dashboardSvc.create(DashboardServiceType.USER_SETTINGS_SUBMIT_SALAM, formData).subscribe({
      next: (res) => {
        this.notyf.success(res?.message || 'Data salam berhasil disimpan');
        this.modalRef?.hide();
        this.isLoadingSalam = false;
      },
      error: (err) => {
        this.notyf.error(err?.error?.message || 'Gagal menyimpan data salam');

        this.isLoadingSalam = false;
      }
    });
  }

  saveFilter(): void {
    const formValue = this.filterForm.value;
    // Kirim 0/1 ke backend
    const filterData: any = {};
    Object.keys(formValue).forEach(key => {
      filterData[key] = formValue[key] ? 1 : 0;
    });
    const initialState = {
      message: 'Apakah anda ingin menyimpan pengaturan filter undangan?',
      cancelClicked: () => this.modalRef?.hide(),
      submitClicked: () => this.submitFilter(filterData),
      submitMessage: 'Simpan',
    };
    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });
  }

  private submitFilter(filterData: any): void {
    this.isLoadingFilter = true;
    const endpoint = this.isFilterExisting ?
      (DashboardServiceType.USER_SETTINGS_SUBMIT_FILTER_UPDATE) :
      (DashboardServiceType.USER_SETTINGS_SUBMIT_FILTER);
    const method = this.isFilterExisting ? 'update' : 'create';
    this.dashboardSvc[method](endpoint, '', filterData).subscribe({
      next: (res) => {
        this.notyf.success(res?.message || 'Pengaturan filter berhasil disimpan');
        this.modalRef?.hide();
        this.isLoadingFilter = false;
        this.isFilterExisting = true;
        // Refresh data dari backend agar toggle sesuai value terbaru
        this.loadInitialData();
      },
      error: (err) => {
        this.notyf.error(err?.error?.message || 'Gagal menyimpan pengaturan filter');
        this.isLoadingFilter = false;
      }
    });
  }

}
