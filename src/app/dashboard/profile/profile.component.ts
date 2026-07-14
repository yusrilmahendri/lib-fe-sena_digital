import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Notyf } from 'notyf';
import {
  DashboardService,
  ProfileData,
  ProfileResponse,
  ValidationError
} from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';

@Component({
  selector: 'wc-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  profileData: ProfileData | null = null;
  isLoading = false;
  isSubmitting = false;
  isPasswordSubmitting = false;
  showPasswordForm = false;
  selectedFile: File | null = null;
  photoPreview: string | null = null;
  isUploadingPhoto = false;
  public isAccountActive = false;

  private notyf: Notyf;

  constructor(
    private fb: FormBuilder,
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef
  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: {
        x: 'right',
        y: 'top'
      }
    });

    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      phone: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(15)]]
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      new_password_confirmation: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  /**
   * Load user profile data
   */
  loadProfile(): void {
    this.isLoading = true;

    this.dashboardService.getProfile().subscribe({
      next: (response: ProfileResponse) => {
        this.profileData = response.data;
        this.updateAccountStatus(response);
        this.populateForm();
        this.isLoading = false;
        this.cdr.detectChanges(); // Force change detection
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.notyf.error('Gagal memuat data profil');
        this.isLoading = false;
      }
    });
  }

  /**
   * Derive the account active/inactive status from the profile response.
   * Purely presentational — does not mutate any data or call endpoints.
   */
  private updateAccountStatus(profile: any): void {
    const data = profile?.data || profile;

    const paymentStatus =
      data?.package_info?.payment_status ||
      data?.invitation_package?.payment_status ||
      data?.payment_status ||
      '';

    const domainActive =
      data?.domain_info?.is_active ??
      data?.invitation_package?.is_domain_active ??
      data?.is_domain_active ??
      null;

    this.isAccountActive =
      domainActive === true ||
      String(paymentStatus).toLowerCase() === 'paid';
  }

  /**
   * Populate form with profile data
   */
  private populateForm(): void {
    if (this.profileData) {
      this.profileForm.patchValue({
        name: this.profileData.name,
        email: this.profileData.email,
        phone: this.profileData.phone
      });
    }
  }

  /**
   * Handle profile form submission
   */
  onSubmitProfile(): void {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    this.isSubmitting = true;
    const formData = this.profileForm.value;

    this.dashboardService.updateProfile(formData).subscribe({
      next: (response) => {
        this.profileData = response.data;
        this.notyf.success(response.message || 'Profil berhasil diperbarui');
        this.isSubmitting = false;
        // Trigger profile update event for other components
        this.triggerProfileUpdateEvent();
      },
      error: (error) => {
        this.handleValidationErrors(error);
        this.isSubmitting = false;
      }
    });
  }

  /**
   * Handle file selection for photo upload
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.notyf.error('Format file harus JPEG, PNG, JPG, atau WEBP');
        return;
      }

      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        this.notyf.error('Ukuran file maksimal 2MB');
        return;
      }

      this.selectedFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.photoPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Upload profile photo
   */
  uploadPhoto(): void {
    if (!this.selectedFile) {
      this.notyf.error('Pilih file foto terlebih dahulu');
      return;
    }

    this.isUploadingPhoto = true;

    this.dashboardService.uploadProfilePhoto(this.selectedFile).subscribe({
      next: (response) => {
        if (this.profileData) {
          this.profileData.profile_photo_url = response.data.profile_photo_url;
        }
        this.notyf.success(response.message || 'Foto profil berhasil diperbarui');
        this.selectedFile = null;
        this.photoPreview = null;
        this.isUploadingPhoto = false;
        // Trigger profile update event for other components
        this.triggerProfileUpdateEvent();
      },
      error: (error) => {
        this.handleValidationErrors(error);
        this.isUploadingPhoto = false;
      }
    });
  }

  /**
   * Delete profile photo
   */
  deletePhoto(): void {
    if (!this.profileData?.profile_photo_url) {
      this.notyf.error('Tidak ada foto untuk dihapus');
      return;
    }

    this.dashboardService.deleteProfilePhoto().subscribe({
      next: (response) => {
        if (this.profileData) {
          this.profileData.profile_photo_url = null;
        }
        this.notyf.success(response.message || 'Foto profil berhasil dihapus');
        // Trigger profile update event for other components
        this.triggerProfileUpdateEvent();
      },
      error: (error) => {
        console.error('Error deleting photo:', error);
        if (error.status === 404) {
          this.notyf.error('Tidak ada foto profil untuk dihapus');
        } else {
          this.notyf.error('Gagal menghapus foto profil');
        }
      }
    });
  }

  /**
   * Toggle password form visibility
   */
  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    if (!this.showPasswordForm) {
      this.passwordForm.reset();
    }
  }

  /**
   * Handle password form submission
   */
  onSubmitPassword(): void {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      return;
    }

    const formData = this.passwordForm.value;

    // Check password confirmation
    if (formData.new_password !== formData.new_password_confirmation) {
      this.notyf.error('Konfirmasi kata sandi baru tidak cocok');
      return;
    }

    this.isPasswordSubmitting = true;

    this.dashboardService.changePassword(formData).subscribe({
      next: (response) => {
        this.notyf.success(response.message || 'Kata sandi berhasil diperbarui');
        this.passwordForm.reset();
        this.showPasswordForm = false;
        this.isPasswordSubmitting = false;
      },
      error: (error) => {
        this.handleValidationErrors(error);
        this.isPasswordSubmitting = false;
      }
    });
  }

  /**
   * Handle validation errors from API
   */
  private handleValidationErrors(error: any): void {
    if (error.status === 422 && error.error?.errors) {
      const validationError = error.error as ValidationError;
      const errors = validationError.errors;

      // Display first error message for each field
      for (const field in errors) {
        if (errors[field] && errors[field].length > 0) {
          this.notyf.error(errors[field][0]);
          break; // Show only the first error to avoid spam
        }
      }
    } else {
      this.notyf.error(getFriendlyErrorMessage(error));
    }
  }

  /**
   * Mark all form controls as touched to show validation errors
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Get form control error message
   */
  getErrorMessage(controlName: string, formGroup: FormGroup = this.profileForm): string {
    const control = formGroup.get(controlName);

    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${controlName === 'name' ? 'Nama' : controlName === 'email' ? 'Email' : 'Nomor HP'} wajib diisi`;
      }
      if (control.errors['email']) {
        return 'Format email tidak valid';
      }
      if (control.errors['minlength']) {
        const requiredLength = control.errors['minlength'].requiredLength;
        return `Minimal ${requiredLength} karakter`;
      }
      if (control.errors['maxlength']) {
        const requiredLength = control.errors['maxlength'].requiredLength;
        return `Maksimal ${requiredLength} karakter`;
      }
    }

    return '';
  }

  /**
   * Trigger profile update event for other components to refresh
   */
  private triggerProfileUpdateEvent(): void {
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('profileUpdated', {
      detail: { profileData: this.profileData }
    }));

    // Also store in localStorage for cross-tab communication
    localStorage.setItem('profileUpdated', Date.now().toString());
    setTimeout(() => {
      localStorage.removeItem('profileUpdated');
    }, 1000);
  }

  /**
   * Get display photo URL
   */
  getPhotoUrl(): string {
    if (this.photoPreview) {
      return this.photoPreview;
    }
    if (this.profileData?.profile_photo_url) {
      // If the URL is relative (starts with /storage), prepend the API base URL
      if (this.profileData.profile_photo_url.startsWith('/storage')) {
        return `http://127.0.0.1:8000${this.profileData.profile_photo_url}`;
      }
      // If it's already an absolute URL, return as is
      return this.profileData.profile_photo_url;
    }
    return 'https://storage.googleapis.com/a1aa/image/58c34d09-66a2-4379-dafd-cb392659c071.jpg';
  }
}
