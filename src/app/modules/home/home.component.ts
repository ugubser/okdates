import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { EventService } from '../../core/services/event.service';
import { FirestoreService } from '../../core/services/firestore.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  constructor(
    private router: Router,
    private eventService: EventService,
    private firestoreService: FirestoreService
  ) {}

  ngOnInit(): void {
    // Debug: List all events on initialization
    this.listEvents();
  }

  createNewEvent(isMeeting: boolean = false): void {
    //console.log(`Creating new ${isMeeting ? 'meeting' : 'event'} - navigating to create page`);
    this.router.navigate(['/event/create'], { queryParams: { isMeeting } });
  }
  

  /**
   * Debug function to list all events in the console
   */
  private async listEvents(): Promise<void> {
    try {
      const events = await this.firestoreService.getCollection('events');
      //console.log('Current events in the database:', events);
    } catch (error) {
      console.error('Error listing events:', error);
    }
  }
}