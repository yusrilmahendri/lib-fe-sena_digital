import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'wc-bill-user',
  templateUrl: './bill-user.component.html',
  styleUrls: ['./bill-user.component.scss']
})
export class BillUserComponent implements OnInit {

  paymentStatusMessage = '';

  constructor() { }

  ngOnInit() {
    this.paymentStatusMessage = history.state?.paymentStatusMessage || '';
  }

}
