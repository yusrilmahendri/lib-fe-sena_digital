import { Component } from '@angular/core';
import { LavenderBloomThemeComponent } from '../../themes/lavender-bloom/lavender-bloom-theme.component';

@Component({
  selector: 'wc-ruby-theme-one',
  templateUrl: './ruby-theme-one.component.html',
  styleUrls: ['./ruby-theme-one.component.scss'],
})
export class RubyThemeOneComponent extends LavenderBloomThemeComponent {
  getBrideParents(): string {
    return this.getParentsText(this.getBride(), 'wanita');
  }

  getGroomParents(): string {
    return this.getParentsText(this.getGroom(), 'pria');
  }
}
