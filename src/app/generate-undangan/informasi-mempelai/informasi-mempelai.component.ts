import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  private notyf: Notyf;
  isSubmitting = false;
  formErrors: { [key: string]: string } = {};
  userId: any;

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
      status: [1]
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
  }



  goToPreviousStep(): void {
    this.persistCurrentStepData();
    this.prev.emit();
  }

  private persistCurrentStepData(): void {
    const existingFormData = JSON.parse(localStorage.getItem('formData') || '{}');
    const updatedFormData = {
      ...existingFormData,
      informasiMempelai: {
        ...existingFormData.informasiMempelai,
        updatedData: {
          ...existingFormData.informasiMempelai?.updatedData,
          ...this.formGroup.value,
        },
      },
    };

    localStorage.setItem('formData', JSON.stringify(updatedFormData));
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

      payload.append(key, value);
    });

    this.dashboardSvc.create(DashboardServiceType.MNL_STEP_TWO, payload,).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.notyf.success(res?.message || 'Data berhasil disimpan.');
        const data = { updatedData: this.formGroup.value };
        const existingFormData = JSON.parse(localStorage.getItem('formData') || '{}');
        existingFormData.informasiMempelai = data;
        existingFormData.step = 3;
        localStorage.setItem('formData', JSON.stringify(existingFormData));
        this.next.emit(data);
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
