import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'wc-guest-checkin-landing',
  templateUrl: './guest-checkin-landing.component.html',
  styleUrls: ['./guest-checkin-landing.component.scss'],
})
export class GuestCheckinLandingComponent implements OnInit {
  guestToken = '';
  domain = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.domain = String(this.route.snapshot.paramMap.get('coupleName') || '').trim();
    this.guestToken = String(this.route.snapshot.queryParamMap.get('token') || '').trim();
  }
}
