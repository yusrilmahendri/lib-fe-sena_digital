import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LandingModalService } from '../../landing-modal.service';

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

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public modal: LandingModalService
  ) {}

  ngOnInit(): void {
    this.isMobileMenuOpen = false;

    // Open the login modal when returning from the reset-password flow
    // (e.g. router.navigate(['/'], { queryParams: { auth: 'login' } })).
    this.route.queryParams.subscribe((params) => {
      if (params['auth'] === 'login') {
        this.modal.openLogin();
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
    this.modal.openLogin();
  }

  closeAuthModal(): void {
    this.modal.closeLogin();
  }

  /** Kept as a backup; the old /login page is no longer the main flow. */
  goToLogin(): void {
    this.closeMobileMenu();
    this.router.navigate(['/login']);
  }

  /**
   * "Buat Undangan" now opens the redesigned modal wizard on the landing page
   * instead of routing to the legacy /buat-undangan page. The route still
   * exists for the legacy flow; only the landing entry point changed.
   */
  goToBuatUndangan(): void {
    this.closeMobileMenu();
    this.modal.openCreateInvitation();
  }
}
