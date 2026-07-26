import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Notyf } from 'notyf';
import Swal from 'sweetalert2';
import { DashboardService } from 'src/app/dashboard.service';

type ReligionTemplateField =
  | 'opening_heading'
  | 'opening_text'
  | 'closing_text'
  | 'whatsapp_message'
  | 'quote_text'
  | 'quote_source';

type EditorTab = 'opening' | 'closing' | 'quote' | 'whatsapp';
type PreviewTab = 'invitation' | 'whatsapp';

interface AdminReligionTemplate {
  id?: number | null;
  religion_key: string;
  religion_name: string;
  opening_heading: string;
  opening_text: string;
  closing_text: string;
  whatsapp_message: string;
  quote_text: string;
  quote_source: string;
  active: boolean;
  version?: string | number | null;
  updated_at?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  admin_name?: string | null;
  content_json?: Record<string, any> | null;
}

@Component({
  selector: 'wc-religion-templates',
  templateUrl: './religion-templates.component.html',
  styleUrls: ['./religion-templates.component.scss'],
})
export class ReligionTemplatesComponent implements OnInit {
  readonly allowedPlaceholders = [
    '{{guest_name}}',
    '{{bride_name}}',
    '{{groom_name}}',
    '{{event_date}}',
    '{{event_location}}',
    '{{invitation_url}}',
  ];

  readonly religionLabels: Record<string, string> = {
    islam: 'Islam',
    kristen: 'Kristen',
    katolik: 'Katolik',
    hindu: 'Hindu',
    buddha: 'Buddha',
    konghucu: 'Konghucu',
    universal: 'Universal',
  };

  readonly previewData: Record<string, string> = {
    guest_name: 'Tamu Undangan',
    bride_name: 'Salsa',
    groom_name: 'Anji',
    event_date: '30 Juli 2026',
    event_location: 'Gedung Serbaguna',
    invitation_url: 'https://www.sena-digital.com/wedding/anji-salsa',
  };

  templates: AdminReligionTemplate[] = [];
  selectedTemplate: AdminReligionTemplate | null = null;
  form!: FormGroup;
  createForm!: FormGroup;
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  isLoading = false;
  isSaving = false;
  isCreating = false;
  showCreateModal = false;
  activeEditorTab: EditorTab = 'opening';
  activePreviewTab: PreviewTab = 'invitation';
  activePlaceholderTarget: ReligionTemplateField = 'opening_text';

