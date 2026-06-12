import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

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

  /* Auth modal state (login / forgot-password / email-confirmation). */
  isAuthModalOpen = false;

  menuItems: NavMenuItem[] = [
    { label: 'Beranda', target: 'beranda' },
    { label: 'Fitur', target: 'fitur' },
    { label: 'Tema', target: 'tema' },
    { label: 'Harga', target: 'harga' },
    { label: 'Testimoni', target: 'testimoni' },
  ];

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.isMobileMenuOpen = false;

    // Open the login modal when returning from the reset-password flow
    // (e.g. router.navigate(['/'], { queryParams: { auth: 'login' } })).
    this.route.queryParams.subscribe((params) => {
      if (params['auth'] === 'login') {
        this.isAuthModalOpen = true;
      }
    });
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

  /** Open the auth modal (login mode) instead of routing to the old /login page. */
  openLoginModal(): void {
    this.closeMobileMenu();
    this.isAuthModalOpen = true;
  }

  closeAuthModal(): void {
    this.isAuthModalOpen = false;
  }

  /** Kept as a backup; the old /login page is no longer the main flow. */
  goToLogin(): void {
    this.closeMobileMenu();
    this.router.navigate(['/login']);
  }

  goToBuatUndangan(): void {
    this.closeMobileMenu();
    this.router.navigate(['/buat-undangan']);
  }
}
