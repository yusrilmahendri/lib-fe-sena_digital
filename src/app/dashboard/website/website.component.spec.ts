import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebsiteUserComponent } from './website.component';

describe('WebsiteComponent', () => {
  let component: WebsiteUserComponent;
  let fixture: ComponentFixture<WebsiteUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebsiteUserComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WebsiteUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
