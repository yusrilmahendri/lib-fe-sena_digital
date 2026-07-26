import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'wc-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss']
})
export class ModalComponent implements OnInit {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() cancelClicked: () => void = () => {};
  @Input() submitClicked: (data: any) => void = (data: any) => {};
  @Input() submitMessage = '';
  @Output() onClose = new EventEmitter<any>();

  catatan_penghapusan: string = ''; 

  constructor() {}
  ngOnInit(): void {}

  showConfirmationModal(data: any): void {
    this.message = data.message || 'Are you sure?';  // Set the message dynamically
  }

  confirmDelete(): void {
    const result = {
      state: 'delete',
      data: {
        catatan_penghapusan: this.catatan_penghapusan
      }
    };
    this.submitClicked(result.data); // Call the submitClicked function
    this.onClose.emit(result);
  }

  cancelDelete(): void {
    this.cancelClicked(); // Call the cancelClicked function
    this.onClose.emit({ state: 'cancel' });
  }
}
