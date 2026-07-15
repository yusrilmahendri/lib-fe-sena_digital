import { Component, OnInit } from '@angular/core';
import { Notyf } from 'notyf';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';

@Component({
  selector: 'wc-pengguna',
  templateUrl: './pengguna.component.html',
  styleUrls: ['./pengguna.component.scss']
})
export class PenggunaComponent implements OnInit {
  users: AdminUserRow[] = [];
  filteredUsers: AdminUserRow[] = [];
  paginatedUsers: AdminUserRow[] = [];

  paketMap: Record<string, string> = {};

  isLoading = false;
  loadSuccessMessage = '';

  searchTerm = '';
  selectedFilter: UserStatusFilter = 'all';

  currentPage = 1;
  itemsPerPage = 10;
  pagination: AdminUsersPagination | null = null;

  processingSoftDeleteUserId: number | null = null;
  processingHardDeleteUserId: number | null = null;
  processingUpgradeUserId: number | null = null;

  readonly manualPackageOptions = [
    { code: 'trial', label: 'Trial' },
    { code: 'ruby', label: 'Ruby' },
    { code: 'sapphire', label: 'Sapphire' },
    { code: 'diamond', label: 'Diamond' }
  ];

  upgradeModalUser: AdminUserRow | null = null;
  upgradeForm: ManualUpgradeForm = {
    package_code: 'diamond',
    expired_at: '',
    note: ''
  };
  lastUpgradeExpiredDate = '';

  readonly expiringSoonThresholdDays = 7;

  private readonly notyf = new Notyf({
    duration: 2600,
    position: { x: 'right', y: 'top' }
  });

  constructor(
    private dashboardSvc: DashboardService
  ) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.loadSuccessMessage = '';