  private readonly notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly dashboardService: DashboardService
  ) {
    this.initializeForm();
    this.initializeCreateForm();
  }

  ngOnInit(): void {
    this.loadTemplates();
  }

  get filteredTemplates(): AdminReligionTemplate[] {
    const keyword = this.searchTerm.trim().toLowerCase();

    return this.templates.filter((item) => {
      const matchesStatus =
        this.statusFilter === 'all' ||
        (this.statusFilter === 'active' && item.active) ||
        (this.statusFilter === 'inactive' && !item.active);
      const matchesKeyword =
        !keyword ||
        item.religion_name.toLowerCase().includes(keyword) ||
        item.religion_key.toLowerCase().includes(keyword);

      return matchesStatus && matchesKeyword;
    });
  }

  get isEditMode(): boolean {
    return !!this.selectedTemplate?.id && !this.isCreating;
  }

  get activeTemplateCount(): number {
    return this.templates.filter((template) => template.active).length;
  }

  get selectedAdminLabel(): string {
    return this.selectedTemplate?.updated_by_name ||
      this.selectedTemplate?.updated_by ||
      this.selectedTemplate?.admin_name ||
      '-';
  }

  get resolvedWhatsappPreview(): string {
    return this.preview('whatsapp_message') || 'Pesan WhatsApp belum diisi.';
  }

  loadTemplates(): void {
    this.isLoading = true;
    this.dashboardService.getAdminReligionTemplates().subscribe({
      next: (response) => {
        this.templates = this.extractTemplateRows(response).map((item) => this.normalizeTemplate(item));
        if (this.templates.length && !this.selectedTemplate) {
          this.selectTemplate(this.templates[0]);
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.notyf.error(this.resolveErrorMessage(error, 'Gagal memuat template agama.'));
        this.templates = [];
        this.isLoading = false;
      },
    });
  }

  selectTemplate(template: AdminReligionTemplate): void {
    this.selectedTemplate = template;
    this.isCreating = false;
    this.activeEditorTab = 'opening';
    this.activePlaceholderTarget = 'opening_text';
    this.patchForm(template);
  }

  startCreate(): void {
    this.openCreateModal();
  }

  openCreateModal(): void {
    this.createForm.reset({
      religion_key: 'universal',
      religion_name: 'Universal',
      active: true,
    });
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createTemplateDraft(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.value;
    this.selectedTemplate = null;
    this.isCreating = true;
    this.form.reset({
      religion_key: value.religion_key,
      religion_name: value.religion_name,
      opening_heading: '',
      opening_text: '',
      closing_text: '',
      whatsapp_message: '',
      quote_text: '',
      quote_source: '',
      active: value.active === true,
    });
    this.activeEditorTab = 'opening';
    this.activePreviewTab = 'invitation';
    this.activePlaceholderTarget = 'opening_text';
    this.showCreateModal = false;
  }

  saveTemplate(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      this.notyf.error('Lengkapi template agama dengan benar.');
      return;
    }

    const payload = this.buildPayload();
    this.isSaving = true;

    const request = this.isEditMode && this.selectedTemplate?.id
      ? this.dashboardService.updateAdminReligionTemplate(this.selectedTemplate.id, payload)
      : this.dashboardService.createAdminReligionTemplate(payload);

    request.subscribe({
      next: (response) => {
        const updated = this.normalizeTemplate(this.extractSingleTemplate(response) || payload);
        this.upsertTemplate(updated);
        this.selectTemplate(updated);
        this.isCreating = false;
        this.notyf.success(response?.message || 'Template agama berhasil disimpan.');
        this.isSaving = false;
      },
      error: (error) => {
        this.notyf.error(this.resolveErrorMessage(error, 'Template agama gagal disimpan.'));
        this.isSaving = false;
      },
    });
  }

  async toggleStatus(template: AdminReligionTemplate): Promise<void> {
    if (!template.id) return;

    const nextActive = !template.active;
    if (!nextActive) {
      const result = await Swal.fire({
        title: 'Nonaktifkan template?',
        text: 'Jika template ini dinonaktifkan, user akan menggunakan template Universal aktif.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, nonaktifkan',
        cancelButtonText: 'Batal',
        reverseButtons: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#94a3b8',
        width: 460,
      });

      if (!result.isConfirmed) return;
    }

    this.dashboardService.updateAdminReligionTemplateStatus(template.id, nextActive).subscribe({
      next: (response) => {
        const updated = this.normalizeTemplate(this.extractSingleTemplate(response) || { ...template, active: nextActive });
        this.upsertTemplate(updated);
        if (this.selectedTemplate?.id === template.id) this.selectTemplate(updated);
        this.notyf.success(response?.message || 'Status template agama berhasil diperbarui.');
      },
      error: (error) => {
        this.notyf.error(this.resolveErrorMessage(error, 'Gagal memperbarui status template.'));
      },
    });
  }

  async deleteTemplate(template: AdminReligionTemplate): Promise<void> {
    if (!template.id) return;

    const result = await Swal.fire({
      title: 'Hapus template agama?',
      text: `Template ${template.religion_name} akan dihapus. User akan fallback ke template Universal aktif.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#94a3b8',
      width: 460,
    });

    if (!result.isConfirmed) return;

    this.dashboardService.deleteAdminReligionTemplate(template.id).subscribe({
      next: (response) => {
        this.templates = this.templates.filter((item) => item.id !== template.id);
        if (this.selectedTemplate?.id === template.id) {
          this.selectedTemplate = null;
          this.isCreating = false;
          if (this.templates.length) {
            this.selectTemplate(this.templates[0]);
          } else {
            this.form.reset();
          }
        }
        this.notyf.success(response?.message || 'Template agama berhasil dihapus.');
      },
      error: (error) => {
        this.notyf.error(this.resolveErrorMessage(error, 'Template agama gagal dihapus.'));
      },
    });
  }

  insertPlaceholder(placeholder: string, controlName: ReligionTemplateField = this.activePlaceholderTarget): void {
    if (!this.allowedPlaceholders.includes(placeholder)) return;
    const control = this.form.get(controlName);
    control?.setValue(`${control?.value || ''}${placeholder}`);
    control?.markAsDirty();
  }

  setEditorTab(tab: EditorTab): void {
    this.activeEditorTab = tab;
    const targetByTab: Record<EditorTab, ReligionTemplateField> = {
      opening: 'opening_text',
      closing: 'closing_text',
      quote: 'quote_text',
      whatsapp: 'whatsapp_message',
    };
    this.activePlaceholderTarget = targetByTab[tab];
  }

  setPlaceholderTarget(controlName: ReligionTemplateField): void {
    this.activePlaceholderTarget = controlName;
  }

  onEditorActiveToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (this.isCreating || !this.selectedTemplate?.id) {
      this.form.patchValue({ active: checked });
      this.form.markAsDirty();
      return;
    }

    (event.target as HTMLInputElement).checked = this.selectedTemplate.active;
    this.toggleStatus(this.selectedTemplate);
  }

  preview(controlName: ReligionTemplateField): string {
    return this.replacePlaceholders(this.form.get(controlName)?.value || '');
  }

  formatShortDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
  }

  formatFullDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  getStatusLabel(template: AdminReligionTemplate): string {
    return template.active ? 'Aktif' : 'Nonaktif';
  }

  trackByTemplateId(index: number, template: AdminReligionTemplate): string {
    return String(template.id || template.religion_key || index);
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      religion_key: ['', [Validators.required, Validators.pattern(/^(islam|kristen|katolik|hindu|buddha|konghucu|universal)$/)]],
      religion_name: ['', [Validators.required, Validators.maxLength(80)]],
      opening_heading: ['', [Validators.maxLength(255)]],
      opening_text: ['', [Validators.required]],
      closing_text: ['', [Validators.required]],
      whatsapp_message: ['', [Validators.required]],
      quote_text: [''],
      quote_source: [''],
      active: [true],
    });
  }

  private initializeCreateForm(): void {
    this.createForm = this.fb.group({
      religion_key: ['universal', [Validators.required, Validators.pattern(/^(islam|kristen|katolik|hindu|buddha|konghucu|universal)$/)]],
      religion_name: ['Universal', [Validators.required, Validators.maxLength(80)]],
      active: [true],
    });
  }

  private patchForm(template: AdminReligionTemplate): void {
    this.form.patchValue({
      religion_key: template.religion_key,
      religion_name: template.religion_name,
      opening_heading: template.opening_heading,
      opening_text: template.opening_text,
      closing_text: template.closing_text,
      whatsapp_message: template.whatsapp_message,
      quote_text: template.quote_text,
      quote_source: template.quote_source,
      active: template.active,
    });
    this.form.markAsPristine();
  }

  private buildPayload(): any {
    const value = this.form.value;
    return {
      religion_key: value.religion_key,
      religion_name: value.religion_name,
      opening_heading: value.opening_heading || '',
      opening_text: value.opening_text || '',
      closing_text: value.closing_text || '',
      whatsapp_message: value.whatsapp_message || '',
      quote_text: value.quote_text || '',
      quote_source: value.quote_source || '',
      active: value.active === true,
    };
  }

  private normalizeTemplate(raw: any): AdminReligionTemplate {
    const content = raw?.content_json || raw?.content || {};
    const religionKey = String(raw?.religion_key || raw?.key || content?.religion_key || '').trim().toLowerCase();
    const normalizedKey = this.normalizeReligionKey(religionKey);

    return {
      id: this.toNullableNumber(raw?.id),
      religion_key: normalizedKey,
      religion_name: String(raw?.religion_name || raw?.name || content?.religion_name || this.religionLabels[normalizedKey] || normalizedKey).trim(),
      opening_heading: String(raw?.opening_heading ?? content?.opening_heading ?? ''),
      opening_text: String(raw?.opening_text ?? content?.opening_text ?? ''),
      closing_text: String(raw?.closing_text ?? content?.closing_text ?? ''),
      whatsapp_message: String(raw?.whatsapp_message ?? content?.whatsapp_message ?? ''),
      quote_text: String(raw?.quote_text ?? content?.quote_text ?? ''),
      quote_source: String(raw?.quote_source ?? content?.quote_source ?? ''),
      active: this.toBoolean(raw?.active ?? raw?.is_active ?? content?.active),
      version: raw?.version ?? content?.version ?? null,
      updated_at: raw?.updated_at ?? raw?.updatedAt ?? null,
      updated_by: raw?.updated_by ?? raw?.updated_by_name ?? raw?.admin?.name ?? null,
      updated_by_name: raw?.updated_by_name ?? raw?.updatedBy?.name ?? raw?.admin?.name ?? null,
      admin_name: raw?.admin_name ?? raw?.admin?.name ?? null,
      content_json: content,
    };
  }

  private extractTemplateRows(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data?.items)) return response.data.items;
    if (Array.isArray(response?.data?.templates)) return response.data.templates;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.templates)) return response.templates;
    return [];
  }

  private extractSingleTemplate(response: any): any | null {
    return response?.data?.template || response?.data || response?.template || null;
  }

  private upsertTemplate(template: AdminReligionTemplate): void {
    const index = this.templates.findIndex((item) =>
      (template.id && item.id === template.id) || item.religion_key === template.religion_key
    );

    if (index >= 0) {
      this.templates = this.templates.map((item, itemIndex) => itemIndex === index ? template : item);
      return;
    }

    this.templates = [template, ...this.templates];
  }

  private replacePlaceholders(value: string): string {
    return String(value || '').replace(/\{\{\s*(guest_name|bride_name|groom_name|event_date|event_location|invitation_url)\s*\}\}/g, (_match, key) => {
      return this.previewData[key] || '';
    });
  }

  private normalizeReligionKey(key: string): string {
    const aliases: Record<string, string> = {
      christian: 'kristen',
      catholic: 'katolik',
      buddhist: 'buddha',
      confucian: 'konghucu',
      umum: 'universal',
    };
    return aliases[key] || key || 'universal';
  }

  private toBoolean(value: any): boolean {
    return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
  }

  private toNullableNumber(value: any): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    return error?.error?.message || error?.message || fallback;
  }
}
