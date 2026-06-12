import { Component, OnInit } from '@angular/core';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons'; 
import { far } from '@fortawesome/free-regular-svg-icons'; 
import { fab } from '@fortawesome/free-brands-svg-icons'; 
@Component({
  selector: 'wc-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {

  Cssclass: boolean = false;

  footerNavigation: { label: string; target: string }[] = [
    { label: 'Beranda', target: 'beranda' },
    { label: 'Tema', target: 'tema' },
    { label: 'Harga', target: 'harga' },
    { label: 'Testimoni', target: 'testimoni' },
    { label: 'FAQ', target: 'harga' },
  ];

  footerContacts: { label: string; icon: string; link: string }[] = [
    {
      label: 'WhatsApp',
      icon: 'whatsapp',
      link: 'https://wa.me/628817587308?text=Halo%20Kak%2C%20saya%20tertarik%20untuk%20membuat%20undangan%20digital.%20Boleh%20konsultasi%20terlebih%20dahulu%3F',
    },
    { label: 'Email', icon: 'email', link: 'mailto:Zayyin.alfar1@gmail.com' },
    { label: 'Instagram', icon: 'instagram', link: '#' },
  ];

  footerLegal: string[] = ['Syarat & Ketentuan', 'Kebijakan Privasi', 'FAQ'];

  year = new Date().getFullYear();

  constructor() {
    library.add(fas,fab,far)
  }

  ngOnInit(): void {
    this.Cssclass = false;
  }

  onClick(): void {
    // Toggle the Cssclass property to show/hide mobile menu
    this.Cssclass = !this.Cssclass;
  }

  // Function to navigate to a specific section on the page and hide the navbar
  navigate(sectionId: string): void {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.Cssclass = false; // Hide the mobile menu after navigating
  }
}