    this.dashboardSvc.list(DashboardServiceType.MNL_MD_PACK_INVITATION).subscribe({
      next: (paketResponse) => {
        const paketList = paketResponse?.data ?? [];
        this.paketMap = paketList.reduce((acc: Record<string, string>, item: any) => {
          const key = String(item?.id ?? '');
          acc[key] = item?.name ?? item?.nama_paket ?? item?.jenis_paket ?? `Paket #${key}`;
          return acc;
        }, {});
        this.fetchUsers();
      },
      error: () => {
        this.paketMap = {};
        this.fetchUsers();
      }
    });
  }

  private fetchUsers(): void {
    this.dashboardSvc.getParam(DashboardServiceType.ADM_IDX_DASHBOARD, '').subscribe({
      next: (res) => {
        const apiUsers = Array.isArray(res?.data) ? res.data : [];
        this.pagination = res?.pagination ?? null;
        this.users = apiUsers.map((user: any) => this.mapUserToRow(user));
        this.applyFilterAndSearch();
        this.isLoading = false;
        this.loadSuccessMessage = 'Data pengguna berhasil dimuat.';
      },
      error: (error) => {
        this.logHttpError('Gagal memuat data pengguna', error);
        this.users = [];
        this.pagination = null;
        this.applyFilterAndSearch();
        this.isLoading = false;
        this.notyf.error('Gagal memuat data pengguna.');
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.currentPage = 1;
    this.applyFilterAndSearch();
  }

  onFilterChange(filter: UserStatusFilter): void {
    this.selectedFilter = filter;
    this.currentPage = 1;
    this.applyFilterAndSearch();
  }

  onItemsPerPageChange(value: string): void {
    this.itemsPerPage = Number(value);
    this.currentPage = 1;
    this.updatePaginatedUsers();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaginatedUsers();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.itemsPerPage));
  }

  get startItemNumber(): number {
    if (this.filteredUsers.length === 0) return 0;
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get endItemNumber(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredUsers.length);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages;
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(total, this.currentPage + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  getStatusClass(status: UserComputedStatus): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'expiring-soon':
        return 'status-expiring';
      case 'expired':
        return 'status-expired';
      default:
        return 'status-other';
    }
  }

  getStatusLabel(status: UserComputedStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'expiring-soon':
        return 'Akan Expired';
      case 'expired':
        return 'Expired';
      default:
        return 'Tidak Diketahui';
    }
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '–';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '–';
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getSisaHariText(row: AdminUserRow): string {
    if (row.daysRemaining === null) return '–';
    if (row.daysRemaining < 0) return `${Math.abs(row.daysRemaining)} hari lewat`;
    if (row.daysRemaining === 0) return 'Hari ini';
    return `${row.daysRemaining} hari`;
  }

  isSoftDeleteLoading(row: AdminUserRow): boolean {
    const userId = this.getUserId(row);
    return userId !== null && this.processingSoftDeleteUserId === userId;
  }

  isHardDeleteLoading(row: AdminUserRow): boolean {
    const userId = this.getUserId(row);
    return userId !== null && this.processingHardDeleteUserId === userId;
  }

  isUpgradeLoading(row: AdminUserRow): boolean {
    const userId = this.getUserId(row);
    return userId !== null && this.processingUpgradeUserId === userId;
  }

  openUpgradeModal(row: AdminUserRow): void {
    const userId = this.getUserId(row);
    if (!userId) {
      this.showError('ID pengguna tidak valid. Request upgrade paket tidak dikirim.');
      return;
    }

    this.upgradeModalUser = row;
    this.upgradeForm = {
      package_code: this.resolveCurrentPackageCode(row) || 'diamond',
      expired_at: this.toDateInputValue(row.expirationDate),
      note: ''
    };
    this.lastUpgradeExpiredDate = '';
  }

  closeUpgradeModal(): void {
    if (this.processingUpgradeUserId) return;
    this.upgradeModalUser = null;
    this.upgradeForm = {
      package_code: 'diamond',
      expired_at: '',
      note: ''
    };
  }

  canSubmitManualUpgrade(): boolean {
    if (!this.upgradeModalUser || this.processingUpgradeUserId) return false;
    const userId = this.getUserId(this.upgradeModalUser);
    return !!userId &&
      this.manualPackageOptions.some((option) => option.code === this.upgradeForm.package_code) &&
      /^\d{4}-\d{2}-\d{2}$/.test(this.upgradeForm.expired_at);
  }

  async submitManualUpgrade(): Promise<void> {
    if (!this.upgradeModalUser) return;
    const userId = this.getUserId(this.upgradeModalUser);
    if (!userId) {
      this.showError('ID pengguna tidak valid. Request upgrade paket tidak dikirim.');
      return;
    }

    if (!this.canSubmitManualUpgrade()) {
      this.showError('Paket tujuan dan tanggal expired wajib diisi.');
      return;
    }

    const payload = {
      package_code: this.upgradeForm.package_code,
      expired_at: this.upgradeForm.expired_at,
      note: this.upgradeForm.note.trim()
    };

    this.processingUpgradeUserId = userId;
    try {
      const response = await firstValueFrom(
        this.dashboardSvc.createParam(
          DashboardServiceType.ADMIN_USER_UPGRADE_PACKAGE,
          payload,
          `/${userId}/upgrade-package`
        )
      );

      this.lastUpgradeExpiredDate = response?.data?.active_until_formatted || this.formatDate(payload.expired_at);
      this.notyf.success('Paket pengguna berhasil diperbarui.');
      this.notyf.success(`Tanggal expired: ${this.lastUpgradeExpiredDate}`);
      this.upgradeModalUser = null;
      await this.loadUsersAfterAction();
    } catch (error: any) {
      this.logHttpError('Gagal upgrade paket manual', error);
      this.showError(this.resolveManualUpgradeError(error));
    } finally {
      this.processingUpgradeUserId = null;
    }
  }

  async onSoftDelete(row: AdminUserRow): Promise<void> {
    const userId = this.getUserId(row);
    console.log('[ADMIN_DELETE_USER]', {
      rawUser: row.rawUser || row,
      userId
    });

    if (!userId) {
      this.showError('ID pengguna tidak valid. Silakan refresh data.');
      return;
    }

    const result = await Swal.fire({
      title: 'Soft Delete Data Pengguna',
      html: `
        <p style="margin:0 0 8px">Akun utama pengguna <strong>${this.safeText(row.name)}</strong> tetap ada.</p>
        <p style="margin:0">Yang dibersihkan hanya data dan media pengguna.</p>
        <p style="margin:12px 0 0"><strong>Apakah Anda yakin ingin membersihkan data pengguna ini?</strong></p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Bersihkan Data',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b'
    });

    if (!result.isConfirmed) return;

    this.processingSoftDeleteUserId = userId;
    try {
      await this.executeDeleteAction(userId, 'soft');
      this.notyf.success('Data pengguna berhasil dibersihkan.');
      await this.loadUsersAfterAction();
    } catch {
      this.notyf.error('Gagal membersihkan data pengguna.');
    } finally {
      this.processingSoftDeleteUserId = null;
    }
  }

  async onHardDelete(row: AdminUserRow): Promise<void> {
    const userId = this.getUserId(row);
    console.log('[ADMIN_DELETE_USER]', {
      rawUser: row.rawUser || row,
      userId
    });

    if (!userId) {
      this.showError('ID pengguna tidak valid. Silakan refresh data.');
      return;
    }

    const result = await Swal.fire({
      title: 'Hard Delete Akun',
      html: `
        <p style="margin:0 0 8px">Akun <strong>${this.safeText(row.name)}</strong> dan seluruh data akan dihapus permanen.</p>
        <p style="margin:0 0 8px;color:#b91c1c;"><strong>Tindakan ini tidak dapat dibatalkan.</strong></p>
        <p style="margin:0"><strong>Apakah Anda yakin ingin menghapus akun ini beserta seluruh data dan medianya?</strong></p>
      `,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Permanen',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      confirmButtonColor: '#b91c1c',
      cancelButtonColor: '#64748b'
    });

    if (!result.isConfirmed) return;

    this.processingHardDeleteUserId = userId;
    try {
      await this.executeDeleteAction(userId, 'hard');
      this.notyf.success('Akun pengguna berhasil dihapus permanen.');
      await this.loadUsersAfterAction();
    } catch {
      this.notyf.error('Gagal menghapus akun pengguna.');
    } finally {
      this.processingHardDeleteUserId = null;
    }
  }

  private async loadUsersAfterAction(): Promise<void> {
    this.loadUsers();
  }

  private applyFilterAndSearch(): void {
    const search = this.searchTerm.trim().toLowerCase();
    this.filteredUsers = this.users.filter((user) => {
      const matchesSearch = !search || [
        user.name,
        user.email,
        user.domain,
        user.packageName,
        this.getStatusLabel(user.computedStatus)
      ].some((field) => (field || '').toLowerCase().includes(search));

      const matchesFilter = this.selectedFilter === 'all' ||
        (this.selectedFilter === 'active' && user.computedStatus === 'active') ||
        (this.selectedFilter === 'expiring' && user.computedStatus === 'expiring-soon') ||
        (this.selectedFilter === 'expired' && user.computedStatus === 'expired');

      return matchesSearch && matchesFilter;
    });

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    this.updatePaginatedUsers();
  }

  private updatePaginatedUsers(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(start, end);
  }

  private mapUserToRow(user: any): AdminUserRow {
    const expirationDate = this.resolveExpirationDate(user);
    const daysRemaining = this.resolveDaysRemaining(user, expirationDate);
    const computedStatus = this.computeStatus(user?.kd_status, daysRemaining);
    const packageName = this.resolvePackageName(user);
    const userId = this.getUserId(user);

    return {
      id: userId,
      user_id: userId,
      rawUser: user,
      name: user?.name ?? user?.full_name ?? user?.nama ?? 'Tanpa Nama',
      email: user?.email ?? '–',
      domain: user?.domain ?? '–',
      packageName,
      rawStatus: user?.kd_status ?? '-',
      computedStatus,
      expirationDate,
      daysRemaining
    };
  }

  private resolveExpirationDate(user: any): string | null {
    return user?.domain_end_date ??
      user?.expired_at ??
      user?.expires_at ??
      user?.tanggal_expired ??
      null;
  }

  private resolveDaysRemaining(user: any, expirationDate: string | null): number | null {
    const fromApi = user?.days_until_expiry;
    if (typeof fromApi === 'number' && Number.isFinite(fromApi)) return fromApi;
    if (typeof fromApi === 'string' && fromApi.trim() !== '' && !Number.isNaN(Number(fromApi))) {
      return Number(fromApi);
    }

    if (!expirationDate) return null;
    const date = new Date(expirationDate);
    if (Number.isNaN(date.getTime())) return null;

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((date.getTime() - now.getTime()) / msPerDay);
  }

  private computeStatus(rawStatus: string | null, daysRemaining: number | null): UserComputedStatus {
    if (rawStatus === 'EX') return 'expired';
    if (daysRemaining !== null) {
      if (daysRemaining < 0) return 'expired';
      if (daysRemaining <= this.expiringSoonThresholdDays) return 'expiring-soon';
      return 'active';
    }
    if (rawStatus === 'SB') return 'active';
    return 'other';
  }

  private resolvePackageName(user: any): string {
    const paketId = String(user?.paket_undangan_id ?? '');
    if (paketId && this.paketMap[paketId]) return this.paketMap[paketId];
    return user?.nama_paket ?? user?.package_name ?? '–';
  }

  private resolveCurrentPackageCode(row: AdminUserRow): ManualPackageCode | '' {
    const rawPackage = row.rawUser || {};
    const value = String(this.firstPresent([
      rawPackage.package_code,
      rawPackage.kode_paket,
      rawPackage.package,
      rawPackage.jenis_paket,
      row.packageName,
    ]) || '').toLowerCase();

    const found = this.manualPackageOptions.find((option) => value.includes(option.code));
    return found?.code as ManualPackageCode || '';
  }

  private toDateInputValue(value: string | null): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resolveManualUpgradeError(error: any): string {
    if (error?.status === 422 && error?.error?.errors) {
      const messages = Object.values(error.error.errors)
        .reduce((acc: string[], value: any) => acc.concat(Array.isArray(value) ? value : []), [])
        .filter((message) => typeof message === 'string' && message.trim().length > 0);
      return messages.join(' ') || 'Beberapa data upgrade belum sesuai.';
    }

    if (typeof error?.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }

    if (error?.status === 403) return 'Akun admin ini belum memiliki izin mengubah paket pengguna.';
    if (error?.status === 404) return 'Data pengguna tidak ditemukan.';
    return 'Gagal memperbarui paket pengguna.';
  }

  private firstPresent(values: unknown[]): unknown {
    return values.find((value) => value !== null && value !== undefined && value !== '');
  }

  private async executeDeleteAction(userId: number, action: 'soft' | 'hard'): Promise<void> {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new Error('Invalid user id');
    }

    const endpointCandidates = this.buildDeleteEndpointCandidates(userId, action);
    let lastError: unknown = null;

    for (const endpoint of endpointCandidates) {
      try {
        const request$ = action === 'hard'
          ? this.dashboardSvc.httpSvc.delete(endpoint)
          : this.dashboardSvc.httpSvc.post(endpoint, {});
        await firstValueFrom(request$);
        return;
      } catch (error: any) {
        this.logHttpError(`Gagal menjalankan ${action} delete pengguna`, error);
        lastError = error;
        const statusCode = error?.status;
        if (statusCode && statusCode !== 404 && statusCode !== 405) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error('Delete action failed');
  }

  private buildDeleteEndpointCandidates(userId: number, action: 'soft' | 'hard'): string[] {
    const getUsersUrl = this.dashboardSvc.getUrl(DashboardServiceType.ADM_IDX_DASHBOARD);

    if (action === 'soft') {
      return [
        `${getUsersUrl}/${userId}/soft-delete-data`
      ];
    }

    return [
      `${getUsersUrl}/${userId}/hard-delete`
    ];
  }

  getUserId(user: any): number | null {
    const rawId = user?.user_id ?? user?.id;
    const parsed = Number(rawId);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private showError(message: string): void {
    this.notyf.error(message);
  }

  private safeText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private logHttpError(context: string, error: any): void {
    console.error('[Pengguna]', context, {
      status: error?.status,
      url: error?.url,
      error: error?.error,
    });
  }
}

type UserStatusFilter = 'all' | 'active' | 'expiring' | 'expired';
type UserComputedStatus = 'active' | 'expiring-soon' | 'expired' | 'other';
type ManualPackageCode = 'trial' | 'ruby' | 'sapphire' | 'diamond';

interface ManualUpgradeForm {
  package_code: ManualPackageCode;
  expired_at: string;
  note: string;
}

interface AdminUserRow {
  id: number | null;
  user_id: number | null;
  rawUser: any;
  name: string;
  email: string;
  domain: string;
  packageName: string;
  rawStatus: string;
  computedStatus: UserComputedStatus;
  expirationDate: string | null;
  daysRemaining: number | null;
}

interface AdminUsersPagination {
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
  [key: string]: any;
}
