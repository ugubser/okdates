import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { EventService } from '../../../core/services/event.service';
import { ParticipantService } from '../../../core/services/participant.service';
import { ParticipantStorageService } from '../../../core/services/participant-storage.service';
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
    MatCardModule,
    MatMenuModule,
    MatDialogModule
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
  isAdmin = false;
  adminKey = '';
  
  // For date visualization
  availabilityMap: Map<string, string[]> = new Map();
  uniqueDates: {date: Date, dateString: string, formattedDate: string}[] = [];
  displayColumns: string[] = ['participant'];
  footerColumns: string[] = ['available'];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private participantService: ParticipantService,
    private participantStorageService: ParticipantStorageService,
    private dialog: MatDialog
  ) {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    this.adminKey = this.route.snapshot.paramMap.get('adminKey') || '';
  }
  
  /**
   * Check if the current user is the owner of a participant or an admin
   */
  isParticipantOwner(participant: Participant): boolean {
    if (!participant.id) return false;
    
    // Admin can edit any participant
    if (this.isAdmin) return true;
    
    // Check local storage for ownership
    return this.participantStorageService.isParticipantOwner(this.eventId, participant.id);
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
      
      // Check if user has admin access
      if (this.adminKey) {
        this.isAdmin = await this.eventService.verifyAdminKey(this.eventId, this.adminKey);
        
        if (!this.isAdmin) {
          console.warn('Invalid admin key provided');
          // Still show the event, but without admin privileges
        } else {
          console.log('Admin access verified');
        }
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
    // Generate a non-administrative URL for sharing
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/event/${this.eventId}/view`;
    navigator.clipboard.writeText(shareUrl);

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
    // Only allow editing if admin key is valid or we're in development
    if (this.isAdmin) {
      // Navigate to event edit page with admin key
      this.router.navigate(['/event', this.eventId, 'edit'], { 
        queryParams: { adminKey: this.adminKey }
      });
    } else {
      console.warn('Edit attempted without admin permissions');
      // Show notification that admin permissions are required
      alert('You need administrator access to edit this event.');
    }
  }
  
  /**
   * Process availability data to create a unified view
   */
  processAvailabilityData(): void {
    // Clear any existing data
    this.availabilityMap.clear();
    this.uniqueDates = [];
    this.displayColumns = ['participant'];
    this.footerColumns = ['available'];
    
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
      this.footerColumns.push(dateString);
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

  /**
   * Check if event has any time information to display
   */
  hasTimeInfo(): boolean {
    return !!(this.event && (this.event.startTime || this.event.endTime));
  }

  /**
   * Get shareable non-administrative URL for the event
   */
  getShareableUrl(): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/event/${this.eventId}/view`;
  }
  
  /**
   * Edit a participant's availability
   */
  editParticipant(participant: Participant): void {
    if (!participant.id) return;
    
    // Prepare query params 
    const queryParams: any = { edit: 'true' };
    
    // If admin, pass the admin key
    if (this.isAdmin && this.adminKey) {
      queryParams.adminKey = this.adminKey;
    }
    
    // Navigate to participant edit route
    this.router.navigate(['/event', this.eventId, 'participant', participant.id], {
      queryParams
    });
  }
  
  /**
   * Remove a participant from the event
   */
  async deleteParticipant(participant: Participant): Promise<void> {
    if (!participant.id) return;
    
    if (confirm(`Are you sure you want to remove ${participant.name} from this event?`)) {
      try {
        // Delete the participant
        await this.participantService.deleteParticipantDirect(this.eventId, participant.id);
        
        // If this was the current user's entry, remove from localStorage
        if (this.participantStorageService.isParticipantOwner(this.eventId, participant.id)) {
          this.participantStorageService.removeParticipantId(this.eventId);
        }
        
        // Refresh the participant list
        this.participants = await this.participantService.getParticipantsDirect(this.eventId);
        this.processAvailabilityData();
      } catch (error) {
        console.error('Error deleting participant:', error);
        alert('Failed to delete participant. Please try again.');
      }
    }
  }
  
  /**
   * Admin function to remove all participants
   */
  async deleteAllParticipants(): Promise<void> {
    if (!this.isAdmin) return;
    
    if (this.participants.length === 0) {
      alert('There are no participants to remove.');
      return;
    }
    
    if (confirm(`Are you sure you want to remove ALL participants (${this.participants.length}) from this event? This action cannot be undone.`)) {
      try {
        // Delete each participant one by one
        for (const participant of this.participants) {
          if (participant.id) {
            await this.participantService.deleteParticipantDirect(this.eventId, participant.id);
          }
        }
        
        // Clear the participant list
        this.participants = [];
        this.processAvailabilityData();
        
        alert('All participants have been removed successfully.');
      } catch (error) {
        console.error('Error deleting all participants:', error);
        alert('Failed to delete all participants. Please try again.');
      }
    }
  }
}