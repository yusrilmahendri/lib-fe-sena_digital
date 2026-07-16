import { Component, OnInit, Input } from '@angular/core';
import { WeddingData } from '../../../services/wedding-data.service';
import { resolveSalamPembuka } from '../../../shared/salam-defaults';
import {
  getReligionContentFromData,
  getResolvedReligionValue,
} from '../../../shared/religion-content.util';

@Component({
  selector: 'wc-couple-view',
  templateUrl: './couple-view.component.html',
  styleUrls: ['./couple-view.component.scss']
})
export class CoupleViewComponent implements OnInit {
  @Input() weddingData: WeddingData | null = null;

  constructor() { }

  ngOnInit(): void {
    console.log('CoupleViewComponent initialized with weddingData:', this.weddingData);
  }

  getGroomName(): string {
    return this.weddingData?.mempelai?.pria?.nama_lengkap || 'Groom Name';
  }

  getBrideName(): string {
    return this.weddingData?.mempelai?.wanita?.nama_lengkap || 'Bride Name';
  }

  getGroomParents(): string {
    const pria = this.weddingData?.mempelai?.pria;
    if (pria?.ayah && pria?.ibu) {
      return `Putra dari Bapak ${pria.ayah} dan Ibu ${pria.ibu}`;
    }
    return 'Putra dari Bapak [Ayah] dan Ibu [Ibu]';
  }

  getBrideParents(): string {
    const wanita = this.weddingData?.mempelai?.wanita;
    if (wanita?.ayah && wanita?.ibu) {
      return `Putri dari Bapak ${wanita.ayah} dan Ibu ${wanita.ibu}`;
    }
    return 'Putri dari Bapak [Ayah] dan Ibu [Ibu]';
  }

  getOpeningText(): string {
    const data: any = this.weddingData || {};
    const religionText = getResolvedReligionValue(
      getReligionContentFromData(data),
      'salam_pembuka',
      'invitation_intro',
      'opening_prayer',
      'message',
      'opening_greeting'
    );

    if (religionText) {
      return resolveSalamPembuka(religionText);
    }

    const source =
      data?.settings ||
      data?.setting ||
      data?.testimoni ||
      data?.data?.setting ||
      {};
    const text = String(source?.salam_pembuka ?? '').trim();

    return resolveSalamPembuka(text);
  }
}
