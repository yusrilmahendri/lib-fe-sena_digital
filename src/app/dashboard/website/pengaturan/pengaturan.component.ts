import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { ModalComponent } from 'src/app/shared/modal/modal.component';
import {
  DEFAULT_SALAM_ATAS,
  DEFAULT_SALAM_BAWAH,
  DEFAULT_SALAM_PEMBUKA,
  normalizeSalamValue,
} from 'src/app/shared/salam-defaults';
import {
  getReligionContentFromData,
  getResolvedReligionValue,
  ReligionContentLike,
} from 'src/app/shared/religion-content.util';

@Component({
  selector: 'wc-pengaturan',
  templateUrl: './pengaturan.component.html',
  styleUrls: ['./pengaturan.component.scss'],
})
export class PengaturanComponent implements OnInit, OnDestroy {
  readonly DEFAULT_SALAM_PEMBUKA = DEFAULT_SALAM_PEMBUKA;
  readonly DEFAULT_SALAM_ATAS = DEFAULT_SALAM_ATAS;
  readonly DEFAULT_SALAM_BAWAH = DEFAULT_SALAM_BAWAH;

  domainTokenForm!: FormGroup;
  domainForm!: FormGroup;
  salamForm!: FormGroup;
  filterForm!: FormGroup;


  isInitialLoading = false;
  isLoadingDomain = false;
  isCheckingDomain = false;
  isDomainAvailable: boolean | null = null;
  domainAvailabilityMessage = '';
  showDomainEditor = false;
  isLoadingSalam = false;
  isLoadingFilter = false;


  private modalRef?: BsModalRef;
  private notyf: Notyf;


  dataFilter: any;
  settingData: any;
  filterData: any;
  isFilterExisting = false;
  religionContent: ReligionContentLike = {};
  currentDomain = '';
  pendingDomain = '';

  private readonly domainStorageKey = 'wedding_domain';
  private domainValueChangesSub?: Subscription;
  private domainAvailabilitySub?: Subscription;

