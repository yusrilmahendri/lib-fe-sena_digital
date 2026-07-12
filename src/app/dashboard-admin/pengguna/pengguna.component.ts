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
      month: 'short',
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
    return this.processingSoftDeleteUserId === row.id;
  }

  isHardDeleteLoading(row: AdminUserRow): boolean {
    return this.processingHardDeleteUserId === row.id;
  }

  async onSoftDelete(row: AdminUserRow): Promise<void> {
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

    this.processingSoftDeleteUserId = row.id;
    try {
      await this.executeDeleteAction(row.id, 'soft');
      this.notyf.success('Data pengguna berhasil dibersihkan.');
      await this.loadUsersAfterAction();
    } catch {
      this.notyf.error('Gagal membersihkan data pengguna.');
    } finally {
      this.processingSoftDeleteUserId = null;
    }
  }

  async onHardDelete(row: AdminUserRow): Promise<void> {
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

    this.processingHardDeleteUserId = row.id;
    try {
      await this.executeDeleteAction(row.id, 'hard');
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

    return {
      id: Number(user?.id ?? 0),
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

  private async executeDeleteAction(userId: number, action: 'soft' | 'hard'): Promise<void> {
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
    const adminBaseUrl = getUsersUrl.replace(/\/get-users$/, '');
    const usersUrl = `${adminBaseUrl}/users`;

    if (action === 'soft') {
      return [
        `${getUsersUrl}/${userId}/soft-delete-data`,
        `${getUsersUrl}/${userId}/soft-delete`,
        `${usersUrl}/${userId}/soft-delete-data`,
        `${usersUrl}/${userId}/soft-delete`,
        `${usersUrl}/${userId}/clear-data`
      ];
    }

    return [
      `${getUsersUrl}/${userId}/hard-delete`,
      `${usersUrl}/${userId}/hard-delete`,
      `${usersUrl}/${userId}`,
      `${getUsersUrl}/${userId}`
    ];
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

interface AdminUserRow {
  id: number;
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
