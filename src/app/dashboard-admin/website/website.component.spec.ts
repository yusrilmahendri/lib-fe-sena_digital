import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { WebsiteComponent } from './website.component';
import { WebsiteCategoryService } from '../../services/website-category.service';

describe('WebsiteComponent', () => {
  let component: WebsiteComponent;
  let fixture: ComponentFixture<WebsiteComponent>;
  const websiteCategoryServiceMock = {
    loading$: of(false),
    error$: of(null),
    categories$: of([]),
    getCategories: jasmine.createSpy('getCategories').and.returnValue(of({ data: [] }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebsiteComponent ],
      providers: [
        { provide: WebsiteCategoryService, useValue: websiteCategoryServiceMock }
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
