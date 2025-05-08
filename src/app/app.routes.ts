import { Routes } from '@angular/router';
import { HomeComponent } from './modules/home/home.component';
import { EventCreationComponent } from './modules/event/creation/event-creation.component';
import { EventViewComponent } from './modules/event/view/event-view.component';
import { ParticipantFormComponent } from './modules/participant/form/participant-form.component';
import { DateParserTestComponent } from './modules/testing/date-parser-test.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'event/create', component: EventCreationComponent },
  { path: 'event/:id/edit', component: EventCreationComponent },
  { path: 'event/:id/view', component: EventViewComponent },
  { path: 'event/:id/admin/:adminKey', component: EventViewComponent },
  { path: 'event/:id/participate', component: ParticipantFormComponent },
  { path: 'event/:id/participant/:participantId', component: ParticipantFormComponent },
  { path: 'test/date-parser', component: DateParserTestComponent },
  // Redirect to home for any unmatched routes
  { path: '**', redirectTo: '' }
];