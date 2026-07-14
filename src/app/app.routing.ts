import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginPageComponent } from './login-page/login-page.component';
import { DashboardUserComponent } from './dashboard/dashboard-user/dashboard-user.component';
import { WeddingViewComponent } from './dashboard/wedding-view/wedding-view.component';
const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: 'dashboard',
    component: DashboardUserComponent
  },
  {
    path: 'wedding/:domain',
    component: WeddingViewComponent
  },
  {
    path: 'wedding',
    component: WeddingViewComponent
  },


];

export const AppRouting = RouterModule.forChild(routes);
