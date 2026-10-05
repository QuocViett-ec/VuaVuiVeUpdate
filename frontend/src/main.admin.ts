import { bootstrapApplication } from '@angular/platform-browser';
import { adminAppConfig } from './admin/admin-app.config';
import { AdminApp } from './admin/admin-app';
import { loadRuntimeConfig } from './load-runtime-config';

loadRuntimeConfig().then(() => bootstrapApplication(AdminApp, adminAppConfig)).catch((err) => console.error(err));
