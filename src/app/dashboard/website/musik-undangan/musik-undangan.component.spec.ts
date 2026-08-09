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

  const makeOptionsResponseWithMeta = (tracks: any[], meta: any) => ({
    data: {
      catalog_sections: {
        admin_catalog: tracks,
        user_uploads: [],
        global_catalog: [],
      },
    },
    meta,
  });

  beforeEach(() => {
    dashboardService = {
      getMusicOptions: jasmine.createSpy('getMusicOptions').and.callFake((params: any) => {
        return of(makeOptionsResponse(params?.page || 1, params?.per_page || 5));
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

  it('loads 37 catalog songs as 8 pages with 5 songs by default', () => {
    component.loadMusicData();

    expect(dashboardService.getMusicOptions).toHaveBeenCalledWith({ page: 1, per_page: 5 });
    expect(component.pageSize).toBe(5);
    expect(component.totalItems).toBe(37);
    expect(component.lastPage).toBe(8);
    expect(component.adminCatalogTracks.length).toBe(5);
  });

  it('shows 1-5 from 37 on page 1', () => {
    component.loadMusicData();

    expect(component.getCatalogRangeLabel()).toBe('Menampilkan 1–5 dari 37 lagu');
  });

  it('shows 36-37 from 37 on page 8', () => {
    component.loadMusicData();
    component.loadCatalogPage(8);

    expect(component.currentPage).toBe(8);
    expect(component.getCatalogRangeLabel()).toBe('Menampilkan 36–37 dari 37 lagu');
    expect(component.adminCatalogTracks.length).toBe(2);
  });

  it('shows 14 catalog songs as 3 pages with 5 songs by default', () => {
    dashboardService.getMusicOptions.and.callFake((params: any) => {
      return of(makeOptionsResponse(params?.page || 1, params?.per_page || 5, 14));
    });

    component.loadMusicData();

    expect(component.currentPage).toBe(1);
    expect(component.pageSize).toBe(5);
    expect(component.lastPage).toBe(3);
    expect(component.getCatalogRangeLabel()).toBe('Menampilkan 1–5 dari 14 lagu');

    component.loadCatalogPage(2);
    expect(component.currentPage).toBe(2);
    expect(component.getCatalogRangeLabel()).toBe('Menampilkan 6–10 dari 14 lagu');

    component.loadCatalogPage(3);
    expect(component.currentPage).toBe(3);
    expect(component.getCatalogRangeLabel()).toBe('Menampilkan 11–14 dari 14 lagu');
  });

  it('keeps requested page size when backend meta still reports 10', () => {
    dashboardService.getMusicOptions.and.returnValue(of(makeOptionsResponseWithMeta(
      [1, 2, 3, 4, 5].map(makeTrack),
      {
        current_page: 1,
        per_page: 10,
        total: 14,
        last_page: 2,
        from: 1,
        to: 10,
      }
    )));

    component.loadMusicData();

    expect(component.pageSize).toBe(5);
    expect(component.lastPage).toBe(3);
    expect(component.getCatalogRangeLabel()).toBe('Menampilkan 1–5 dari 14 lagu');
    expect(dashboardService.getMusicOptions).toHaveBeenCalledWith({ page: 1, per_page: 5 });
  });

  it('offers 5, 10, 20, 30, and 50 as page size options', () => {
    expect(component.pageSizeOptions).toEqual([5, 10, 20, 30, 50]);
  });

  it('defaults back to 5 on a fresh component instance', () => {
    component.pageSize = 20;

    const freshComponent = new MusikUndanganComponent(dashboardService);

    expect(freshComponent.pageSize).toBe(5);
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

    component.loadCatalogPage(8);

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
