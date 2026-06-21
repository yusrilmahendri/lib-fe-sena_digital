import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { ModalUploadGaleriComponent } from '../modal-upload-galeri/modal-upload-galeri.component';
import { DashboardService, DashboardServiceType } from '../../dashboard.service';
import { Notyf } from 'notyf';

@Component({
  selector: 'wc-informasi-mempelai',
  templateUrl: './informasi-mempelai.component.html',
  styleUrls: ['./informasi-mempelai.component.scss']
})
export class InformasiMempelaiComponent implements OnInit {
  @Input() formData: any = {};
  @Output() next = new EventEmitter<any>();
  @Output() prev = new EventEmitter<void>();

  formGroup!: FormGroup;
  modalRef?: BsModalRef;
  private notyf: Notyf;
  isSubmitting = false;
  formErrors: { [key: string]: string } = {};


  imagePreviews: { [key: string]: string | null } = {
    photo_pria: null,
    photo_wanita: null,
    cover_photo: null
  };
  userId: any;

  constructor(
    private fb: FormBuilder,
    private modalSvc: BsModalService,
    private dashboardSvc: DashboardService
  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });
  }

  ngOnInit(): void {
    this.formGroup = this.fb.group({
      name_lengkap_pria: ['', Validators.required],
      name_panggilan_pria: ['', Validators.required],
      ayah_pria: ['', Validators.required],
      ibu_pria: ['', Validators.required],
      name_lengkap_wanita: ['', Validators.required],
      name_panggilan_wanita: ['', Validators.required],
      ayah_wanita: ['', Validators.required],
      ibu_wanita: ['', Validators.required],
      user_id: ['', Validators.required],
      status: [1],
      photo_pria: [null],
      photo_wanita: [null],
      cover_photo: [null]
    });

    const step1LocalStorage = localStorage.getItem('formData');
    if (step1LocalStorage) {
      const allDataFromSteps = JSON.parse(step1LocalStorage);
      const userID = allDataFromSteps?.registrasi?.response?.user?.id;
      this.userId = userID;
      this.formGroup.patchValue({
        user_id: userID
      });
    }

    const existingFormData = JSON.parse(localStorage.getItem('formData') || '{}');
    if (existingFormData.informasiMempelai) {
      this.formGroup.patchValue(existingFormData.informasiMempelai.updatedData);
      console.log(existingFormData.informasiMempelai);

    }
    this.imagePreviews = {
      photo_pria: existingFormData?.informasiMempelai?.updatedData?.photo_pria
        ? 'data:image/jpeg;base64,' + existingFormData?.informasiMempelai?.updatedData?.photo_pria
        : null,
      photo_wanita: existingFormData?.informasiMempelai?.updatedData?.photo_wanita
        ? 'data:image/jpeg;base64,' + existingFormData?.informasiMempelai?.updatedData?.photo_wanita
        : null,
      cover_photo: existingFormData?.informasiMempelai?.updatedData?.cover_photo
        ? 'data:image/jpeg;base64,' + existingFormData?.informasiMempelai?.updatedData.cover_photo
        : null
    };


  }

  onFileSelected(event: any, controlName: string) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!allowedTypes.includes(file.type)) {
      this.notyf.error('Format gambar tidak didukung. Gunakan PNG atau JPG.');
      return;
    }

    if (file.size > maxSize) {
      this.notyf.error('Ukuran file maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      this.imagePreviews[controlName] = base64String;
      this.formGroup.patchValue({ [controlName]: base64String.split(',')[1] });
      const existingFormData = JSON.parse(localStorage.getItem('formData') || '{}');
      const updatedFormData = {
        ...existingFormData,
        informasiMempelai: {
          ...existingFormData.informasiMempelai,
          ...this.formGroup.value
        }
      };
      localStorage.setItem('formData', JSON.stringify(updatedFormData));
    };
    reader.readAsDataURL(file);
  }



  onBack() {
    this.prev.emit();
  }

  onNextClicked() {
    if (this.isSubmitting) {
      return;
    }

    if (!this.formGroup.valid) {
      this.notyf.error('Harap isi semua field yang wajib diisi.');
      return;
    }

    this.isSubmitting = true;
    this.formErrors = {};

    const payload = new FormData();

    Object.keys(this.formGroup.value).forEach((key) => {
      const value = this.formGroup.get(key)?.value;

      if (key.includes('photo') && typeof value === 'string') {
        const byteCharacters = atob(value);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        payload.append(key, blob, `${key}.png`);
      } else {
        payload.append(key, value);
      }
    });

    this.dashboardSvc.create(DashboardServiceType.MNL_STEP_TWO, payload,).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.notyf.success(res?.message || 'Data berhasil disimpan.');
        this.openUploadGaleryModal();
      },
      error: (err) => {
        this.isSubmitting = false;

        // Handle 422 validation errors
        if (err?.status === 422) {
          const errors = err?.error?.errors || {};
          this.formErrors = errors;

          if (Object.keys(errors).length > 0) {
            this.notyf.error('Data belum lengkap atau belum sesuai. Silakan periksa kembali form Anda.');
            this.scrollToFirstError();
            return;
          }
        }

        // Generic user-friendly error message
        this.notyf.error('Data belum lengkap atau belum sesuai. Silakan periksa kembali form Anda.');
      }
    });
  }

  private openUploadGaleryModal(): void {
    this.modalRef = this.modalSvc.show(ModalUploadGaleriComponent, {
      initialState: { formData: { ...this.formGroup.value } },
      class: 'modal-lg'
    });

    this.modalRef.content?.formDataChange.subscribe((updatedData: any) => {
      this.formGroup.patchValue(updatedData);
      const data = {
        updatedData: updatedData,
      };
      const existingFormData = JSON.parse(localStorage.getItem('formData') || '{}');
      existingFormData.informasiMempelai = this.formGroup.value;
      existingFormData.step = 3;
      localStorage.setItem('formData', JSON.stringify(existingFormData));
      this.next.emit(data);
    });
  }

  private scrollToFirstError(): void {
    const firstErrorKey = Object.keys(this.formErrors)[0];
    if (firstErrorKey) {
      const errorElement = document.querySelector(`[formControlName="${firstErrorKey}"]`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (errorElement as HTMLInputElement).focus();
      }
    }
  }
}
