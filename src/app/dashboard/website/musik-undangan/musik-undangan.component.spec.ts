import { of } from 'rxjs';
import { MusikUndanganComponent } from './musik-undangan.component';

describe('MusikUndanganComponent pagination', () => {
  let component: MusikUndanganComponent;
  let dashboardService: any;

  const makeTrack = (id: number) => ({
    id,
    title: `Lagu ${id}`,
    artist: `Artist ${id}`,
    stream_url: `/music/${id}.mp3`,
    sort_order: id,
  });

  const makeOptionsResponse = (page: number, perPage: number, total = 37) => {
    const from = total ? ((page - 1) * perPage) + 1 : 0;
    const to = Math.min(page * perPage, total);
    const tracks = from ? Array.from({ length: to - from + 1 }, (_item, index) => makeTrack(from + index)) : [];

    return {
      data: {
        catalog_sections: {
          admin_catalog: tracks,
          user_uploads: [],
          global_catalog: [],
        },
      },
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        last_page: Math.max(1, Math.ceil(total / perPage)),
        from,
        to,
      },
    };
  };

  beforeEach(() => {
    dashboardService = {
      getMusicOptions: jasmine.createSpy('getMusicOptions').and.callFake((params: any) => {
        return of(makeOptionsResponse(params?.page || 1, params?.per_page || 10));
      }),
      getMusicSelection: jasmine.createSpy('getMusicSelection').and.returnValue(of({
        data: {
          selected_music_id: 1,
          music_source_type: 'catalog',
        },
      })),
      getProfile: jasmine.createSpy('getProfile').and.returnValue(of({ data: {} })),
    };

    component = new MusikUndanganComponent(dashboardService);
  });

  it('loads 37 catalog songs as 4 pages with 10 songs by default', () => {
    component.loadMusicData();

    expect(component.pageSize).toBe(10);
    expect(component.totalItems).toBe(37);
    expect(component.lastPage).toBe(4);
    expect(component.adminCatalogTracks.length).toBe(10);
  });

  it('shows 1-10 from 37 on page 1', () => {
    component.loadMusicData();

    expect(component.getCatalogRangeLabel()).toBe('Menampilkan 1–10 dari 37 lagu');
  });

  it('shows 31-37 from 37 on page 4', () => {
    component.loadMusicData();
    component.loadCatalogPage(4);

    expect(component.currentPage).toBe(4);
    expect(component.getCatalogRangeLabel()).toBe('Menampilkan 31–37 dari 37 lagu');
    expect(component.adminCatalogTracks.length).toBe(7);
  });

  it('resets to page 1 and fetches when page size changes', () => {
    component.loadMusicData();
    component.loadCatalogPage(3);

    const event = { target: { value: '20' } } as unknown as Event;
    component.changeCatalogPageSize(event);

    expect(component.currentPage).toBe(1);
    expect(component.pageSize).toBe(20);
    expect(dashboardService.getMusicOptions).toHaveBeenCalledWith({ page: 1, per_page: 20 });
  });

  it('disables previous on page 1 and next on the last page', () => {
    component.loadMusicData();

    expect(component.isPreviousCatalogPageDisabled()).toBeTrue();
    expect(component.isNextCatalogPageDisabled()).toBeFalse();

    component.loadCatalogPage(4);

    expect(component.isPreviousCatalogPageDisabled()).toBeFalse();
    expect(component.isNextCatalogPageDisabled()).toBeTrue();
  });

  it('keeps selected music and preview audio when changing page', () => {
    component.loadMusicData();
    component.selectedMusicId = 1;
    const previewAudio = {} as HTMLAudioElement;
    (component as any).previewAudio = previewAudio;

    component.loadCatalogPage(2);

    expect(component.selectedMusicId).toBe(1);
    expect((component as any).previewAudio).toBe(previewAudio);
  });
});
