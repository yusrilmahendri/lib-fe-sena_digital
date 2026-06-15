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
    localStorage.setItem('formData', JSON.stringify(this.formData));
  }


  prevStep(): void {
    if (this.formData.step > 1) {
      this.formData.step--;
      localStorage.setItem('formData', JSON.stringify(this.formData));

    }
  }


}
