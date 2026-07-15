import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { BsDatepickerConfig } from 'ngx-bootstrap/datepicker';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { ModalComponent } from 'src/app/shared/modal/modal.component';

interface Acara {
  id: string | null;
  nama_acara: string;
  tanggal_acara: string | Date | null;
  start_acara: string;
  end_acara: string;
  alamat: string;
  link_maps: string;
  address?: string;
  location_name?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  google_maps_url?: string;
  place_id?: string;
  countdown?: Countdown;
}

interface Countdown {
  id: string;
  name_countdown: string;
}

@Component({
  selector: 'wc-acara',
  templateUrl: './acara.component.html',
  styleUrls: ['./acara.component.scss'],
})
export class AcaraComponent implements OnInit {
  staticEventForm!: FormGroup;
  dynamicEventForm!: FormGroup;

  events: ReadonlyArray<{ id: string | null; name: string }> = [];
  bsConfig!: Partial<BsDatepickerConfig>;

  modalRef?: BsModalRef;

  private notyf: Notyf;
  selectedEvent: string | null = null;
  data: Acara[] = [];
  isLoading = false;
  countdownData: Countdown | null = null;
  userID: any;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dashboardSvc: DashboardService,
    private readonly modalSvc: BsModalService
  ) {
    this.notyf = new Notyf({ duration: 3000, position: { x: 'right', y: 'top' } });
  }

  ngOnInit(): void {
    this.initForms();
    this.fetchInitialData();
  }

  private initForms(): void {
    this.staticEventForm = this.fb.group({
      selectedEvent: [null, Validators.required],
    });

    this.dynamicEventForm = this.fb.group({
      dynamicEvents: this.fb.array([]),
    });

    this.bsConfig = {
      dateInputFormat: 'DD MMMM YYYY',
      showTodayButton: true,
      isAnimated: true,
      containerClass: 'theme-dark-blue',
    };
  }

  get dynamicEvents(): FormArray {
    return this.dynamicEventForm.get('dynamicEvents') as FormArray;
  }

  private createDynamicEventForm(eventData?: Partial<Acara>): FormGroup {
    const normalizedLocation = this.normalizeLocationData(eventData);

    return this.fb.group({
      id: [eventData?.id ?? null],
      nama_acara: [eventData?.nama_acara ?? '', Validators.required],
      tanggal_acara: [
        eventData?.tanggal_acara
          ? new Date(eventData.tanggal_acara)
          : null,
        Validators.required,
      ],
      start_acara: [eventData?.start_acara ?? '', Validators.required],
      end_acara: [eventData?.end_acara ?? '', Validators.required],
      alamat: [normalizedLocation.address],
      address: [normalizedLocation.address],
      location_name: [normalizedLocation.location_name],
      latitude: [normalizedLocation.latitude],
      longitude: [normalizedLocation.longitude],
      link_maps: [normalizedLocation.google_maps_url],
      google_maps_url: [normalizedLocation.google_maps_url],
      place_id: [normalizedLocation.place_id],
    }, { validators: this.locationValidator });
  }

  addDynamicEvent(): void {
    this.dynamicEvents.push(this.createDynamicEventForm());
  }

  deleteDynamicEvent(index: number): void {
    if (this.dynamicEvents.length > 1) {
      const eventToDelete = this.dynamicEvents.at(index)?.value as Acara;


      if (eventToDelete?.id) {
        const initialState = {
          message: `Apakah anda ingin menghapus acara "${eventToDelete.nama_acara}"?`,
          cancelClicked: () => '',
          submitClicked: () => this.confirmDeleteDynamicEvent(index, eventToDelete),
          submitMessage: 'Hapus',
        };

        this.showModal(initialState);
      } else {

        this.dynamicEvents.removeAt(index);
      }
    }
  }

  private confirmDeleteDynamicEvent(index: number, eventData: Acara): void {
    if (!eventData.id) {
      this.notyf.error('ID acara tidak ditemukan.');
      return;
    }

    this.isLoading = true;

    const payload = {
      id: eventData.id,
    };

    this.dashboardSvc.delete(DashboardServiceType.ACARA_SUBMIT_DELETE_DYNAMIC, payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.notyf.success(res?.message ?? 'Acara berhasil dihapus.');
        this.dynamicEvents.removeAt(index);
        this.fetchInitialData();
      },
      error: (err) => {
        this.isLoading = false;
        this.notyf.error(getFriendlyErrorMessage(err) || 'Gagal menghapus acara. Silakan coba lagi.');
      }
    });
  }

  fetchInitialData(): void {
    this.isLoading = true;
    this.dashboardSvc.list(DashboardServiceType.ACARA_DATA).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.data = (res?.data?.acaras as Acara[]) ?? [];

        if (this.data.length > 0) {
          this.countdownData = this.data[0].countdown ?? null;
          this.userID = res?.data?.acaras[0].user_id ?? null;
          this.staticEventForm.patchValue({
            selectedEvent: this.countdownData?.name_countdown ?? null,
          });

          while (this.dynamicEvents.length !== 0) {
            this.dynamicEvents.removeAt(0);
          }

          this.data.forEach((acara) => {
            this.dynamicEvents.push(this.createDynamicEventForm(acara));
          });
        } else {
          this.dynamicEvents.push(this.createDynamicEventForm());
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.notyf.error(getFriendlyErrorMessage(err));
        if (this.dynamicEvents.length === 0) {
          this.dynamicEvents.push(this.createDynamicEventForm());
        }
      },
    });
  }

  onEventSelect(event: string): void {
    this.selectedEvent = event;
  }

  onStaticSubmitClicked(): void {
    if (this.staticEventForm.valid) {
      const initialState = {
        message: 'Apakah anda ingin mengunggah countdown ini?',
        cancelClicked: () => '',
        submitClicked: () => this.submitStaticEventForm(),
        submitMessage: 'Simpan',
      };

      this.showModal(initialState);
    }
  }

  onDynamicSubmitClicked(): void {
    if (!this.hasSelectedCountdown()) {
      this.staticEventForm.get('selectedEvent')?.markAsTouched();
      this.notyf.error('Nama countdown acara belum diisi. Silakan isi dan simpan countdown terlebih dahulu sebelum menyimpan data acara.');
      return;
    }

    if (this.dynamicEventForm.valid && this.hasMinimumLocationData()) {
      const message =
        this.data.length > 0
          ? 'Apakah anda ingin mengubah data acara ini?'
          : 'Apakah anda ingin menyimpan data acara ini?';

      const initialState = {
        message,
        cancelClicked: () => '',
        submitClicked: () => this.submitDynamicEventForm(),
        submitMessage: 'Simpan',
      };

      this.showModal(initialState);
    } else {
      this.markFormGroupTouched(this.dynamicEventForm);
      this.notyf.error(this.getLocationValidationMessage() || 'Form tidak valid. Harap periksa data acara.');
    }
  }

  onStaticUpdateClicked(): void {
    if (this.staticEventForm.valid) {
      const initialState = {
        message: 'Apakah anda ingin mengubah countdown ini?',
        cancelClicked: () => '',
        submitClicked: () => this.updateStaticEventForm(),
        submitMessage: 'Simpan',
      };

      this.showModal(initialState);
    }
  }

  private showModal(initialState: any): void {
    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });

    if (this.modalRef?.content) {
      this.modalRef.content.onClose.subscribe((res: { state: string }) => {
        if (res?.state === 'delete' || res?.state === 'cancel') {
          this.modalRef?.hide();
        }
        this.modalRef?.hide();
      });
    }
  }

  submitStaticEventForm(): void {
    if (this.staticEventForm.valid) {
      this.isLoading = true;
      const { selectedEvent } = this.staticEventForm.value;
      const payload = { name_countdown: selectedEvent };

      this.dashboardSvc.create(DashboardServiceType.ACARA_SUBMIT_COUNTDOWN, payload).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.notyf.success(res?.message ?? 'Countdown berhasil disimpan.');
          this.fetchInitialData();
        },
        error: (err) => {
          this.isLoading = false;
          this.notyf.error(getFriendlyErrorMessage(err));
        },
      });
    }
  }

  updateStaticEventForm(): void {
    if (this.staticEventForm.valid && this.countdownData?.id) {
      this.isLoading = true;
      const { selectedEvent } = this.staticEventForm.value;
      const payload = { name_countdown: selectedEvent };

      this.dashboardSvc
        .update(DashboardServiceType.ACARA_SUBMIT_UPDATE_COUNTDOWN, this.countdownData.id, payload)
        .subscribe({
          next: (res) => {
            this.isLoading = false;
            this.notyf.success(res?.message ?? 'Countdown berhasil diperbarui.');
            this.fetchInitialData();
          },
          error: (err) => {
            this.isLoading = false;
            this.notyf.error(getFriendlyErrorMessage(err));
          },
        });
    }
  }

