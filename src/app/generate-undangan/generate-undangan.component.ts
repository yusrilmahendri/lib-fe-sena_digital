import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'wc-generate-undangan',
  templateUrl: './generate-undangan.component.html',
  styleUrls: ['./generate-undangan.component.scss'],
})
export class GenerateUndanganComponent implements OnInit {

  titles: string[] = ['Isi Data Akun', 'Informasi Mempelai', 'Konfirmasi Data', 'Pembayaran'];

  formData: any = {
    registrasi: {},
    informasiMempelai: {},
    cerita: {},
    pembayaran: {},
    step: 1,
  };

  /** Shown when the user is redirected from the landing modal after one-step. */
  onboardingNotice = '';

  ngOnInit(): void {
    const saved = localStorage.getItem('formData');
    if (saved) {
      this.formData = JSON.parse(saved);
    }

    const temporaryPassword = history.state?.registrationDraft?.password;
    if (temporaryPassword && this.formData?.registrasi) {
      this.formData.registrasi = {
        ...this.formData.registrasi,
        formData: {
          ...(this.formData.registrasi.formData || this.formData.registrasi),
          password: temporaryPassword,
        },
      };
    }
    if (history.state?.registrationDraft) {
      const { registrationDraft, ...navigationState } = history.state;
      history.replaceState(navigationState, document.title);
    }

    // Also removes password left by older versions of this flow.
    this.persistFormData();

    const notice = sessionStorage.getItem('landingOnboardingNotice');
    if (notice) {
      this.onboardingNotice = notice;
      sessionStorage.removeItem('landingOnboardingNotice');
    }

    console.log('all formdata:', this.formData);
  }

  get title(): string {
    return this.titles[this.formData.step - 1] || 'Form';
  }

  get progress(): number {
    return (this.formData.step / this.titles.length) * 100;
  }


  nextStep(data: any): void {
    this.formData = {
      ...this.formData,
      registrasi: data?.formData || this.formData?.registrasi,
    };
    const step = this.formData.step;

    if (step === 1) {
      this.formData.registrasi = data;
    } else if (step === 2) {
      this.formData.informasiMempelai = data;
    } else if (step === 3) {
      this.formData.cerita = data;
    }

    // Naikkan step
    this.formData.step = step + 1;
    this.persistFormData();
  }


  prevStep(): void {
    if (this.formData.step > 1) {
      this.formData.step--;
      this.persistFormData();

    }
  }

  /** Persist resumable fields while keeping password only in component state. */
  private persistFormData(): void {
    const persisted = JSON.parse(JSON.stringify(this.formData));
    if (persisted?.registrasi?.password) {
      delete persisted.registrasi.password;
    }
    if (persisted?.registrasi?.formData?.password) {
      delete persisted.registrasi.formData.password;
    }
    localStorage.setItem('formData', JSON.stringify(persisted));
  }


}