  readonly filterItems = [
    {
      control: 'halaman_sampul',
      id: 'halaman-sampul',
      title: 'Halaman Sampul',
      description: 'Tampilkan cover pembuka sebelum isi undangan.',
      icon: 'fa-image',
    },
    {
      control: 'halaman_mempelai',
      id: 'halaman-mempelai',
      title: 'Halaman Mempelai',
      description: 'Tampilkan informasi kedua mempelai.',
      icon: 'fa-heart',
    },
    {
      control: 'halaman_acara',
      id: 'halaman-acara',
      title: 'Halaman Acara',
      description: 'Tampilkan informasi akad dan resepsi.',
      icon: 'fa-calendar-alt',
    },
    {
      control: 'halaman_ucapan',
      id: 'halaman-ucapan',
      title: 'Halaman Ucapan',
      description: 'Tampilkan form serta daftar ucapan tamu.',
      icon: 'fa-comments',
    },
    {
      control: 'halaman_galery',
      id: 'halaman-galery',
      title: 'Halaman Gallery/Album',
      description: 'Tampilkan album foto pada undangan.',
      icon: 'fa-images',
    },
    {
      control: 'halaman_cerita',
      id: 'halaman-cerita',
      title: 'Halaman Cerita',
      description: 'Tampilkan cerita perjalanan pasangan.',
      icon: 'fa-book-open',
    },
    {
      control: 'halaman_lokasi',
      id: 'halaman-lokasi',
      title: 'Halaman Lokasi',
      description: 'Tampilkan peta dan alamat acara.',
      icon: 'fa-map-marker-alt',
    },
    {
      control: 'halaman_prokes',
      id: 'halaman-prokes',
      title: 'Halaman Prokes',
      description: 'Tampilkan informasi protokol kesehatan.',
      icon: 'fa-shield-alt',
    },
    {
      control: 'halaman_send_gift',
      id: 'halaman-send-gift',
      title: 'Halaman Kirim Hadiah',
      description: 'Tampilkan informasi hadiah dan rekening.',
      icon: 'fa-gift',
    },
    {
      control: 'halaman_qoute',
      id: 'halaman-qoute',
      title: 'Halaman Quote',
      description: 'Tampilkan kutipan atau doa pilihan.',
      icon: 'fa-quote-left',
    },
  ];

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
    this.setupDomainAvailabilityCheck();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.domainValueChangesSub?.unsubscribe();
    this.domainAvailabilitySub?.unsubscribe();
  }

  private initializeForms(): void {

    this.domainTokenForm = this.fb.group({
      domain: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(80),
          Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        ],
      ],
      token: ['']
    });

    this.domainForm = this.fb.group({
      domain: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(80),
          Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        ],
      ],
    });

    this.salamForm = this.fb.group({
      salam_pembuka: [DEFAULT_SALAM_PEMBUKA],
      salam_atas: [DEFAULT_SALAM_ATAS],
      salam_bawah: [DEFAULT_SALAM_BAWAH]
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
        this.religionContent = getReligionContentFromData(res);

        this.populateFormsWithData();
        this.loadReligionContentFallback();
      },
      error: (err) => {

        this.notyf.error('Gagal memuat data pengaturan');
        this.isInitialLoading = false;
      }
    });
  }

  private loadReligionContentFallback(): void {
    if (this.hasReligionContent()) {
      this.isInitialLoading = false;
      return;
    }

    this.dashboardSvc.getReligionContent().subscribe({
      next: (response) => {
        this.religionContent = getReligionContentFromData(response);
        this.populateFormsWithData();
        this.isInitialLoading = false;
      },
      error: () => {
        this.isInitialLoading = false;
      },
    });
  }

  private populateFormsWithData(): void {
    const resolvedDomain = this.resolveCurrentDomain({
      ...(this.dataFilter || {}),
      ...(this.settingData || {}),
      setting: this.settingData,
    });

    if (resolvedDomain) {
      this.currentDomain = resolvedDomain;
    }

    if (this.settingData || this.currentDomain) {
      this.domainTokenForm.patchValue({
        domain: this.currentDomain,
        token: this.settingData?.token || ''
      });
    }

    this.salamForm.patchValue({
      salam_pembuka: this.resolveEditableSalamValue(
        'salam_pembuka',
        this.DEFAULT_SALAM_PEMBUKA,
        'invitation_intro',
        'salam_pembuka'
      ),
      salam_atas: this.resolveEditableSalamValue(
        'salam_atas',
        this.DEFAULT_SALAM_ATAS,
        'whatsapp_opening',
        'opening_greeting',
        'salam_atas'
      ),
      salam_bawah: this.resolveEditableSalamValue(
        'salam_bawah',
        this.DEFAULT_SALAM_BAWAH,
        'whatsapp_closing',
        'closing_greeting',
        'salam_bawah'
      ),
    });

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

  get currentDomainUrl(): string {
    return this.currentDomain ? this.buildInvitationUrl(this.currentDomain) : '';
  }

  get pendingDomainUrl(): string {
    return this.pendingDomain ? this.buildInvitationUrl(this.pendingDomain) : '';
  }

  openDomainEditor(): void {
    const domain = this.currentDomain || '';
    this.pendingDomain = domain;
    this.isDomainAvailable = null;
    this.domainAvailabilityMessage = domain
      ? 'Masukkan domain baru untuk mengecek ketersediaan.'
      : 'Masukkan domain undangan yang ingin digunakan.';
    this.showDomainEditor = true;
    this.domainForm.patchValue({ domain }, { emitEvent: false });
    this.domainForm.markAsPristine();
    this.domainForm.markAsUntouched();
  }

  closeDomainEditor(): void {
    if (this.isLoadingDomain) {
      return;
    }

    this.showDomainEditor = false;
    this.pendingDomain = '';
    this.isCheckingDomain = false;
    this.isDomainAvailable = null;
    this.domainAvailabilityMessage = '';
    this.domainAvailabilitySub?.unsubscribe();
  }

  onDomainInputBlur(): void {
    const normalized = this.normalizeDomain(this.domainForm.get('domain')?.value);

    if (normalized !== this.domainForm.get('domain')?.value) {
      this.domainForm.patchValue({ domain: normalized });
    }
  }

  canSubmitDomain(): boolean {
    const domain = this.normalizeDomain(this.domainForm.get('domain')?.value);

    return this.domainForm.valid &&
      !!domain &&
      domain !== this.currentDomain &&
      this.isDomainAvailable === true &&
      !this.isCheckingDomain &&
      !this.isLoadingDomain;
  }

  saveDomainChange(): void {
    if (!this.canSubmitDomain()) {
      this.notyf.error('Pastikan domain valid dan tersedia.');
      return;
    }

    this.pendingDomain = this.normalizeDomain(this.domainForm.get('domain')?.value);

    const initialState = {
      title: 'Ubah Domain Undangan?',
      message: `Alamat undangan akan berubah dari:\n${this.currentDomainUrl || '-'}\n\nmenjadi:\n${this.pendingDomainUrl}\n\nLink lama mungkin tidak dapat digunakan kembali.`,
      cancelClicked: () => this.modalRef?.hide(),
      submitClicked: () => this.submitDomainChange(),
      submitMessage: 'Ya, Ubah Domain',
    };

    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });
  }

  private submitDomainChange(): void {
    const domain = this.normalizeDomain(this.pendingDomain || this.domainForm.get('domain')?.value);

    if (!domain || domain === this.currentDomain || this.isLoadingDomain) {
      return;
    }

    this.isLoadingDomain = true;

    this.dashboardSvc.updateInvitationDomain(domain).subscribe({
      next: (res) => {
        const updatedDomain = this.resolveUpdatedDomain(res, domain);
        this.applyUpdatedDomain(updatedDomain);
        this.modalRef?.hide();
        this.showDomainEditor = false;
        this.notyf.success(res?.message || 'Domain undangan berhasil diperbarui.');
        this.isLoadingDomain = false;
      },
      error: (err) => {
        this.notyf.error(this.resolveDomainErrorMessage(err, 'Domain undangan gagal diperbarui.'));
        this.isLoadingDomain = false;
      },
    });
  }

  private setupDomainAvailabilityCheck(): void {
    this.domainValueChangesSub = this.domainForm.get('domain')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe((value) => this.checkDomainAvailability(value));
  }

  private checkDomainAvailability(value: unknown): void {
    const domain = this.normalizeDomain(value);
    this.pendingDomain = domain;
    this.domainAvailabilitySub?.unsubscribe();

    if (!domain) {
      this.isCheckingDomain = false;
      this.isDomainAvailable = null;
      this.domainAvailabilityMessage = 'Domain wajib diisi.';
      return;
    }

    if (this.domainForm.invalid) {
      this.isCheckingDomain = false;
      this.isDomainAvailable = null;
      this.domainAvailabilityMessage = 'Gunakan huruf kecil, angka, dan tanda hubung. Minimal 3 karakter.';
      return;
    }

    if (domain === this.currentDomain) {
      this.isCheckingDomain = false;
      this.isDomainAvailable = null;
      this.domainAvailabilityMessage = 'Domain ini sedang aktif. Masukkan domain yang berbeda.';
      return;
    }

    this.isCheckingDomain = true;
    this.isDomainAvailable = null;
    this.domainAvailabilityMessage = 'Memeriksa domain...';

    this.domainAvailabilitySub = this.dashboardSvc.checkInvitationDomain(domain).subscribe({
      next: (res) => {
        const available = this.resolveDomainAvailability(res);
        this.isDomainAvailable = available;
        this.domainAvailabilityMessage = this.resolveDomainAvailabilityMessage(
          res,
          available ? 'Domain tersedia.' : 'Domain sudah digunakan.'
        );
        this.isCheckingDomain = false;
      },
      error: (err) => {
        this.isDomainAvailable = false;
        this.domainAvailabilityMessage = this.resolveDomainErrorMessage(err, 'Domain tidak dapat digunakan.');
        this.isCheckingDomain = false;
      },
    });
  }

  normalizeDomain(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private buildInvitationUrl(domain: string): string {
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}/wedding/${encodeURIComponent(domain)}`;
  }

  private resolveCurrentDomain(source: any): string {
    return this.normalizeDomain(
      source?.domain ||
      source?.wedding_domain ||
      source?.website_domain ||
      source?.domain_info?.domain ||
      source?.settings?.domain ||
      source?.setting?.domain ||
      source?.invitation?.domain
    );
  }

  private resolveUpdatedDomain(response: any, fallback: string): string {
    return this.normalizeDomain(
      response?.data?.domain ||
      response?.domain ||
      response?.data?.setting?.domain ||
      response?.setting?.domain ||
      fallback
    );
  }

  private resolveDomainAvailability(response: any): boolean {
    const raw = response?.available ??
      response?.is_available ??
      response?.data?.available ??
      response?.data?.is_available ??
      response?.data?.status;

    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw === 1;
    if (typeof raw === 'string') {
      const normalized = raw.toLowerCase();
      return normalized === 'available' || normalized === 'tersedia' || normalized === 'true' || normalized === '1';
    }

    return response?.success === true;
  }

  private resolveDomainAvailabilityMessage(response: any, fallback: string): string {
    return String(
      response?.message ||
      response?.data?.message ||
      fallback
    );
  }

  private resolveDomainErrorMessage(error: any, fallback: string): string {
    const status = Number(error?.status);

    if (error?.error?.message) return error.error.message;
    if (status === 401) return 'Sesi login berakhir. Silakan login kembali.';
    if (status === 403) return 'Anda tidak memiliki akses untuk mengubah domain.';
    if (status === 409) return 'Domain sudah digunakan.';
    if (status === 422) return 'Format domain tidak valid.';
    if (status === 500) return 'Gagal menyimpan domain. Silakan coba lagi.';

    return getFriendlyErrorMessage(error) || fallback;
  }

  private applyUpdatedDomain(domain: string): void {
    this.currentDomain = domain;
    this.pendingDomain = domain;
    this.isDomainAvailable = null;
    this.domainAvailabilityMessage = '';

    this.settingData = {
      ...(this.settingData || {}),
      domain,
    };

    this.domainTokenForm.patchValue({ domain }, { emitEvent: false });
    this.domainForm.patchValue({ domain }, { emitEvent: false });
    localStorage.setItem(this.domainStorageKey, domain);
    localStorage.removeItem('wedding_data');
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
        this.notyf.error(getFriendlyErrorMessage(err));

        this.isLoadingDomain = false;
      }
    });
  }

  private normalizeSalamValue(value: unknown, fallback: string): string {
    return normalizeSalamValue(value, fallback);
  }

  private resolveEditableSalamValue(
    settingKey: 'salam_pembuka' | 'salam_atas' | 'salam_bawah',
    fallback: string,
    ...religionKeys: string[]
  ): string {
    const religionText = this.getReligionText(...religionKeys);
    if (religionText) {
      return religionText.replace(/\r\n/g, '\n');
    }

    if (this.settingData && Object.prototype.hasOwnProperty.call(this.settingData, settingKey)) {
      return String(this.settingData?.[settingKey] || '').trim().replace(/\r\n/g, '\n');
    }

    return this.normalizeSalamValue(undefined, fallback);
  }

  hasReligionContent(): boolean {
    return !!(
      this.getReligionText('invitation_intro', 'salam_pembuka') ||
      this.getReligionText('whatsapp_opening', 'opening_greeting', 'salam_atas') ||
      this.getReligionText('whatsapp_closing', 'closing_greeting', 'salam_bawah')
    );
  }

  private getReligionText(...keys: string[]): string {
    return getResolvedReligionValue(this.religionContent, ...keys);
  }

  getMusicStatusLabel(): string {
    const source = String(
      this.settingData?.music_source_type ||
      this.settingData?.music_info?.music_source_type ||
      this.settingData?.music_info?.source ||
      this.settingData?.active_music?.source_type ||
      ''
    ).toLowerCase();

    if (source === 'custom' || source === 'private' || source === 'pribadi') {
      return 'Musik pribadi';
    }

    if (source === 'catalog' || source === 'global_catalog') {
      return 'Musik katalog';
    }

    if (source === 'default') {
      return 'Musik default';
    }

    if (this.settingData?.musik || this.settingData?.music || this.settingData?.selected_music_id) {
      return 'Musik katalog';
    }

    return 'Belum dipilih';
  }

  getControlLength(controlName: string): number {
    return String(this.salamForm.get(controlName)?.value || '').length;
  }

  saveSalam(): void {
    if (this.hasReligionContent()) {
      this.notyf.error('Pesan agama dikelola dari halaman Penyesuaian Agama.');
      return;
    }

    const formData = new FormData();
    const formValue = this.salamForm.value;
    const payload = {
      salam_pembuka: String(formValue.salam_pembuka || '').trim().replace(/\r\n/g, '\n'),
      salam_atas: String(formValue.salam_atas || '').trim().replace(/\r\n/g, '\n'),
      salam_bawah: String(formValue.salam_bawah || '').trim().replace(/\r\n/g, '\n'),
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
        this.notyf.error(getFriendlyErrorMessage(err));

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
        this.notyf.error(getFriendlyErrorMessage(err));
        this.isLoadingFilter = false;
      }
    });
  }

}
