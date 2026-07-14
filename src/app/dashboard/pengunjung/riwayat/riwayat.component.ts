import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Chart } from 'chart.js';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { ModalComponent } from '../../../shared/modal/modal.component';
import { Notyf } from 'notyf';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';

@Component({
  selector: 'wc-riwayat',
  templateUrl: './riwayat.component.html',
  styleUrls: ['./riwayat.component.scss']
})
export class RiwayatComponent implements OnInit {
  data: Array<any> = []; // Data asli dari API.
  filteredData: Array<any> = []; // Data yang ditampilkan di tabel setelah pencarian.
  searchTerm: string = ''; // Kata kunci pencarian.
  itemsPerPage = 10; // Jumlah item per halaman.
  selectedVisitor: any = null; // Data pengunjung yang dipilih.

  private notyf : Notyf

  modalRef?: BsModalRef;

  constructor(
    private dashboardSvc: DashboardService,
    private snackBar: MatSnackBar,
    private modalSvc: BsModalService,
    
  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: {
        x: 'right',
        y: 'top'
      }
    });
  }

  ngOnInit(): void {
    this.showTable();
    // this.initChart();
  }

  // Menginisialisasi chart
  initChart(): void {
    new Chart('visitorChart', {
      type: 'line',
      data: {
        labels: ['9 Sep 2024', '16 Sep 2024', '23 Sep 2024', '4 Okt 2024', '10 Okt 2024'],
        datasets: [
          {
            label: 'Pengunjung',
            data: [0, 15, 20, 25, 15],
            borderColor: '#00bcd4',
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  }

  // Mendapatkan data dari API
  showTable(): void {
    this.dashboardSvc.list(DashboardServiceType.USER_PENGUNJUNG_RIWAYAT).subscribe({
      next: (res) => {
        this.data = res?.data.map((item: any) => ({
          id: item.id,
          nama: item.nama || 'Nama tidak tersedia',
          tanggal: item.tanggal || 'Tanggal tidak tersedia',
        }));
        this.filteredData = [...this.data]; // Inisialisasi data yang difilter.
      },
      error: (err) => {
        console.error('Error fetching visitor data:', err);
      },
    });
  }

  // Memfilter data berdasarkan kata kunci
  filterData(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredData = this.data.filter(visitor =>
      visitor.nama.toLowerCase().includes(term)
    );
  }

  // Menangani pemilihan pengunjung
  selectVisitor(visitor: any): void {
    this.selectedVisitor = visitor;
    console.log('Selected visitor:', this.selectedVisitor);
  }

  doDelete(event: any): void {
    let parameterDelete = event.id;

    console.log(event);
    
    const initialState = {
        message: `Apakah anda ingin menghapus data dari ${event?.nama}?`,
        cancelClicked: () => this.handleCancelClicked(),
        // submitClicked: (data: any) => this.deleteVisitor(data.id)
    };

    // Open modal and pass the dynamic message
    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });

    // Check if modalRef and modalRef.content are defined
    if (this.modalRef && this.modalRef.content) {
        this.modalRef.content.onClose.subscribe((res: any) => {
            if (res && res.state === 'delete') {
                this.deleteVisitor(parameterDelete); 
                console.log('yuhuuu');
                
            } else if (res && res.state === 'cancel') {
                console.log('Delete canceled');
            }
            this.modalRef?.hide();
        });
    }
}

  doDeleteAll(): void {
    
    const initialState = {
        message: `Apakah anda ingin menghapus semua data riwayat?`,
        cancelClicked: () => this.handleCancelClicked(),
        // submitClicked: (data: any) => this.deleteVisitor(data.id)
    };

    // Open modal and pass the dynamic message
    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });

    // Check if modalRef and modalRef.content are defined
    if (this.modalRef && this.modalRef.content) {
        this.modalRef.content.onClose.subscribe((res: any) => {
            if (res && res.state === 'delete') {
                this.deleteAllVisitor(); 
                console.log('yuhuuu');
                
            } else if (res && res.state === 'cancel') {
                console.log('Delete canceled');
            }
            this.modalRef?.hide();
        });
    }
}

handleCancelClicked() {
    console.log('Cancel clicked');
    // Add any additional logic for cancel action
}

// handleSubmitClicked(data: any, parameterDelete: any) {
//     console.log('Submit clicked with data:', data);
//     // this.deleteVisitor(parameterDelete); // Perform the delete operation here
// }

  // Menghapus data pengunjung berdasarkan ID
  deleteVisitor(visitorId: number): void {
    const params = `/${visitorId}`
    this.dashboardSvc.deleteV2(DashboardServiceType.DELETE_PENGUNJUNG_RIWAYAT_SINGLE, visitorId ).subscribe({
      next: (res) => {
        this.notyf.success(res?.message || 'Successfully deleted');
        this.showTable();
      },
      error: (err) => {
        this.notyf.error(getFriendlyErrorMessage(err));
        console.error('Error deleting visitor:', err);
      },
    });
  }

  // Menghapus semua data pengunjung
  deleteAllVisitor(): void {
    this.dashboardSvc.delete(DashboardServiceType.DELETE_PENGUNJUNG_RIWAYAT_ALL).subscribe({
      next: (res) => {
        this.notyf.success(res?.message || 'Successfully deleted');
        this.showTable();
      },
      error: (err) => {
        this.notyf.error(getFriendlyErrorMessage(err));
        console.error('Error deleting all visitors:', err);
      },
    });
  }

  // Mengubah format tanggal ke format "8 Oktober 2024"
  formatTanggal(tanggal: string): string {
    const bulan = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const dateObj = new Date(tanggal);
    const tanggalStr = dateObj.getDate();
    const bulanStr = bulan[dateObj.getMonth()];
    const tahunStr = dateObj.getFullYear();
    return `${tanggalStr} ${bulanStr} ${tahunStr}`;
  }

  // Logika untuk pagination (placeholder)
  updatePagination(): void {
    console.log(`Showing ${this.itemsPerPage} items per page`);
  }
}
