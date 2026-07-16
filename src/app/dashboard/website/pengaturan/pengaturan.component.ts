import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
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
  religionContent: ReligionContentLike = {};

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
    if (this.settingData) {
      this.domainTokenForm.patchValue({
        domain: this.settingData.domain || '',
        token: this.settingData.token || ''
      });
    }

    this.salamForm.patchValue({
      salam_pembuka: this.normalizeSalamValue(
        this.getReligionText('invitation_intro', 'salam_pembuka') || this.settingData?.salam_pembuka,
        this.DEFAULT_SALAM_PEMBUKA
      ),
      salam_atas: this.normalizeSalamValue(
        this.getReligionText('whatsapp_opening', 'opening_greeting', 'salam_atas') || this.settingData?.salam_atas,
        this.DEFAULT_SALAM_ATAS
      ),
      salam_bawah: this.normalizeSalamValue(
        this.getReligionText('whatsapp_closing', 'closing_greeting', 'salam_bawah') || this.settingData?.salam_bawah,
        this.DEFAULT_SALAM_BAWAH
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
