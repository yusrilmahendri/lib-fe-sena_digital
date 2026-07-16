import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import {
  DashboardService,
  ReligionContentData,
  ReligionContentMap,
} from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { ModalComponent } from 'src/app/shared/modal/modal.component';
import {
  RELIGION_DEFAULT_TEMPLATES,
  normalizeReligionCode,
  readReligionMapValue,
} from 'src/app/shared/religion-content.util';

type ReligionFieldKey =
  | 'opening_greeting'
  | 'closing_greeting'
  | 'invitation_intro'
  | 'whatsapp_opening'
  | 'whatsapp_message'
  | 'whatsapp_closing'
  | 'quote_text'
  | 'quote_source'
  | 'prayer_text'
  | 'blessing_text';

interface ReligionOption {
  code: string;
  label: string;
}

interface ReligionFieldConfig {
  key: ReligionFieldKey;
  label: string;
  helper: string;
  rows: number;
}

interface NormalizedReligionContent {
  religionCode: string;
  religionLabel: string;
  defaults: Record<ReligionFieldKey, string>;
  custom: Record<ReligionFieldKey, string>;
  resolved: Record<ReligionFieldKey, string>;
  flags: Record<ReligionFieldKey, boolean>;
}

@Component({
  selector: 'wc-penyesuaian-agama',
  templateUrl: './penyesuaian-agama.component.html',
  styleUrls: ['./penyesuaian-agama.component.scss'],
})
export class PenyesuaianAgamaComponent implements OnInit {
  readonly religionOptions: ReligionOption[] = [
    { code: 'islam', label: 'Islam' },
    { code: 'kristen', label: 'Kristen' },
    { code: 'katolik', label: 'Katolik' },
    { code: 'hindu', label: 'Hindu' },
    { code: 'buddha', label: 'Buddha' },
    { code: 'konghucu', label: 'Konghucu' },
    { code: 'umum', label: 'Umum' },
  ];

  readonly fields: ReligionFieldConfig[] = [
    {
      key: 'opening_greeting',
      label: 'Salam pembuka',
      helper: 'Teks awal yang tampil di undangan atau pesan pembuka.',
      rows: 3,
    },
    {
      key: 'closing_greeting',
      label: 'Salam penutup',
      helper: 'Teks penutup setelah isi undangan atau pesan.',
      rows: 3,
    },
    {
      key: 'invitation_intro',
      label: 'Intro undangan',
      helper: 'Kalimat pengantar utama pada undangan.',
      rows: 4,
    },
    {
      key: 'whatsapp_opening',
      label: 'Salam pembuka WhatsApp',
      helper: 'Teks paling atas saat undangan dibagikan via WhatsApp.',
      rows: 3,
    },
    {
      key: 'whatsapp_message',
      label: 'Pesan WhatsApp',
      helper: 'Template pesan saat undangan dibagikan via WhatsApp.',
      rows: 5,
    },
    {
      key: 'whatsapp_closing',
      label: 'Salam penutup WhatsApp',
      helper: 'Teks penutup setelah link undangan pada pesan WhatsApp.',
      rows: 3,
    },
    {
      key: 'quote_text',
      label: 'Quote text',
      helper: 'Isi kutipan yang tampil di undangan.',
      rows: 4,
    },
    {
      key: 'quote_source',
      label: 'Quote source',
      helper: 'Sumber atau referensi kutipan.',
      rows: 2,
    },
    {
      key: 'prayer_text',
      label: 'Prayer text',
      helper: 'Doa atau harapan yang menyesuaikan agama.',
      rows: 4,
    },
    {
      key: 'blessing_text',
      label: 'Blessing text',
      helper: 'Kalimat berkat atau restu untuk mempelai.',
      rows: 4,
    },
  ];

  form: FormGroup;
  content: NormalizedReligionContent | null = null;
  isLoading = false;
  isSaving = false;
  resettingField: ReligionFieldKey | null = null;
  isResettingAll = false;

