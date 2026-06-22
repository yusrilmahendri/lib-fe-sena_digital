import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { CommunityComponent } from './community.component';
import { DashboardService } from 'src/app/dashboard.service';
import { LandingModalService } from '../../landing-modal.service';

describe('CommunityComponent', () => {
  let component: CommunityComponent;
  let fixture: ComponentFixture<CommunityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CommunityComponent],
      imports: [RouterTestingModule],
      providers: [
        LandingModalService,
        {
          provide: DashboardService,
          useValue: {},
        },
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CommunityComponent);
    component = fixture.componentInstance;
    spyOn(component, 'loadThemes');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
