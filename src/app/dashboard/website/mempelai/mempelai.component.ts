import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { ModalComponent } from 'src/app/shared/modal/modal.component';

@Component({
  selector: 'wc-mempelai',
  templateUrl: './mempelai.component.html',
  styleUrls: ['./mempelai.component.scss']
})
export class MempelaiComponent implements OnInit {

  coverPhotoForm!: FormGroup;
  dualSectionForm!: FormGroup;

  coverPhotoPreview: string = '';
  groomPhotoPreview: string = '';
  bridePhotoPreview: string = '';

  // Hardcode data untuk urutan mempelai
  urutanMempelaiOptions = [
    { value: 'pria', label: 'Pria Dahulu' },
    { value: 'wanita', label: 'Wanita Dahulu' }
  ];

  private notyf: Notyf;
  private modalRef?: BsModalRef;
  data: any;
  isLoading: boolean = false;
  isUpdating: boolean = false;

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
    this.getDataMempelai();
  }

  private initializeForms(): void {
    this.coverPhotoForm = this.fb.group({
      cover_photo: [null],
      urutan_mempelai: ['', Validators.required]
    });

    this.dualSectionForm = this.fb.group({
      photo_pria: [null],
      photo_wanita: [null],
      name_lengkap_pria: ['', Validators.required],
      name_panggilan_pria: ['', Validators.required],
      ayah_pria: ['', Validators.required],
      ibu_pria: ['', Validators.required],
      name_lengkap_wanita: ['', Validators.required],
      name_panggilan_wanita: ['', Validators.required],
      ayah_wanita: ['', Validators.required],
      ibu_wanita: ['', Validators.required]
    });
  }

  getDataMempelai(): void {
    this.isLoading = true;
    this.dashboardSvc.list(DashboardServiceType.MEMPELAI_DATA).subscribe({
      next: (res) => {
        console.log('Response data:', res);
        this.data = res['data'][0];
        if (this.data) {
          this.populateFormsWithData(this.data);
          this.setPhotoPreviewsFromData(this.data);
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Gagal mendapatkan data mempelai:', err);
        this.notyf.error(getFriendlyErrorMessage(err));
        this.isLoading = false;
      },
    });
  }

  private populateFormsWithData(data: any): void {
    // Isi coverPhotoForm
    this.coverPhotoForm.patchValue({
      urutan_mempelai: data.urutan_mempelai || ''
    });

    // Isi dualSectionForm
    this.dualSectionForm.patchValue({
      name_lengkap_pria: data.name_lengkap_pria || '',
      name_panggilan_pria: data.name_panggilan_pria || '',
      ayah_pria: data.ayah_pria || '',
      ibu_pria: data.ibu_pria || '',
      name_lengkap_wanita: data.name_lengkap_wanita || '',
      name_panggilan_wanita: data.name_panggilan_wanita || '',
      ayah_wanita: data.ayah_wanita || '',
      ibu_wanita: data.ibu_wanita || ''
    });
  }

  private setPhotoPreviewsFromData(data: any): void {
    this.coverPhotoPreview = data.cover_photo || '';
    this.groomPhotoPreview = data.photo_pria || '';
    this.bridePhotoPreview = data.photo_wanita || '';
  }

  handlePhotoUpload(event: Event, controlName: string): void {
    const fileInput = event.target as HTMLInputElement;

    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];

      if (!this.validateFile(file)) {
        fileInput.value = '';
        return;
      }

      this.processFileUpload(file, controlName);
    }
  }

  private validateFile(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    const maxSize = 2 * 1024 * 1024; // 2 MB

    if (!allowedTypes.includes(file.type)) {
      this.notyf.error('Jenis file tidak valid. Silakan pilih file gambar (JPEG, PNG, JPG, GIF).');
      return false;
    }

    if (file.size > maxSize) {
      this.notyf.error('Ukuran file melebihi batas 2MB.');
      return false;
    }

    return true;
  }

  private processFileUpload(file: File, controlName: string): void {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const objectUrl = e.target.result;

      switch (controlName) {
        case 'cover_photo':
          this.coverPhotoPreview = objectUrl;
          this.coverPhotoForm.patchValue({ cover_photo: file });
          break;
        case 'photo_pria':
          this.groomPhotoPreview = objectUrl;
          this.dualSectionForm.patchValue({ photo_pria: file });
          break;
        case 'photo_wanita':
          this.bridePhotoPreview = objectUrl;
          this.dualSectionForm.patchValue({ photo_wanita: file });
          break;
      }
    };

    reader.readAsDataURL(file);
  }

  onUrutanMempelaiChange(selectedValue: any): void {
    // ng-select akan mengirim value langsung, bukan object
    this.coverPhotoForm.patchValue({
      urutan_mempelai: selectedValue
    });
  }

  onUpdateCoverPhoto(): void {
    if (!this.coverPhotoForm.valid) {
      this.markFormGroupTouched(this.coverPhotoForm);
      this.notyf.error('Mohon lengkapi semua field yang diperlukan');
      return;
    }

    const initialState = {
      message: 'Apakah Anda ingin memperbarui cover photo dan urutan mempelai?',
      cancelClicked: () => this.modalRef?.hide(),
      submitClicked: () => this.updateCoverPhoto(),
      submitMessage: 'Perbarui',
    };

    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });
    this.handleModalResponse();
  }

  onUpdateDataMempelai(): void {
    if (!this.dualSectionForm.valid) {
      this.markFormGroupTouched(this.dualSectionForm);
      this.notyf.error('Mohon lengkapi semua field yang diperlukan');
      return;
    }

    const initialState = {
      message: 'Apakah Anda ingin memperbarui data mempelai?',
      cancelClicked: () => this.modalRef?.hide(),
      submitClicked: () => this.updateDataMempelai(),
      submitMessage: 'Perbarui',
    };

    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });
    this.handleModalResponse();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private handleModalResponse(): void {
    if (this.modalRef?.content) {
      this.modalRef.content.onClose.subscribe((res: any) => {
        if (res?.state === 'cancel') {
          this.modalRef?.hide();
        }
        this.modalRef?.hide();
      });
    }
  }

  private updateCoverPhoto(): void {
    if (!this.data?.id) {
      this.notyf.error('ID data tidak ditemukan');
      return;
    }

    this.isUpdating = true;
    const formData = this.createCoverPhotoFormData();

    console.log('Cover Photo Update Payload:');
    formData.forEach((value, key) => {
      if (value instanceof File) {
        console.log(`${key}:`, `File - ${value.name} (${value.size} bytes)`);
      } else {
        console.log(`${key}:`, value);
      }
    });

    this.dashboardSvc.create(
      DashboardServiceType.MEMPELAI_UPDATE,formData
    ).subscribe({
      next: (res) => {
        this.notyf.success(res?.message || 'Cover photo berhasil diperbarui');
        this.getDataMempelai(); // Refresh data
        this.isUpdating = false;
        this.modalRef?.hide();
      },
      error: (err) => {
        console.error('Error updating cover photo:', err);
        this.notyf.error(getFriendlyErrorMessage(err));
        this.isUpdating = false;
      }
    });
  }

  private updateDataMempelai(): void {
    if (!this.data?.id) {
      this.notyf.error('ID data tidak ditemukan');
      return;
    }

    this.isUpdating = true;
    const formData = this.createMempelaiFormData();

    console.log('Mempelai Data Update Payload:');
    formData.forEach((value, key) => {
      if (value instanceof File) {
        console.log(`${key}:`, `File - ${value.name} (${value.size} bytes)`);
      } else {
        console.log(`${key}:`, value);
      }
    });

    this.dashboardSvc.create(
      DashboardServiceType.MEMPELAI_UPDATE,formData
    ).subscribe({
      next: (res) => {
        this.notyf.success(res?.message || 'Data mempelai berhasil diperbarui');
        this.getDataMempelai(); // Refresh data
        this.isUpdating = false;
        this.modalRef?.hide();
      },
      error: (err) => {
        console.error('Error updating mempelai data:', err);
        this.notyf.error(getFriendlyErrorMessage(err));
        this.isUpdating = false;
      }
    });
  }

  private createCoverPhotoFormData(): FormData {
    const formData = new FormData();
    const coverPhotoData = this.coverPhotoForm.value;

    if (coverPhotoData.cover_photo instanceof File) {
      formData.append('cover_photo', coverPhotoData.cover_photo);
    }

    if (coverPhotoData.urutan_mempelai) {
      formData.append('urutan_mempelai', coverPhotoData.urutan_mempelai);
    }

    return formData;
  }

  private createMempelaiFormData(): FormData {
    const formData = new FormData();
    const dualSectionFormValue = this.dualSectionForm.value;

    // Append photos if they exist and are File objects
    if (dualSectionFormValue.photo_pria instanceof File) {
      formData.append('photo_pria', dualSectionFormValue.photo_pria);
    }
    if (dualSectionFormValue.photo_wanita instanceof File) {
      formData.append('photo_wanita', dualSectionFormValue.photo_wanita);
    }

    // Append text fields
    const textFields = [
      'name_lengkap_pria', 'name_panggilan_pria', 'ayah_pria', 'ibu_pria',
      'name_lengkap_wanita', 'name_panggilan_wanita', 'ayah_wanita', 'ibu_wanita'
    ];

    textFields.forEach(field => {
      const value = dualSectionFormValue[field];
      if (value) {
        formData.append(field, value);
      }
    });

    return formData;
  }

  // Helper method untuk trigger file input
  triggerFileInput(inputId: string): void {
    const fileInput = document.getElementById(inputId) as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }
}
