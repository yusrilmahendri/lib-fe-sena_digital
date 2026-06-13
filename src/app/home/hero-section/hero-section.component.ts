import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LandingModalService } from '../../landing-modal.service';

@Component({
  selector: 'wc-hero-section',
  templateUrl: './hero-section.component.html',
  styleUrls: ['./hero-section.component.scss'],
})
export class HeroSectionComponent {
  constructor(private router: Router, private modal: LandingModalService) {}

  // Primary CTA -> open the redesigned "Buat Undangan" modal wizard.
  clickGenerateUndangan(): void {
    this.modal.openCreateInvitation();
  }

  // Secondary CTA -> scroll to themes/showcase section
  scrollToTema(): void {
    const el = document.getElementById('tema');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
