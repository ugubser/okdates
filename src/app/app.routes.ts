import { Routes } from '@angular/router';
import { HomeComponent } from './modules/home/home.component';
import { EventCreationComponent } from './modules/event/creation/event-creation.component';
import { EventViewComponent } from './modules/event/view/event-view.component';
import { ParticipantFormComponent } from './modules/participant/form/participant-form.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'event/create', component: EventCreationComponent },
  { path: 'event/:id/edit', component: EventCreationComponent },
  { path: 'event/:id/view', component: EventViewComponent },
  // Backward compatibility: old admin URLs redirect to view (admin key is lost,
  // but users can authenticate via the admin password dialog instead)
  { path: 'event/:id/admin/:adminKey', redirectTo: 'event/:id/view' },
  { path: 'event/:id/participate', component: ParticipantFormComponent },
  { path: 'event/:id/participant/:participantId', component: ParticipantFormComponent },
  // Redirect to home for any unmatched routes
  { path: '**', redirectTo: '' }
];