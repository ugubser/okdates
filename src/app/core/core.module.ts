import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';

// Services
import { FirestoreService } from './services/firestore.service';
import { EventService } from './services/event.service';
import { ParticipantService } from './services/participant.service';
import { DateParsingService } from './services/date-parsing.service';
import { AdminStorageService } from './services/admin-storage.service';

@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
  providers: [
    FirestoreService,
    EventService,
    ParticipantService,
    DateParsingService,
    AdminStorageService
  ]
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule has already been loaded. Import CoreModule in AppModule only.');
    }
  }
}