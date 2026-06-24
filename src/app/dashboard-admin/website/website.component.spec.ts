import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { WebsiteComponent } from './website.component';
import { WebsiteCategoryService } from '../../services/website-category.service';
import { DashboardService } from '../../dashboard.service';

describe('WebsiteComponent', () => {
  let component: WebsiteComponent;
  let fixture: ComponentFixture<WebsiteComponent>;
  const websiteCategoryServiceMock = {
    loading$: of(false),
    error$: of(null),
    categories$: of([]),
    getCategories: jasmine.createSpy('getCategories').and.returnValue(of({ data: [] })),
    getImageUrl: jasmine.createSpy('getImageUrl').and.callFake((path: string) => path)
  };
  const dashboardServiceMock = {
    list: jasmine.createSpy('list').and.returnValue(of({ data: [] }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebsiteComponent ],
      providers: [
        { provide: WebsiteCategoryService, useValue: websiteCategoryServiceMock },
        { provide: DashboardService, useValue: dashboardServiceMock }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WebsiteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