submitDynamicEventForm(): void {
  if (!this.hasSelectedCountdown()) {

    this.staticEventForm.get('selectedEvent')?.markAsTouched();

    this.notyf.error('Nama countdown acara belum diisi. Silakan isi dan simpan countdown terlebih dahulu sebelum menyimpan data acara.');

    return;

  }
  if (this.dynamicEventForm.valid && this.hasMinimumLocationData()) {
    this.isLoading = true;
    const events = (this.dynamicEvents.value as Acara[]).map(event => this.prepareEventLocationPayload(event));


    const eventsToCreate = events.filter(event => !event.id);
    const eventsToUpdate = events.filter(event => !!event.id);

    const promises: any[] = [];


    if (eventsToCreate.length > 0) {
      const createPayload = {
        jenis_acara: eventsToCreate.map(event => (event as any).jenis_acara || event.nama_acara || ''),
        nama_acara: eventsToCreate.map(event => event.nama_acara || (event as any).jenis_acara || ''),
        tanggal_acara: eventsToCreate.map(event =>
          event.tanggal_acara instanceof Date
            ? event.tanggal_acara.toISOString().split('T')[0]
            : event.tanggal_acara
        ),
        start_acara: eventsToCreate.map(event => event.start_acara),
        end_acara: eventsToCreate.map(event => event.end_acara),
        alamat: eventsToCreate.map(event => event.alamat),
        link_maps: eventsToCreate.map(event => event.link_maps),
        address: eventsToCreate.map(event => event.address || event.alamat || ''),
        location_name: eventsToCreate.map(event => event.location_name || ''),
        latitude: eventsToCreate.map(event => event.latitude || ''),
        longitude: eventsToCreate.map(event => event.longitude || ''),
        google_maps_url: eventsToCreate.map(event => event.google_maps_url || event.link_maps || ''),
        place_id: eventsToCreate.map(event => event.place_id || ''),
      };

      // console.log('[SubmissionAcaraPayload]', createPayload);

      const createPromise = this.dashboardSvc.create(DashboardServiceType.ACARA_SUBMIT_DYNAMIC, createPayload);
      promises.push(createPromise);
    }


    if (eventsToUpdate.length > 0) {
      const updatePayload = eventsToUpdate.map(event => ({
        id: event.id,
        jenis_acara: (event as any).jenis_acara || event.nama_acara || '',
        nama_acara: event.nama_acara || (event as any).jenis_acara || '',
        tanggal_acara: event.tanggal_acara instanceof Date
          ? event.tanggal_acara.toISOString().split('T')[0]
          : event.tanggal_acara,
        start_acara: event.start_acara,
        end_acara: event.end_acara,
        alamat: event.alamat,
        link_maps: event.link_maps,
        address: event.address || event.alamat || '',
        location_name: event.location_name || '',
        latitude: event.latitude || '',
        longitude: event.longitude || '',
        google_maps_url: event.google_maps_url || event.link_maps || '',
        place_id: event.place_id || '',
      }));

      const finalUpdatePayload = {
        data: updatePayload
      };

      const updatePromise = this.dashboardSvc.update(DashboardServiceType.ACARA_SUBMIT_UPDATE_DYNAMIC, '', finalUpdatePayload);
      promises.push(updatePromise);
    }


    if (promises.length > 0) {

      import('rxjs').then(({ forkJoin }) => {
        forkJoin(promises).subscribe({
          next: (responses) => {
            this.isLoading = false;
            let successMessage = '';

            if (eventsToCreate.length > 0 && eventsToUpdate.length > 0) {
              successMessage = 'Data acara dan lokasi berhasil disimpan dan diperbarui.';
            } else if (eventsToCreate.length > 0) {
              successMessage = 'Data lokasi acara berhasil disimpan.';
            } else {
              successMessage = 'Data acara dan lokasi berhasil diperbarui.';
            }

            this.notyf.success(successMessage);
            this.fetchInitialData();
          },
          error: (err) => {
            this.isLoading = false;
            this.notyf.error(getFriendlyErrorMessage(err));
          }
        });
      });
    } else {
      this.isLoading = false;
      this.notyf.error('Tidak ada data untuk disimpan.');
    }
  } else {
    this.markFormGroupTouched(this.dynamicEventForm);
    this.notyf.error(this.getLocationValidationMessage() || 'Form tidak valid. Harap periksa data acara.');
  }
}

  formatDate(date: string | Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  hasExistingData(): boolean {
    return this.data.length > 0;
  }

  syncAddressAlias(index: number): void {
    const form = this.dynamicEvents.at(index) as FormGroup;
    const address = String(form.get('address')?.value || '').trim();
    form.patchValue({ alamat: address }, { emitEvent: false });
  }

  syncMapsUrlAlias(index: number): void {
    const form = this.dynamicEvents.at(index) as FormGroup;
    const mapsUrl = String(form.get('google_maps_url')?.value || '').trim();
    form.patchValue({ link_maps: mapsUrl }, { emitEvent: false });
    this.applyCoordinatesFromMapsUrl(index, false);
  }

  openGoogleMapsPicker(index: number): void {
    const form = this.dynamicEvents.at(index) as FormGroup;
    const query = [
      form.get('location_name')?.value,
      form.get('address')?.value,
      form.get('latitude')?.value && form.get('longitude')?.value
        ? `${form.get('latitude')?.value},${form.get('longitude')?.value}`
        : '',
    ].map(value => String(value || '').trim()).find(value => !!value);

    const url = query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : 'https://www.google.com/maps';

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  applyCoordinatesFromMapsUrl(index: number, showMessage = true): void {
    const form = this.dynamicEvents.at(index) as FormGroup;
    const mapsUrl = String(form.get('google_maps_url')?.value || form.get('link_maps')?.value || '').trim();

    if (!mapsUrl) {
        if (showMessage) {
          this.notyf.error('Masukkan link Google Maps terlebih dahulu.');
        }
      return;
    }

    const coordinates = this.extractCoordinates(mapsUrl);
      if (!coordinates) {
        if (showMessage) {
          this.notyf.error(
              'Koordinat tidak ditemukan. Link tetap bisa disimpan. Untuk ambil koordinat otomatis, gunakan link Google Maps panjang.'
          );
        }
        return;
      }

    form.patchValue({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      link_maps: mapsUrl,
      google_maps_url: mapsUrl,
    }, { emitEvent: false });

    form.updateValueAndValidity();

    if (showMessage) {
      this.notyf.success('Koordinat berhasil diambil dari link Google Maps.');
    }
  }

  useManualCoordinates(index: number): void {
    const form = this.dynamicEvents.at(index) as FormGroup;
    const latitude = String(form.get('latitude')?.value || '').trim();
    const longitude = String(form.get('longitude')?.value || '').trim();

    if (!latitude || !longitude) {
      this.notyf.error('Latitude dan longitude harus diisi berpasangan.');
      return;
    }

    const googleMapsUrl = this.buildGoogleMapsUrl(latitude, longitude);
    form.patchValue({
      link_maps: googleMapsUrl,
      google_maps_url: googleMapsUrl,
    }, { emitEvent: false });
    form.updateValueAndValidity();
    this.notyf.success('Lokasi berhasil dipilih.');
  }

  resetLocation(index: number): void {
    const form = this.dynamicEvents.at(index) as FormGroup;
    form.patchValue({
      location_name: '',
      latitude: '',
      longitude: '',
      link_maps: '',
      google_maps_url: '',
      place_id: '',
    });
    this.notyf.success('Titik lokasi berhasil dihapus. Alamat manual tetap bisa disimpan.');
  }

  getSelectedCoordinates(index: number): string {
    const form = this.dynamicEvents.at(index) as FormGroup;
    const latitude = String(form.get('latitude')?.value || '').trim();
    const longitude = String(form.get('longitude')?.value || '').trim();

    return latitude && longitude ? `${latitude}, ${longitude}` : 'Belum ada koordinat terpilih';
  }

  getMapsPreviewUrl(index: number): string {
    const form = this.dynamicEvents.at(index) as FormGroup;
    const mapsUrl = String(form.get('google_maps_url')?.value || form.get('link_maps')?.value || '').trim();
    const latitude = String(form.get('latitude')?.value || '').trim();
    const longitude = String(form.get('longitude')?.value || '').trim();

    return mapsUrl || (latitude && longitude ? this.buildGoogleMapsUrl(latitude, longitude) : '');
  }

  private normalizeLocationData(eventData?: Partial<Acara>): Required<Pick<Acara, 'alamat' | 'address' | 'location_name' | 'link_maps' | 'google_maps_url' | 'place_id'>> & Pick<Acara, 'latitude' | 'longitude'> {
    const data = eventData as any;
    const address = String(data?.address || data?.alamat || data?.location_name || '').trim();
    const locationName = String(data?.location_name || data?.nama_lokasi || data?.nama_tempat || '').trim();
    const latitude = data?.latitude ?? data?.lat ?? '';
    const longitude = data?.longitude ?? data?.lng ?? data?.long ?? '';
    const googleMapsUrl = String(data?.google_maps_url || data?.link_maps || data?.maps_url || data?.map_url || '').trim();

    return {
      alamat: address,
      address,
      location_name: locationName,
      latitude,
      longitude,
      link_maps: googleMapsUrl,
      google_maps_url: googleMapsUrl,
      place_id: String(data?.place_id || '').trim(),
    };
  }

  private prepareEventLocationPayload(event: Acara): Acara {
    const address = String(event.address || event.alamat || '').trim();
    const latitude = String(event.latitude || '').trim();
    const longitude = String(event.longitude || '').trim();
    const googleMapsUrl = String(event.google_maps_url || event.link_maps || (latitude && longitude ? this.buildGoogleMapsUrl(latitude, longitude) : '')).trim();

    return {
      ...event,
      alamat: address,
      address,
      link_maps: googleMapsUrl,
      google_maps_url: googleMapsUrl,
      location_name: String(event.location_name || '').trim(),
      latitude,
      longitude,
      place_id: String(event.place_id || '').trim(),
    };
  }

  private locationValidator(control: AbstractControl): ValidationErrors | null {
    const latitude = String(control.get('latitude')?.value || '').trim();
    const longitude = String(control.get('longitude')?.value || '').trim();

    if ((latitude && !longitude) || (!latitude && longitude)) {
      return { coordinatePair: true };
    }

    return null;
  }

  private hasSelectedCountdown(): boolean {
    const savedCountdownId = String(this.countdownData?.id || '').trim();
    const savedCountdown = String(this.countdownData?.name_countdown || '').trim();

    return !!(savedCountdownId || savedCountdown);
  }

  private hasMinimumLocationData(): boolean {
    return this.dynamicEvents.controls.every(control => {
      const form = control as FormGroup;
      const address = String(form.get('address')?.value || form.get('alamat')?.value || '').trim();
      const mapsUrl = String(form.get('google_maps_url')?.value || form.get('link_maps')?.value || '').trim();
      const latitude = String(form.get('latitude')?.value || '').trim();
      const longitude = String(form.get('longitude')?.value || '').trim();

      return !!(address || mapsUrl || (latitude && longitude));
    });
  }

  private getLocationValidationMessage(): string {
    const hasCoordinatePairError = this.dynamicEvents.controls.some(control => control.hasError('coordinatePair'));

    if (hasCoordinatePairError) {
      return 'Latitude dan longitude harus diisi berpasangan.';
    }

    if (!this.hasMinimumLocationData()) {
      return 'Silakan isi alamat manual, nama lokasi, atau link Google Maps. Latitude dan longitude bersifat opsional.';
    }

    return '';
  }

  private extractCoordinates(value: string): { latitude: string; longitude: string } | null {
    if (!value) {
      return null;
    }

    const decodedValue = decodeURIComponent(value);
    const patterns = [
      /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /[?&]query=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    ];

    for (const pattern of patterns) {
      const match = decodedValue.match(pattern);
      if (match?.[1] && match?.[2]) {
        return { latitude: match[1], longitude: match[2] };
      }
    }

    return null;
  }

  private buildGoogleMapsUrl(latitude: string, longitude: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.values(formGroup.controls).forEach((control: AbstractControl) => {
      control.markAsTouched();

      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