  private modalRef?: BsModalRef;
  private readonly emptyContent: Record<ReligionFieldKey, string> = {
    opening_greeting: '',
    closing_greeting: '',
    invitation_intro: '',
    whatsapp_opening: '',
    whatsapp_message: '',
    whatsapp_closing: '',
    quote_text: '',
    quote_source: '',
    prayer_text: '',
    blessing_text: '',
  };
  private readonly aliases: Record<ReligionFieldKey, string[]> = {
    opening_greeting: ['opening_greeting', 'salam_pembuka', 'salam', 'salam_atas'],
    closing_greeting: ['closing_greeting', 'salam_penutup', 'salam_bawah'],
    invitation_intro: ['invitation_intro', 'intro_undangan', 'intro', 'message', 'opening_prayer'],
    whatsapp_opening: ['whatsapp_opening', 'opening_greeting', 'salam_atas', 'salam'],
    whatsapp_message: ['whatsapp_message', 'whatsapp_text', 'pesan_whatsapp', 'message'],
    whatsapp_closing: ['whatsapp_closing', 'closing_greeting', 'salam_bawah', 'penutup'],
    quote_text: ['quote_text', 'quote'],
    quote_source: ['quote_source', 'quote_author', 'quote_reference', 'source'],
    prayer_text: ['prayer_text', 'prayer', 'doa'],
    blessing_text: ['blessing_text', 'blessing', 'berkah'],
  };
  private readonly notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
  });

  constructor(
    private fb: FormBuilder,
    private dashboardSvc: DashboardService,
    private modalSvc: BsModalService
  ) {
    this.form = this.fb.group({
      religion_code: [''],
      opening_greeting: [''],
      closing_greeting: [''],
      invitation_intro: [''],
      whatsapp_opening: [''],
      whatsapp_message: [''],
      whatsapp_closing: [''],
      quote_text: [''],
      quote_source: [''],
      prayer_text: [''],
      blessing_text: [''],
    });
  }

  ngOnInit(): void {
    this.loadContent();
  }

  loadContent(): void {
    this.isLoading = true;
    this.dashboardSvc.getReligionContent().subscribe({
      next: (response) => {
        this.content = this.normalizeContent(response?.data || response);
        this.patchForm(this.content);
        this.notyf.success(response?.message || 'Konten agama berhasil dimuat.');
        this.isLoading = false;
      },
      error: (error) => {
        this.notyf.error(getFriendlyErrorMessage(error));
        this.isLoading = false;
      },
    });
  }

  chooseReligion(code: string): void {
    const religionCode = normalizeReligionCode(code);
    const currentContent = this.content || this.normalizeContent({
      religion_code: religionCode,
      custom: this.buildCustomPayload(),
    });

    this.form.patchValue({ religion_code: religionCode });
    this.content = this.resolveContentForReligion(
      {
        ...currentContent,
        custom: this.buildCustomPayload(),
      },
      religionCode
    );
  }

  saveChanges(): void {
    const religionCode = normalizeReligionCode(this.form.get('religion_code')?.value);

    if (!religionCode) {
      this.notyf.error('Pilih agama terlebih dahulu.');
      return;
    }

    this.isSaving = true;
    this.dashboardSvc.updateReligionContent({
      religion_code: religionCode,
      custom: this.buildCustomPayload(),
    }).subscribe({
      next: (response) => {
        this.content = this.normalizeContent(response?.data || response);
        this.patchForm(this.content);
        this.notyf.success(response?.message || 'Perubahan berhasil disimpan.');
        this.isSaving = false;
      },
      error: (error) => {
        this.notyf.error(getFriendlyErrorMessage(error));
        this.isSaving = false;
      },
    });
  }

  resetField(field: ReligionFieldKey): void {
    this.resettingField = field;
    this.dashboardSvc.resetReligionContent(field).subscribe({
      next: (response) => {
        this.content = this.normalizeContent(response?.data || response);
        this.patchForm(this.content);
        this.notyf.success(response?.message || 'Field berhasil direset.');
        this.resettingField = null;
      },
      error: (error) => {
        this.notyf.error(getFriendlyErrorMessage(error));
        this.resettingField = null;
      },
    });
  }

  confirmResetAll(): void {
    const initialState = {
      message: 'Apakah Anda yakin ingin mereset semua konten custom?',
      cancelClicked: () => this.modalRef?.hide(),
      submitClicked: () => this.resetAll(),
      submitMessage: 'Reset Semua',
    };

    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });
  }

  resetAll(): void {
    this.isResettingAll = true;
    this.dashboardSvc.resetReligionContent().subscribe({
      next: (response) => {
        this.content = this.normalizeContent(response?.data || response);
        this.patchForm(this.content);
        this.notyf.success(response?.message || 'Semua konten custom berhasil direset.');
        this.modalRef?.hide();
        this.isResettingAll = false;
      },
      error: (error) => {
        this.notyf.error(getFriendlyErrorMessage(error));
        this.isResettingAll = false;
      },
    });
  }

  getControl(field: ReligionFieldKey): FormControl {
    return this.form.get(field) as FormControl;
  }

  getDefault(field: ReligionFieldKey): string {
    return this.content?.defaults[field] || '-';
  }

  getCustom(field: ReligionFieldKey): string {
    return this.getControl(field)?.value || '';
  }

  getResolved(field: ReligionFieldKey): string {
    const customValue = this.getCustom(field).trim();
    return customValue || this.content?.resolved[field] || this.content?.defaults[field] || '-';
  }

  isCustom(field: ReligionFieldKey): boolean {
    return this.getCustom(field).trim().length > 0 || this.content?.flags[field] === true;
  }

  getSelectedReligionLabel(): string {
    const code = this.form.get('religion_code')?.value;
    return this.religionOptions.find((option) => option.code === code)?.label
      || this.content?.religionLabel
      || '-';
  }

  trackByField(index: number, field: ReligionFieldConfig): string {
    return field.key;
  }

  private buildCustomPayload(): Record<ReligionFieldKey, string> {
    return this.fields.reduce((payload, field) => {
      payload[field.key] = this.getCustom(field.key).trim();
      return payload;
    }, { ...this.emptyContent });
  }

  private patchForm(content: NormalizedReligionContent): void {
    this.form.patchValue({
      religion_code: content.religionCode,
      ...content.custom,
    });
  }

  private normalizeContent(raw: ReligionContentData | undefined): NormalizedReligionContent {
    const data = raw || {};
    const religionCode = normalizeReligionCode(data.religion_code || this.form.get('religion_code')?.value || '');
    const templateDefaults = this.getDefaultTemplate(religionCode);
    const defaults = this.normalizeMap(
      {
        ...templateDefaults,
        ...(data['default'] || {}),
        ...(data.defaults || {}),
      },
      data
    );
    const custom = this.normalizeMap(data.custom || {}, {} as ReligionContentData);
    const apiResolved = this.normalizeMap(data['resolved_final'] || data.resolved || {}, data);
    const resolved = this.fields.reduce((result, field) => {
      result[field.key] = custom[field.key] || apiResolved[field.key] || defaults[field.key] || '';
      return result;
    }, { ...this.emptyContent });
    const flags = this.normalizeFlags(data.flags || {}, custom);

    return {
      religionCode,
      religionLabel: String(data.religion_label || this.labelForReligion(religionCode) || '').trim(),
      defaults,
      custom,
      resolved,
      flags,
    };
  }

  private resolveContentForReligion(
    content: NormalizedReligionContent,
    religionCode: string
  ): NormalizedReligionContent {
    const defaults = this.getDefaultTemplate(religionCode);
    const custom = this.normalizeMap(content.custom || {}, {} as ReligionContentData);
    const resolved = this.fields.reduce((result, field) => {
      result[field.key] = custom[field.key] || defaults[field.key] || '';
      return result;
    }, { ...this.emptyContent });
    const flags = this.normalizeFlags({}, custom);

    return {
      religionCode,
      religionLabel: this.labelForReligion(religionCode),
      defaults,
      custom,
      resolved,
      flags,
    };
  }

  private getDefaultTemplate(religionCode: string): Record<ReligionFieldKey, string> {
    const template = RELIGION_DEFAULT_TEMPLATES[normalizeReligionCode(religionCode)] || {};

    return this.fields.reduce((result, field) => {
      result[field.key] = readReligionMapValue(template, field.key);
      return result;
    }, { ...this.emptyContent });
  }

  private normalizeMap(
    source: ReligionContentMap,
    fallbackSource: ReligionContentData
  ): Record<ReligionFieldKey, string> {
    return this.fields.reduce((result, field) => {
      result[field.key] = this.readFieldValue(source, field.key)
        || this.readFieldValue(fallbackSource, field.key)
        || '';
      return result;
    }, { ...this.emptyContent });
  }

  private normalizeFlags(
    flags: ReligionContentData['flags'],
    custom: Record<ReligionFieldKey, string>
  ): Record<ReligionFieldKey, boolean> {
    return this.fields.reduce((result, field) => {
      const rawFlag = flags?.[field.key];
      result[field.key] = rawFlag === true
        || rawFlag === 1
        || rawFlag === '1'
        || rawFlag === 'custom'
        || custom[field.key].trim().length > 0;
      return result;
    }, {} as Record<ReligionFieldKey, boolean>);
  }

  private readFieldValue(source: ReligionContentMap | ReligionContentData, key: ReligionFieldKey): string {
    const keys = this.aliases[key] || [key];
    const matchedKey = keys.find((alias) => source?.[alias] !== undefined && source?.[alias] !== null);
    return matchedKey ? String(source[matchedKey] || '').trim() : '';
  }

  private labelForReligion(code: string): string {
    return this.religionOptions.find((option) => option.code === code)?.label || '';
  }
}
