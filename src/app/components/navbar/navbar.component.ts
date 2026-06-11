import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

interface NavMenuItem {
  label: string;
  target: string;
}

@Component({
  selector: 'wc-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit {
  isMobileMenuOpen = false;

  menuItems: NavMenuItem[] = [
    { label: 'Beranda', target: 'beranda' },
    { label: 'Fitur', target: 'fitur' },
    { label: 'Tema', target: 'tema' },
    { label: 'Harga', target: 'harga' },
    { label: 'Testimoni', target: 'testimoni' },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.isMobileMenuOpen = false;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  // Smooth-scroll to a section anchor on the landing page.
  navigate(sectionId: string): void {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.closeMobileMenu();
  }

  goToLogin(): void {
    this.closeMobileMenu();
    this.router.navigate(['/login']);
  }

  goToBuatUndangan(): void {
    this.closeMobileMenu();
    this.router.navigate(['/buat-undangan']);
  }
}
