import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { CommunityComponent } from './community.component';
import { DashboardService } from 'src/app/dashboard.service';
import { LandingModalService } from '../../landing-modal.service';

describe('CommunityComponent', () => {
  let component: CommunityComponent;
  let fixture: ComponentFixture<CommunityComponent>;
  let landingModal: LandingModalService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CommunityComponent],
      imports: [CommonModule, RouterTestingModule],
      providers: [
        LandingModalService,
        {
          provide: DashboardService,
          useValue: {
            list: () => of({ data: [] }),
          },
        },
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CommunityComponent);
    component = fixture.componentInstance;
    landingModal = TestBed.inject(LandingModalService);
    spyOn(component, 'loadThemes');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the create invitation modal with the selected theme', () => {
    const openCreateInvitation = spyOn(landingModal, 'openCreateInvitation');
    const theme = component.themes[1];

    component.openCreateInvitationModal(theme);

    expect(openCreateInvitation).toHaveBeenCalledWith(jasmine.objectContaining({
      id: theme.id,
      slug: theme.slug,
      name: theme.name,
      tier: theme.tier,
      category: theme.badge,
    }));
  });
});
