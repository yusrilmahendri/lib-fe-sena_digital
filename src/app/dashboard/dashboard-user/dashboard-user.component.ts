import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import {
  DashboardService,
  DashboardServiceType,
  ProfileData,
  ProfileResponse
} from 'src/app/dashboard.service';
import { filter } from 'rxjs/operators';
import { IdleTimeoutService } from 'src/app/core/services/idle-timeout.service';
import { AccountAccessStatus, resolvePaymentState } from 'src/app/shared/payment-status.util';

@Component({
  selector: 'wc-dashboard-user',
  templateUrl: './dashboard-user.component.html',
  styleUrls: ['./dashboard-user.component.scss'],
  animations: [
    // Submenu dropdown animation
    trigger('submenuExpand', [
      state('collapsed', style({
        height: '0',
        opacity: '0',
        overflow: 'hidden'
      })),
      state('expanded', style({
        height: '*',
        opacity: '1',
        overflow: 'hidden'
      })),
      transition('collapsed <=> expanded', animate('250ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ]),

    // Menu items stagger animation
    trigger('menuItemsStagger', [
      transition('* => *', [
        query('.menu-item', [
          style({ opacity: 0, transform: 'translateX(-20px)' }),
          stagger(50, [
            animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class DashboardUserComponent implements OnInit, OnDestroy {
  currentRouteName: string = '';
  routePath: string = '';
  isWebsiteSubmenuOpen: boolean = false;
  isPengunjungSubmenuOpen: boolean = false;
  isDropdownOpen = false;
  isSidebarOpen = false;
  // Temporarily hide the Bill menu item (billing route/logic kept intact).
  showBillingMenu = false;
  userData: ProfileData | null = null;
  isPaymentActive = false;
  accountStatus: AccountAccessStatus = 'onboarding';
  requireNameModalOpen = false;
  nameCompletionForm: FormGroup;
  isSavingName = false;
  nameCompletionError = '';

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private DashBoardSvc: DashboardService,
    private idleTimeoutService: IdleTimeoutService,
    private fb: FormBuilder
  ) {
    this.nameCompletionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    });
  }

  ngOnInit(): void {
    // Initialize sidebar state based on screen size
    this.initializeSidebarState();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.setRouteName();
      this.setRoutePath();
      this.syncSubmenuStateWithRoute();
      if (window.innerWidth <= 1024) {
        this.isSidebarOpen = false;
        this.isDropdownOpen = false;
      }
      // Refresh profile data when navigating back from profile page
      if (this.router.url.includes('/dashboard') && !this.router.url.includes('/profile')) {
        this.getUserProfile();
      }
    });

    this.setRouteName();
    this.setRoutePath();
    this.syncSubmenuStateWithRoute();
    this.getUserProfile();

    // Listen for profile updates from other components/tabs
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    window.addEventListener('profileUpdated', this.handleProfileUpdate.bind(this));
  }

  private initializeSidebarState(): void {
    // Sidebar should be open by default on desktop (>1024px)
    this.isSidebarOpen = window.innerWidth > 1024;
  }

  getUserProfile(): void {
    this.DashBoardSvc.getProfile().subscribe({
      next: (response: ProfileResponse) => {
        this.userData = response.data;
        const paymentState = resolvePaymentState(response);
        this.accountStatus = paymentState.accountStatus;
        this.isPaymentActive = paymentState.accountStatus === 'active';
        this.syncNameCompletionModal();
        // console.log('User profile data:', this.userData);
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
      }
    });
  }

  isMobileView(): boolean {
    return window.innerWidth <= 1024;
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    if (window.innerWidth <= 1024) {
      this.isSidebarOpen = false;
    }
  }

  private setRouteName(): void {
    const route = this.activatedRoute.firstChild?.snapshot.routeConfig?.path;
    this.currentRouteName = route ? this.capitalizeRouteName(route) : 'Dashboard';
  }

  private setRoutePath(): void {
    this.routePath = this.getFullRoutePath(this.activatedRoute);

    // Ambil segmen terakhir dari path
    const segments = this.routePath.split('/');
    this.routePath = `/${segments[segments.length - 1]}`;

  }

  private getFullRoutePath(route: ActivatedRoute | null): string {
    let path = '';
    while (route) {
      if (route.snapshot.routeConfig) {
        path += `/${route.snapshot.routeConfig.path}`;
      }
      route = route.firstChild;
    }
    return path;
  }

  private capitalizeRouteName(route: string): string {
    return route.charAt(0).toUpperCase() + route.slice(1);
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  logout(): void {
    this.DashBoardSvc.create(DashboardServiceType.USER_LOGOUT, '').subscribe(
      () => {
        this.idleTimeoutService.stop();
        localStorage.removeItem('access_token')
        this.router.navigate(['']);
      },
    );
  }


  isActiveRoute(route: string): boolean {
    if (route === 'pengunjung' && this.router.url.includes('/dashboard/scan-kehadiran')) {
      return true;
    }

    return this.router.url.includes(route);
  }

  toggleWebsiteSubmenu(): void {
    if (!this.isPaymentActive) {
      this.router.navigate([this.getBlockedAccountRoute()]);
      return;
    }

    this.isWebsiteSubmenuOpen = !this.isWebsiteSubmenuOpen;
  }

  togglePengunjungSubmenu(): void {
    if (!this.isPaymentActive) {
      this.router.navigate([this.getBlockedAccountRoute()]);
      return;
    }

    this.isPengunjungSubmenuOpen = !this.isPengunjungSubmenuOpen;
  }

  onProtectedMenuClick(event: Event): void {
    if (this.isPaymentActive) {
      if (window.innerWidth <= 1024) {
        this.isSidebarOpen = false;
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (window.innerWidth <= 1024) {
      this.isSidebarOpen = false;
    }

    this.router.navigate([this.getBlockedAccountRoute()]);
  }

  getLockedMenuBadge(): string {
    if (this.accountStatus === 'pending_payment') return 'Menunggu Pembayaran';
    if (this.accountStatus === 'expired') return 'Expired';
    return 'Terkunci';
  }

  private getBlockedAccountRoute(): string {
    switch (this.accountStatus) {
      case 'unverified':
        return '/verify-account';
      case 'pending_payment':
        return '/dashboard/overview';
      case 'expired':
        return '/dashboard/account-expired';
      default:
        return '/buat-undangan';
    }
  }

  private syncSubmenuStateWithRoute(): void {
    if (this.router.url.includes('/dashboard/scan-kehadiran') || this.router.url.includes('/dashboard/pengunjung')) {
      this.isPengunjungSubmenuOpen = true;
    }

    if (this.router.url.includes('/dashboard/website')) {
      this.isWebsiteSubmenuOpen = true;
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Close user dropdown if clicked outside
    if (target && !target.closest('.user-profile')) {
      this.isDropdownOpen = false;
    }

    // Close sidebar if clicked outside on mobile/tablet
    if (target && !target.closest('.sidebar') && !target.closest('.menu-toggle')) {
      if (window.innerWidth <= 1024) {
        this.closeSidebar();
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any): void {
    const windowWidth = event.target.innerWidth;

    if (windowWidth > 1024) {
      this.isSidebarOpen = true;
    } else {
      this.isSidebarOpen = false;
    }
  }

  selectMenu(): void {
    this.isDropdownOpen = false;
    if (window.innerWidth <= 1024) {
      this.closeSidebar();
    }
    this.router.navigate(['/dashboard/profile']);
  }

  // Handle menu item click for mobile
  onMenuItemClick(): void {
    if (window.innerWidth <= 1024) {
      this.closeSidebar();
    }
  }

  /**
   * Get profile photo URL with proper backend server resolution
   */
  getProfilePhotoUrl(): string {
    if (this.userData?.profile_photo_url) {
      // If the URL is relative (starts with /storage), prepend the API base URL
      if (this.userData.profile_photo_url.startsWith('/storage')) {
        return `http://127.0.0.1:8000${this.userData.profile_photo_url}`;
      }
      // If it's already an absolute URL, return as is
      return this.userData.profile_photo_url;
    }
    // Default avatar if no profile photo
    return 'assets/landing/logo.svg';
  }

  /**
   * Get user display name
   */
  getUserDisplayName(): string {
    return this.userData?.name || this.userData?.email || 'User';
  }

  /**
   * Refresh profile data manually
   */
  refreshProfile(): void {
    this.getUserProfile();
  }

  submitNameCompletion(): void {
    if (this.nameCompletionForm.invalid || this.isSavingName || !this.userData) {
      this.nameCompletionForm.markAllAsTouched();
      return;
    }

    this.isSavingName = true;
    this.nameCompletionError = '';

    const payload = {
      name: String(this.nameCompletionForm.get('name')?.value || '').trim(),
      email: this.userData.email,
      phone: this.userData.phone,
    };

    this.DashBoardSvc.updateProfile(payload).subscribe({
      next: (response) => {
        this.userData = response.data;
        this.requireNameModalOpen = false;
        this.isSavingName = false;
        this.nameCompletionError = '';
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: { profileData: this.userData }
        }));
      },
      error: (error) => {
        this.isSavingName = false;
        this.nameCompletionError = this.getNameCompletionBackendError(error);
      },
    });
  }

  getNameCompletionErrorMessage(): string {
    const control = this.nameCompletionForm.get('name');
    if (!control?.touched || !control.errors) return '';
    if (control.errors['required']) return 'Nama pengguna wajib diisi.';
    if (control.errors['minlength']) return 'Nama pengguna minimal 3 karakter.';
    if (control.errors['maxlength']) return 'Nama pengguna maksimal 100 karakter.';
    return '';
  }

  private syncNameCompletionModal(): void {
    const name = String(this.userData?.name || '').trim();
    this.requireNameModalOpen = !name;
    if (!name) {
      this.nameCompletionForm.patchValue({ name: '' }, { emitEvent: false });
    }
  }

  private getNameCompletionBackendError(error: any): string {
    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const firstValue = firstKey ? errors[firstKey] : null;
      const message = Array.isArray(firstValue) ? firstValue[0] : firstValue;
      if (message) return this.translateNameBackendMessage(String(message), firstKey);
    }

    return this.translateNameBackendMessage(error?.error?.message || error?.message || 'Nama pengguna gagal disimpan.');
  }

  private translateNameBackendMessage(message: string, field?: string): string {
    const lower = message.toLowerCase();
    if (field === 'name' || lower.includes('name')) {
      if (lower.includes('required') || lower.includes('wajib')) return 'Nama pengguna wajib diisi.';
      if (lower.includes('at least') || lower.includes('min') || lower.includes('minimal')) return 'Nama pengguna minimal 3 karakter.';
      if (lower.includes('greater than') || lower.includes('max') || lower.includes('maksimal')) return 'Nama pengguna maksimal 100 karakter.';
    }
    return message || 'Nama pengguna gagal disimpan.';
  }

  /**
   * Handle storage changes for profile updates
   */
  private handleStorageChange(event: StorageEvent): void {
    if (event.key === 'profileUpdated') {
      this.getUserProfile();
    }
  }

  /**
   * Handle custom profile update events
   */
  private handleProfileUpdate(event: any): void {
    this.getUserProfile();
  }

  onClickBill(): void {
    this.router.navigate(['/dashboard/bill']);
  }

  /**
   * Get current year for copyright
   */
  getCurrentYear(): number {
    return new Date().getFullYear();
  }

  ngOnDestroy(): void {
    // Cleanup event listeners
    window.removeEventListener('storage', this.handleStorageChange.bind(this));
    window.removeEventListener('profileUpdated', this.handleProfileUpdate.bind(this));
  }
}
