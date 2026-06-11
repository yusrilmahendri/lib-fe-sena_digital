import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'wc-hero-section',
  templateUrl: './hero-section.component.html',
  styleUrls: ['./hero-section.component.scss'],
})
export class HeroSectionComponent {
  constructor(private router: Router) {}

  // Primary CTA -> invitation builder
  clickGenerateUndangan(): void {
    this.router.navigate(['/buat-undangan']);
  }

  // Secondary CTA -> scroll to themes/showcase section
  scrollToTema(): void {
    const el = document.getElementById('tema');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
