import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  buildMailtoUrl,
  buildWhatsappUrl,
  COMPANY_CONTACT,
  CompanyContactConfig,
} from 'src/app/shared/company-contact.config';

interface ContactMethod {
  title: string;
  description: string;
  icon: string;
  actionLabel: string;
  href: string;
  external: boolean;
}

interface FaqItem {
  question: string;
  answer: string;
  isOpen: boolean;
}

@Component({
  selector: 'wc-hubungi-kami',
  templateUrl: './hubungi-kami.component.html',
  styleUrls: ['./hubungi-kami.component.scss']
})
export class HubungiKamiComponent implements OnInit {
  contact: CompanyContactConfig = COMPANY_CONTACT;
  contactForm!: FormGroup;

  readonly categories = [
    'Kendala akun',
    'Pembayaran',
    'Tema undangan',
    'Musik',
    'Teknis',
    'Lainnya',
  ];

  contactMethods: ContactMethod[] = [];

  faqs: FaqItem[] = [
    {
      question: 'Bagaimana cara mengganti tema?',
      answer: 'Buka menu Website > Tampilan, pilih tema yang tersedia, lalu simpan pilihan tema sesuai paket Anda.',
      isOpen: false,
    },
    {
      question: 'Bagaimana cara mengubah musik undangan?',
      answer: 'Buka Website > Musik Undangan untuk memilih musik default, katalog, atau mengunggah musik pribadi jika paket mendukung.',
      isOpen: false,
    },
    {
      question: 'Bagaimana jika pembayaran belum terverifikasi?',
      answer: 'Cek kode pemesanan Anda lalu hubungi admin melalui WhatsApp agar proses verifikasi manual dapat dibantu.',
      isOpen: false,
    },
    {
      question: 'Bagaimana cara membagikan undangan?',
      answer: 'Gunakan menu Bagi Undangan untuk menyalin link atau membagikan pesan undangan melalui WhatsApp.',
      isOpen: false,
    },
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', Validators.email],
      whatsapp: [''],
      category: ['Lainnya'],
      message: ['', Validators.required],
    });

    const supportMessage = 'Halo Admin Horuzt Invitation, saya butuh bantuan terkait undangan digital.';

    this.contactMethods = [
      {
        title: 'WhatsApp',
        description: 'Respon cepat untuk kendala akun, pembayaran, tema, dan teknis.',
        icon: 'fa-comments',
        actionLabel: 'Hubungi',
        href: buildWhatsappUrl(supportMessage),
        external: true,
      },
      {
        title: 'Email',
        description: 'Cocok untuk pertanyaan yang menyertakan dokumen atau detail panjang.',
        icon: 'fa-envelope',
        actionLabel: 'Kirim Email',
        href: buildMailtoUrl('Bantuan Horuzt Invitation', supportMessage),
        external: false,
      },
      {
        title: 'Jam Layanan',
        description: this.contact.serviceHours.map((item) => `${item.label}: ${item.value}`).join(' | '),
        icon: 'fa-clock',
        actionLabel: 'Lihat Jadwal',
        href: '#service-hours',
        external: false,
      },
    ];
  }

  get whatsappHref(): string {
    return buildWhatsappUrl('Halo Admin Horuzt Invitation, saya butuh bantuan terkait pengaturan undangan.');
  }

  get emailHref(): string {
    return buildMailtoUrl(
      'Bantuan Horuzt Invitation',
      'Halo Admin Horuzt Invitation, saya butuh bantuan terkait pengaturan undangan.'
    );
  }

  toggleFaq(index: number): void {
    this.faqs[index].isOpen = !this.faqs[index].isOpen;
  }

  submitContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    window.open(this.buildFormWhatsappUrl(), '_blank', 'noopener,noreferrer');
  }

  buildFormWhatsappUrl(): string {
    const value = this.contactForm.value;
    const message = [
      'Halo Admin Horuzt Invitation, saya butuh bantuan.',
      `Nama: ${value.name}`,
      value.email ? `Email: ${value.email}` : '',
      value.whatsapp ? `WhatsApp: ${value.whatsapp}` : '',
      `Kategori: ${value.category || 'Lainnya'}`,
      `Pesan: ${value.message}`,
    ].filter(Boolean).join('\n');

    return buildWhatsappUrl(message);
  }

  buildFormEmailUrl(): string {
    const value = this.contactForm.value;
    const subject = `Bantuan Horuzt Invitation - ${value.category || 'Lainnya'}`;
    const body = [
      `Nama: ${value.name || ''}`,
      `Email: ${value.email || ''}`,
      `WhatsApp: ${value.whatsapp || ''}`,
      `Kategori: ${value.category || 'Lainnya'}`,
      '',
      value.message || '',
    ].join('\n');

    return buildMailtoUrl(subject, body);
  }

  isInvalid(controlName: string): boolean {
    const control = this.contactForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
