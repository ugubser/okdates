import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { EventService } from '../../../core/services/event.service';
import { ParticipantService } from '../../../core/services/participant.service';
import { Event } from '../../../core/models/event.model';
import { Participant } from '../../../core/models/participant.model';
import { ParsedDate } from '../../../core/models/parsed-date.model';

@Component({
  selector: 'app-event-view',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
    MatCardModule
  ],
  templateUrl: './event-view.component.html',
  styleUrls: ['./event-view.component.scss']
})
export class EventViewComponent implements OnInit {
  eventId: string;
  event: Event | null = null;
  participants: Participant[] = [];
  isLoading = true;
  linkCopied = false;
  
  // For date visualization
  availabilityMap: Map<string, string[]> = new Map();
  uniqueDates: {date: Date, dateString: string, formattedDate: string}[] = [];
  displayColumns: string[] = ['participant'];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private participantService: ParticipantService
  ) {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
  }
  
  ngOnInit(): void {
    if (this.eventId) {
      this.loadEventData();
    } else {
      this.router.navigate(['/']);
    }
  }
  
  async loadEventData(): Promise<void> {
    try {
      this.isLoading = true;
      
      // Load event details
      this.event = await this.eventService.getEventDirect(this.eventId);
      
      if (!this.event) {
        this.router.navigate(['/']);
        return;
      }
      
      // Load participants
      this.participants = await this.participantService.getParticipantsDirect(this.eventId);
      
      // Process participant availability data
      this.processAvailabilityData();
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  copyEventLink(): void {
    const eventUrl = window.location.href;
    navigator.clipboard.writeText(eventUrl);
    
    // Show feedback that link was copied
    this.linkCopied = true;
    setTimeout(() => {
      this.linkCopied = false;
    }, 3000);
  }
  
  formatCreatedAt(timestamp: any): string {
    if (!timestamp) {
      return '';
    }
    
    try {
      // Handle both Firestore Timestamp objects and serialized { seconds, nanoseconds } objects
      const date = timestamp.toDate ? 
        timestamp.toDate() : // Firestore Timestamp object
        new Date(timestamp.seconds * 1000); // Serialized timestamp
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }
  
  addAvailability(): void {
    // Navigate to participant form
    this.router.navigate(['/event', this.eventId, 'participate']);
  }
  
  editEvent(): void {
    // Navigate to event creation/edit page
    this.router.navigate(['/event', this.eventId, 'edit']);
  }
  
  /**
   * Process availability data to create a unified view
   */
  processAvailabilityData(): void {
    // Clear any existing data
    this.availabilityMap.clear();
    this.uniqueDates = [];
    this.displayColumns = ['participant'];
    
    // Extract all dates from all participants
    const allDates = new Set<string>();
    
    // First pass: collect all unique dates
    this.participants.forEach(participant => {
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(timestamp => {
          const date = new Date(timestamp.seconds * 1000);
          const dateString = this.formatDateKey(date);
          allDates.add(dateString);
        });
      }
    });
    
    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
    
    // Create displayColumns and uniqueDates
    sortedDates.forEach(dateString => {
      const date = new Date(dateString);
      const formattedDate = this.formatDateForDisplay(date);
      this.uniqueDates.push({ date, dateString, formattedDate });
      this.displayColumns.push(dateString);
    });
    
    // Second pass: populate availability map
    this.participants.forEach(participant => {
      const participantDates: string[] = [];
      
      // Initialize with all dates as unavailable
      sortedDates.forEach(() => {
        participantDates.push('unavailable');
      });
      
      // Mark participant's available dates
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(timestamp => {
          const date = new Date(timestamp.seconds * 1000);
          const dateString = this.formatDateKey(date);
          const dateIndex = sortedDates.indexOf(dateString);
          if (dateIndex !== -1) {
            participantDates[dateIndex] = 'available';
          }
        });
      }
      
      this.availabilityMap.set(participant.id || participant.name, participantDates);
    });
  }
  
  /**
   * Format a date as YYYY-MM-DD for map keys
   */
  formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Format a date for display in the UI
   */
  formatDateForDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
  
  /**
   * Check if a participant is available on a specific date
   */
  isParticipantAvailable(participant: Participant, dateString: string): boolean {
    const participantId = participant.id || participant.name;
    const availability = this.availabilityMap.get(participantId);
    if (!availability) return false;
    
    const dateIndex = this.uniqueDates.findIndex(d => d.dateString === dateString);
    return dateIndex !== -1 && availability[dateIndex] === 'available';
  }
  
  /**
   * Get count of participants available on a specific date
   */
  getAvailableCountForDate(dateString: string): number {
    let count = 0;
    this.participants.forEach(participant => {
      if (this.isParticipantAvailable(participant, dateString)) {
        count++;
      }
    });
    return count;
  }
  
  /**
   * Get class for availability indicator
   */
  getAvailabilityClass(available: boolean): string {
    return available ? 'available' : 'unavailable';
  }
  
  // Expose window object for template
  get window(): Window {
    return window;
  }
  
  // Expose Math object for template
  get Math(): Math {
    return Math;
  }
}