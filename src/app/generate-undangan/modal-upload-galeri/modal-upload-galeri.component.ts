import {
  Component, Input, OnInit, Output, EventEmitter, ViewChild, ElementRef
} from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DashboardService, DashboardServiceType } from '../../dashboard.service';
import { Notyf } from 'notyf';

@Component({
  selector: 'wc-modal-upload-galeri',
  templateUrl: './modal-upload-galeri.component.html',
  styleUrls: ['./modal-upload-galeri.component.scss']
})
export class ModalUploadGaleriComponent implements OnInit {
  @Input() formData: any = {};
  @Output() formDataChange = new EventEmitter<any>();
  @Output() next = new EventEmitter<any>();

  uploadForm!: FormGroup;
  imagePreviews: { [key: string]: string } = {};
  private notyf: Notyf;
  isSubmitting = false;
  formErrors: { [key: string]: string } = {};

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;

  constructor(
    public bsModalRef: BsModalRef,
    private fb: FormBuilder,
    private dashboardSvc: DashboardService
  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });
  }

  ngOnInit(): void {
    const existingFormData = JSON.parse(localStorage.getItem('formData') || '{}');
    const galeriData = existingFormData.informasiMempelai.updatedData || this.formData;

    this.uploadForm = this.fb.group({
      photo: [galeriData.photo || ''],
      status: [1],
      user_id: ['',Validators.required]
    });

    if (galeriData.photo) {
      this.imagePreviews['photo'] = `data:image/png;base64,${galeriData.photo}`;
    }
    const step1LocalStorage = localStorage.getItem('formData');
    if (step1LocalStorage) {
      const allDataFromSteps = JSON.parse(step1LocalStorage);
      const userID = allDataFromSteps?.registrasi?.response?.user?.id;
      this.uploadForm.patchValue({
        user_id: userID
      });
    }
  }

  closeModal(): void {
    this.bsModalRef.hide();
  }

  browseFiles(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any, controlName: string): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!allowedTypes.includes(file.type)) {
      alert('Format gambar tidak didukung. Gunakan PNG atau JPG.');
      return;
    }

    if (file.size > maxSize) {
      alert('Ukuran file maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      this.imagePreviews[controlName] = base64String;
      this.uploadForm.patchValue({ [controlName]: base64String.split(',')[1] });
    };
    reader.readAsDataURL(file);
  }

  onSubmitModal() {
    if (this.isSubmitting) {
      return;
    }

    if (!this.uploadForm.valid) {
      this.notyf.error('Harap isi foto terlebih dahulu');
      return;
    }

    this.isSubmitting = true;
    this.formErrors = {};

    const payload = new FormData();

    Object.keys(this.uploadForm.value).forEach((key) => {
      const value = this.uploadForm.get(key)?.value;
      if (key.includes('photo') && typeof value === 'string') {
        const byteCharacters = atob(value);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        payload.append(key, blob, `${key}.png`);
      } else if (key === 'status') {
        payload.append(key, value ? '1' : '0');
      } else {
        payload.append(key, value);
      }
    });

    this.dashboardSvc.create(DashboardServiceType.MNL_STEP_THREE, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.notyf.success(res?.message || 'Data berhasil disimpan.');
        this.nextStep();
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

  removePhoto(controlName: string): void {
    delete this.imagePreviews[controlName];
    this.uploadForm.patchValue({ [controlName]: '' });
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }


  nextStep(): void {
    const updatedData = {
      ...this.formData,
      ...this.uploadForm.value,
      status: this.uploadForm.value.status ? 1 : 0
    };
    this.closeModal();
    this.next.emit(updatedData);
    this.formDataChange.emit(updatedData);
    const existingFormData = JSON.parse(localStorage.getItem('formData') || '{}');
    existingFormData.informasiMempelai.updateData = { updatedData };
    localStorage.setItem('formData', JSON.stringify(existingFormData));
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
