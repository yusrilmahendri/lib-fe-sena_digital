import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginPageComponent } from './login-page/login-page.component';
import { DashboardUserComponent } from './dashboard/dashboard-user/dashboard-user.component';
import { OverviewComponent } from './dashboard/overview/overview.component';
import { BagiUndanganComponent } from './dashboard/bagi-undangan/bagi-undangan.component';
import { ScanKehadiranComponent } from './dashboard/scan-kehadiran/scan-kehadiran.component';
import { HubungiKamiComponent } from './dashboard/hubungi-kami/hubungi-kami.component';
import { PengunjungComponent } from './dashboard/pengunjung/pengunjung.component';
import { TestimoniComponent } from './dashboard/testimoni/testimoni.component';
import { WebsiteComponent } from './dashboard-admin/website/website.component';
import { WebsiteUserComponent } from './dashboard/website/website.component';
import { TampilanComponent } from './dashboard/website/tampilan/tampilan.component';
import { PengaturanComponent } from './dashboard/website/pengaturan/pengaturan.component';
import { DataWebsiteComponent } from './dashboard/website/data-website/data-website.component';
import { MempelaiComponent } from './dashboard/website/mempelai/mempelai.component';
import { AcaraComponent } from './dashboard/website/acara/acara.component';
import { GalleryComponent } from './dashboard/website/gallery/gallery.component';
import { CeritaQuoteComponent } from './dashboard/website/cerita-quote/cerita-quote.component';
import { RekeningComponent } from './dashboard/website/rekening/rekening.component';
import { MusikUndanganComponent } from './dashboard/website/musik-undangan/musik-undangan.component';
import { RiwayatComponent } from './dashboard/pengunjung/riwayat/riwayat.component';
import { UcapanComponent } from './dashboard/pengunjung/ucapan/ucapan.component';
import { GenerateUndanganComponent } from './generate-undangan/generate-undangan.component';
import { RegisterComponent } from './register/register.component';
import { AuthGuard } from './auth.guard';
import { DashboardAdminComponent } from './dashboard-admin/dashboard-admin.component';
import { DashboardComponent } from './dashboard-admin/dashboard/dashboard.component';
import { PenggunaComponent } from './dashboard-admin/pengguna/pengguna.component';
import { PembayaranComponent } from './dashboard-admin/pembayaran/pembayaran.component';
import { GatewayComponent } from './dashboard-admin/gateway/gateway.component';
import { VideoComponent } from './dashboard-admin/video/video.component';
import { TestimoniesComponent } from './dashboard-admin/testimonies/testimonies.component';
import { SettingsAplicationComponent } from './dashboard-admin/pengaturan/settings-aplication/settings-aplication.component';
import { SettingsBundleComponent } from './dashboard-admin/pengaturan/settings-bundle/settings-bundle.component';
import { SettingsPaymentComponent } from './dashboard-admin/pengaturan/settings-payment/settings-payment.component';
import { GuestCheckinLandingComponent } from './guest-checkin-landing/guest-checkin-landing.component';
import { WeddingViewComponent } from './dashboard/wedding-view/wedding-view.component';
import { ProfileComponent } from './dashboard/profile/profile.component';
import { BillUserComponent } from './dashboard/bill-user/bill-user.component';
import { ProfileAdminComponent } from './dashboard-admin/pengaturan/profile-admin/profile-admin.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { ThemePreviewComponent } from './theme-preview/theme-preview.component';
import { MusicCatalogComponent } from './dashboard-admin/music-catalog/music-catalog.component';
import { PenyesuaianAgamaComponent } from './dashboard/penyesuaian-agama/penyesuaian-agama.component';
import { VerifyAccountComponent } from './verify-account/verify-account.component';
import { VerifyAccountCodeComponent } from './verify-account-code/verify-account-code.component';
import { VerifyAccountSuccessComponent } from './verify-account-success/verify-account-success.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { AccountVerificationGuard } from './account-verification.guard';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'preview-theme/:slug', component: ThemePreviewComponent, data: { preview: true } },
  { path: 'themes/:slug', component: ThemePreviewComponent, data: { preview: true } },
  { path: 'wedding/:domain/checkin', component: GuestCheckinLandingComponent },
  { path: 'wedding/:domain', component: WeddingViewComponent },
  { path: 'wedding', component: WeddingViewComponent }, // Fallback route without parameter
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-account', component: VerifyAccountComponent, canActivate: [AuthGuard] },
  { path: 'verify-account/code', component: VerifyAccountCodeComponent, canActivate: [AuthGuard] },
  { path: 'verify-account/success', component: VerifyAccountSuccessComponent, canActivate: [AuthGuard] },
  { path: 'payment-pending', component: BillUserComponent, canActivate: [AuthGuard], data: { accountStatusPage: 'pending_payment' } },
  { path: 'account-expired', component: BillUserComponent, canActivate: [AuthGuard], data: { accountStatusPage: 'expired' } },
  { path: 'pilih-paket', component: GenerateUndanganComponent, canActivate: [AuthGuard, AccountVerificationGuard], data: { onboardingStep: 'payment' } },
  { path: 'buat-undangan/payment', component: GenerateUndanganComponent, canActivate: [AuthGuard, AccountVerificationGuard], data: { onboardingStep: 'payment' } },
  { path: 'buat-undangan', component: GenerateUndanganComponent, canActivate: [AuthGuard, AccountVerificationGuard] },
  {
    path: 'dashboard',
    component: DashboardUserComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'profile', component: ProfileComponent },
      { path: 'bill', component: BillUserComponent, data: { accountStatusPage: 'pending_payment' } },
      { path: 'payment-pending', component: BillUserComponent, data: { accountStatusPage: 'pending_payment' } },
      { path: 'account-expired', component: BillUserComponent, data: { accountStatusPage: 'expired' } },
      { path: 'overview', component: OverviewComponent, canActivate: [AccountVerificationGuard] },
      { path: 'bagi-undangan', component: BagiUndanganComponent, canActivate: [AccountVerificationGuard] },
      { path: 'penyesuaian-agama', component: PenyesuaianAgamaComponent, canActivate: [AccountVerificationGuard] },
      { path: 'scan-kehadiran', component: ScanKehadiranComponent, canActivate: [AccountVerificationGuard] },
      {
        path: 'website',
        component: WebsiteUserComponent,
        children: [
          { path: 'tampilan', component: TampilanComponent, canActivate: [AccountVerificationGuard] },
          { path: 'pengaturan', component: PengaturanComponent, canActivate: [AccountVerificationGuard] },
          { path: 'data-website', component: DataWebsiteComponent, canActivate: [AccountVerificationGuard] },
          { path: 'mempelai', component: MempelaiComponent, canActivate: [AccountVerificationGuard] },
          { path: 'acara', component: AcaraComponent, canActivate: [AccountVerificationGuard] },
          { path: 'gallery', component: GalleryComponent, canActivate: [AccountVerificationGuard] },
          { path: 'musik-undangan', component: MusikUndanganComponent, canActivate: [AccountVerificationGuard] },
          { path: 'cerita-quote', component: CeritaQuoteComponent, canActivate: [AccountVerificationGuard] },
          { path: 'rekening', component: RekeningComponent, canActivate: [AccountVerificationGuard] },
        ],
      },
      {
        path: 'pengunjung',
        component: PengunjungComponent,
        children: [
          { path: 'riwayat', component: RiwayatComponent, canActivate: [AccountVerificationGuard] },
          { path: 'ucapan', component: UcapanComponent, canActivate: [AccountVerificationGuard] },
        ],
      },      { path: 'testimoni', component: TestimoniComponent, canActivate: [AccountVerificationGuard] },
      { path: 'hubungi-kami', component: HubungiKamiComponent },
    ],
  },
  {
    path: 'admin',
    component: DashboardAdminComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'pengguna', component: PenggunaComponent },
      { path: 'profile', component: ProfileAdminComponent },
      { path: 'pembayaran', component: PembayaranComponent },
      { path: 'gateway', component: GatewayComponent },
      { path: 'testimoni', component: TestimoniesComponent },
      { path: 'website', component: WebsiteComponent },
      { path: 'music-catalog', component: MusicCatalogComponent },
      { path: 'video', component: VideoComponent },
      {
        path: 'pengaturan',
        children: [
          { path: 'aplikasi', component: SettingsAplicationComponent },
          { path: 'paket', component: SettingsBundleComponent },
          { path: 'pembayaran', component: SettingsPaymentComponent },
        ],
      },
    ],
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
