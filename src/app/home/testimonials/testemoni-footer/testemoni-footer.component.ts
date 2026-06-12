import { Component, OnInit } from '@angular/core';

interface PaymentMethod {
  name: string;
  logo: string;
  color: string;
  useText?: boolean;
  large?: boolean;
}

@Component({
  selector: 'wc-testemoni-footer',
  templateUrl: './testemoni-footer.component.html',
  styleUrls: ['./testemoni-footer.component.scss']
})
export class TestemoniFooterComponent implements OnInit {
  paymentMethods: PaymentMethod[] = [
    { name: 'VISA', logo: 'assets/landing/visa.png', color: '#1a1f71' },
    { name: 'OVO', logo: 'assets/landing/ovo.png', color: '#4c2a86' },
    { name: 'DANA', logo: 'assets/landing/dana.svg', color: '#118eea', large: true },
    { name: 'Mastercard', logo: 'assets/landing/mastercard.png', color: '#2a2a2a' },
    { name: 'GoPay', logo: 'assets/landing/gopay.svg', color: '#00aed6', large: true },
    { name: 'GPN', logo: 'assets/landing/gpn.svg', color: '#e2231a' },
    { name: 'ShopeePay', logo: 'assets/landing/shopepay.svg', color: '#ee4d2d', large: true },
    { name: 'QRIS', logo: 'assets/landing/qris.svg', color: '#221f6a' },
  ];

  constructor() { }

  ngOnInit(): void {
  }

}
