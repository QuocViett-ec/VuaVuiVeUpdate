import { bootstrapApplication } from '@angular/platform-browser';
import { adminAppConfig } from './admin/admin-app.config';
import { AdminApp } from './admin/admin-app';

bootstrapApplication(AdminApp, adminAppConfig).catch((err) => console.error(err));
