import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import {
  DashboardService,
  DashboardServiceType,
  DashboardOverviewResponse,
  DashboardTrendsResponse,
  DashboardMessagesResponse,
  DashboardMessage
} from 'src/app/dashboard.service';
import { WeddingDataService } from 'src/app/services/wedding-data.service';
import { forkJoin, catchError, of } from 'rxjs';


Chart.register(...registerables);

interface DashboardCard {
  id: string;
  title: string;
  value: number;
  subtitle: string;
  color: string;
  active: boolean;
}

interface ChartDataPoint {
  date: string;
  totalPengunjung: number;
  konfirmasiKehadiran: number;
  doaUcapan: number;
  totalHadiah: number;
}

@Component({
  selector: 'wc-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})

export class OverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  chart: Chart | null = null;
  isLoading = false;
  activeFilter = 'totalPengunjung';
  profile: any;
  profileData: any;
  userProfile: any;
  settings: any;
  userData: any;
  weddingDataFromIndex: any;
  public publicWeddingUrl = '';
  public domainErrorMessage = '';

  // API data properties
  dashboardOverview: DashboardOverviewResponse['data'] | null = null;
  dashboardTrends: DashboardTrendsResponse['data'] | null = null;
  dashboardMessages: DashboardMessage[] = [];
  apiError: string | null = null;


  dashboardCards: DashboardCard[] = [
    {
      id: 'totalPengunjung',
      title: 'Total Pengunjung',
      value: 0,
      subtitle: 'Orang / 7 hari',
      color: '#10B981',
      active: true
    },
    {
      id: 'konfirmasiKehadiran',
      title: 'Konfirmasi Kehadiran',
      value: 0,
      subtitle: 'orang akan datang',
      color: '#F59E0B',
      active: false
    },
    {
      id: 'doaUcapan',
      title: 'Doa & Ucapan',
      value: 0,
      subtitle: 'orang memberi ucapan',
      color: '#06B6D4',
      active: false
    },
    {
      id: 'totalHadiah',
      title: 'Total Hadiah',
      value: 0,
      subtitle: 'diterima',
      color: '#EC4899',
      active: false
    }
  ];


  chartData: ChartDataPoint[] = [];

  constructor(
    private DashBoardSvc: DashboardService,
    private weddingDataService: WeddingDataService
  ) { }

  ngOnInit(): void {
    console.log('[OverviewInit]');
    this.initDataProfile();
  }

  initDataProfile(): void {
    this.isLoading = true;
    this.apiError = null;

    this.DashBoardSvc.getProfile().subscribe({
      next: (response: any) => {
        this.updatePublicWeddingUrlFromProfileResponse(response);
        const profile = this.extractProfilePayload(response);
        this.userData = profile;
        this.profile = profile;
        this.profileData = profile;
        this.userProfile = profile;
        console.log('User profile data:', this.userData);

        if (this.userData && this.userData.id) {
          this.loadDashboardData();

          const domain =
            this.resolveDomainFromAnyProfile(response) ||
            this.normalizeWeddingDomain(localStorage.getItem('wedding_domain'));

          if (domain) {
            const params = { domain };
            this.DashBoardSvc.list(DashboardServiceType.WEDDING_VIEW_CORE, params).subscribe({
              next: (res) => {
                this.weddingDataFromIndex = res.data;
                this.settings = res?.data?.settings || this.settings;
                console.log('Wedding data loaded:', this.weddingDataFromIndex);
                if (this.weddingDataFromIndex) {
                  this.weddingDataService.setWeddingData(this.weddingDataFromIndex);
                }
              },
              error: (error) => {
                console.error('Error fetching wedding data:', error);
              },
            });
          } else {
            console.warn('No domain available, skipping public wedding profile request');
          }
        } else {
          console.warn('No user data available');
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('[OverviewProfileError]', error);
        this.apiError = 'Failed to load user profile';

        const storedDomain = this.normalizeWeddingDomain(localStorage.getItem('wedding_domain'));
        if (storedDomain && !this.publicWeddingUrl) {
          this.setPublicWeddingUrl(storedDomain);
        }

        this.isLoading = false;
      },
    });
  }

  private loadDashboardData(): void {
    if (!this.userData?.id) {
      console.warn('User ID not available');
      this.isLoading = false;
      return;
    }

    const userId = this.userData.id;

    // Fetch all dashboard data in parallel
    const overview$ = this.DashBoardSvc.getParam(
      DashboardServiceType.DASHBOARD_OVERVIEW,
      `/${userId}`,
      { period: '30d' }
    ).pipe(
      catchError(error => {
        console.error('Error fetching dashboard overview:', error);
        return of(null);
      })
    );

    const trends$ = this.DashBoardSvc.getParam(
      DashboardServiceType.DASHBOARD_TRENDS,
      `/${userId}`,
      { period: '7d', granularity: 'day' }
    ).pipe(
      catchError(error => {
        console.error('Error fetching dashboard trends:', error);
        return of(null);
      })
    );

    const messages$ = this.DashBoardSvc.getParam(
      DashboardServiceType.DASHBOARD_MESSAGES,
      `/${userId}`,
      { per_page: 50, sort: 'newest' }
    ).pipe(
      catchError(error => {
        console.error('Error fetching dashboard messages:', error);
        return of(null);
      })
    );

    forkJoin({
      overview: overview$,
      trends: trends$,
      messages: messages$
    }).subscribe(
      (results) => {
        if (results.overview) {
          this.dashboardOverview = results.overview.data;
          this.updateDashboardCards();
        }

        if (results.trends) {
          this.dashboardTrends = results.trends.data;
          this.updateChartData();
        }

        if (results.messages) {
          this.dashboardMessages = results.messages.data.messages || [];
        }

        this.isLoading = false;

        // Initialize chart after data is loaded
        setTimeout(() => {
          this.initializeChart();
        }, 100);
      },
      (error) => {
        console.error('Error loading dashboard data:', error);
        this.apiError = 'Failed to load dashboard data';
        this.isLoading = false;
      }
    );
  }

  private updateDashboardCards(): void {
    if (!this.dashboardOverview?.metrics) {
      console.warn('Dashboard metrics not available');
      return;
    }

    const metrics = this.dashboardOverview.metrics;

    this.dashboardCards.forEach(card => {
      switch (card.id) {
        case 'totalPengunjung':
          if (metrics.total_pengunjung) {
            card.value = Number(metrics.total_pengunjung.count) || 0;
            card.subtitle = metrics.total_pengunjung.label || `Orang / ${this.dashboardOverview?.period?.days || 30} hari`;
          }
          break;
        case 'konfirmasiKehadiran':
          if (metrics.konfirmasi_kehadiran) {
            card.value = Number(metrics.konfirmasi_kehadiran.count) || 0;
            card.subtitle = metrics.konfirmasi_kehadiran.label || 'orang akan datang';
          }
          break;
        case 'doaUcapan':
          if (metrics.doa_ucapan) {
            card.value = Number(metrics.doa_ucapan.count) || 0;
            card.subtitle = metrics.doa_ucapan.label || 'orang memberi ucapan';
          }
          break;
        case 'totalHadiah':
          if (metrics.total_hadiah) {
            card.value = Number(metrics.total_hadiah.count) || 0;
            card.subtitle = metrics.total_hadiah.label || 'diterima';
          }
          break;
        default:
          console.warn(`Unknown card ID: ${card.id}`);
      }
    });

    console.log('Dashboard cards updated:', this.dashboardCards);
  }

  private updateChartData(): void {
    if (!this.dashboardTrends?.trends) {
      console.warn('Dashboard trends not available');
      return;
    }

    this.chartData = this.dashboardTrends.trends.map(trend => ({
      date: this.formatDateForChart(trend.date),
      totalPengunjung: Number(trend.total_visitors) || 0,
      konfirmasiKehadiran: Number(trend.confirmed_attendance) || 0,
      doaUcapan: 0, // Not available in trends API
      totalHadiah: 0 // Not available in trends API
    }));

    console.log('Chart data updated:', this.chartData);
  }

  private formatDateForChart(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
    } catch (error) {
      return dateString;
    }
  }

  ngAfterViewInit(): void {

    setTimeout(() => {
      this.initializeChart();
    }, 100);
  }

  onCardClick(cardId: string): void {
    this.isLoading = true;

    this.dashboardCards.forEach(card => {
      card.active = card.id === cardId;
    });

    this.activeFilter = cardId;

    // Update chart immediately if data is available, otherwise show loading
    setTimeout(() => {
      this.updateChart();
      this.isLoading = false;
    }, 300);
  }

  private initializeChart(): void {
    if (!this.chartCanvas) {
      console.error('Chart canvas not found');
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context from canvas');
      return;
    }


    if (this.chart) {
      this.chart.destroy();
    }

    const activeCard = this.dashboardCards.find(card => card.active);
    const borderColor = activeCard?.color || '#10B981';

    const config: ChartConfiguration = {
      type: 'line' as ChartType,
      data: {
        labels: this.getFilteredLabels(),
        datasets: [{
          label: activeCard?.title || 'Data',
          data: this.getFilteredData(),
          borderColor: borderColor,
          backgroundColor: borderColor + '20',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: borderColor,
          pointBorderColor: borderColor,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: borderColor,
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              title: (context) => {
                return context[0].label || '';
              },
              label: (context) => {
                const activeCard = this.dashboardCards.find(card => card.active);
                const suffix = this.getValueSuffix();
                return `${activeCard?.title || 'Value'}: ${context.parsed.y} ${suffix}`;
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 5,
              color: '#6B7280'
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              color: '#F3F4F6'
            },
            ticks: {
              color: '#6B7280',
              callback: function (tickValue) {
                return Number(tickValue).toFixed(0);
              }
            }
          }
        },
        elements: {
          point: {
            hoverBorderWidth: 3
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  private updateChart(): void {
    if (!this.chart) {
      this.initializeChart();
      return;
    }

    const activeCard = this.dashboardCards.find(card => card.active);
    const borderColor = activeCard?.color || '#10B981';


    this.chart.data.labels = this.getFilteredLabels();
    this.chart.data.datasets[0].data = this.getFilteredData();
    this.chart.data.datasets[0].label = activeCard?.title || 'Data';
    this.chart.data.datasets[0].borderColor = borderColor;
    this.chart.data.datasets[0].backgroundColor = borderColor + '20';

    this.chart.data.datasets[0].backgroundColor = borderColor + '20';
    this.chart.data.datasets[0].borderColor = borderColor;


    if (this.chart.options.plugins?.tooltip) {
      this.chart.options.plugins.tooltip.borderColor = borderColor;
    }

    this.chart.update('active');
  }

  private getFilteredLabels(): string[] {
    return this.chartData.map(item => item.date);
  }

  private getFilteredData(): number[] {
    const key = this.activeFilter as keyof ChartDataPoint;
    return this.chartData.map(item => item[key] as number);
  }

  private getValueSuffix(): string {
    const activeCard = this.dashboardCards.find(card => card.active);
    switch (activeCard?.id) {
      case 'totalPengunjung':
        return 'orang';
      case 'konfirmasiKehadiran':
        return 'orang';
      case 'doaUcapan':
        return 'ucapan';
      case 'totalHadiah':
        return 'hadiah';
      default:
        return '';
    }
  }


  getActiveCard(): DashboardCard | undefined {
    return this.dashboardCards.find(card => card.active);
  }


  formatNumber(value: number): string {
    return value.toLocaleString();
  }

  /**
   * Get all messages for display in sidebar with scrollable container
   */
  getRecentMessages(): DashboardMessage[] {
    return this.dashboardMessages;
  }

  /**
   * Get color for attendance status badge
   */
  getAttendanceColor(kehadiran: string): string {
    switch (kehadiran) {
      case 'hadir':
        return '#10B981'; // Green
      case 'tidak_hadir':
        return '#EF4444'; // Red
      case 'mungkin':
        return '#F59E0B'; // Orange
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Check if dashboard data is loaded
   */
  isDashboardDataLoaded(): boolean {
    return this.dashboardOverview !== null && this.dashboardTrends !== null;
  }

  /**
   * Get period label for display
   */
  getPeriodLabel(): string {
    if (this.dashboardOverview?.period) {
      const days = this.dashboardOverview.period.days;
      return `Last ${days} Days`;
    }
    return 'Last 30 Days';
  }

  /**
   * Get formatted domain expiry date from userData
   */
  getDomainExpiryDate(): string {
    if (this.userData?.invitation?.domain_expires_at) {
      const expiryDate = new Date(this.userData.invitation.domain_expires_at);
      return expiryDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    return '20 Desember 2024'; // Fallback to original hardcoded date
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  /**
   * Open the public wedding website using already-loaded API data.
   * Uses a synchronous click flow so Safari iPhone does not block navigation.
   */
  handleViewWebsiteClick(event: Event): void {
    console.log('[ViewWebsiteClick]', {
      publicWeddingUrl: this.publicWeddingUrl,
    });

    if (!this.publicWeddingUrl) {
      event.preventDefault();
      event.stopPropagation();
      this.domainErrorMessage = 'Domain undangan belum tersedia. Silakan muat ulang halaman.';
    }

    if (this.weddingDataFromIndex) {
      this.weddingDataService.setWeddingData(this.weddingDataFromIndex);
    }
  }

  private extractProfilePayload(response: any): any {
    return response?.data || response?.body?.data || response?.result?.data || response;
  }

  private resolveDomainFromAnyProfile(response: any): string {
    const profile = this.extractProfilePayload(response);

    const rawDomain =
      profile?.domain_info?.domain ||
      profile?.data?.domain_info?.domain ||
      profile?.domain ||
      profile?.data?.domain ||
      profile?.settings?.domain ||
      profile?.data?.settings?.domain ||
      profile?.invitation?.domain ||
      profile?.data?.invitation?.domain ||
      '';

    return this.normalizeWeddingDomain(rawDomain);
  }

  private normalizeWeddingDomain(value: any): string {
    if (!value) return '';

    return String(value)
      .trim()
      .replace(/^https?:\/\/(www\.)?sena-digital\.com\/wedding\//i, '')
      .replace(/^https?:\/\/(www\.)?sena-digital\.com\//i, '')
      .replace(/^sena-digital\.com\/wedding\//i, '')
      .replace(/^sena-digital\.com\//i, '')
      .replace(/^\/wedding\//i, '')
      .replace(/^\//, '')
      .split('?')[0]
      .split('#')[0];
  }

  private setPublicWeddingUrl(domain: string): void {
    const normalizedDomain = this.normalizeWeddingDomain(domain);

    if (!normalizedDomain) {
      return;
    }

    this.publicWeddingUrl = `/wedding/${encodeURIComponent(normalizedDomain)}`;
    this.domainErrorMessage = '';
    localStorage.setItem('wedding_domain', normalizedDomain);

    console.log('[OverviewPublicWeddingUrlSet]', {
      domain: normalizedDomain,
      publicWeddingUrl: this.publicWeddingUrl,
    });
  }

  private updatePublicWeddingUrlFromProfileResponse(response: any): void {
    const domain = this.resolveDomainFromAnyProfile(response);

    if (domain) {
      this.setPublicWeddingUrl(domain);
      return;
    }

    const storedDomain = this.normalizeWeddingDomain(localStorage.getItem('wedding_domain'));

    if (storedDomain) {
      this.setPublicWeddingUrl(storedDomain);
      return;
    }

    console.warn('[OverviewDomainMissing]', {
      response,
      publicWeddingUrl: this.publicWeddingUrl,
    });
  }

  getPublicWeddingUrl(): string {
    return this.publicWeddingUrl;
  }

  getPublicWeddingAbsoluteUrl(): string {
    const path = this.publicWeddingUrl;

    if (!path) {
      return '';
    }

    return `${window.location.origin}${path}`;
  }

}
