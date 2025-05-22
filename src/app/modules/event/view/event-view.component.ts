import { Component, OnInit, Inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EventService } from '../../../core/services/event.service';
import { ParticipantService } from '../../../core/services/participant.service';
import { ParticipantStorageService } from '../../../core/services/participant-storage.service';
import { AdminStorageService } from '../../../core/services/admin-storage.service';
import { ICalendarService } from '../../../core/services/ical.service';
import { Event } from '../../../core/models/event.model';
import { Participant } from '../../../core/models/participant.model';
import { ParsedDate } from '../../../core/models/parsed-date.model';
import { DateTime } from 'luxon';

// Password Dialog Component
@Component({
  selector: 'admin-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatDialogModule
  ],
  template: `
    <h2 mat-dialog-title>Administrator Access</h2>
    <mat-dialog-content>
      <p>Enter the administrator password to access admin features:</p>
      <form [formGroup]="passwordForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" required>
          <mat-error *ngIf="passwordForm.get('password')?.hasError('required')">
            Password is required
          </mat-error>
          <mat-error *ngIf="errorMessage">
            {{ errorMessage }}
          </mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button 
        mat-raised-button 
        color="primary" 
        [disabled]="!passwordForm.valid || isVerifying"
        (click)="verifyPassword()">
        {{ isVerifying ? 'Verifying...' : 'Submit' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
    }
    input[type="password"] {
      padding: 8px;
    }
  `]
})
export class AdminPasswordDialogComponent {
  passwordForm: FormGroup;
  isVerifying = false;
  errorMessage = '';
  
  constructor(
    private dialogRef: MatDialogRef<AdminPasswordDialogComponent>,
    private fb: FormBuilder,
    private eventService: EventService,
    @Inject(MAT_DIALOG_DATA) public data: { eventId: string }
  ) {
    this.passwordForm = this.fb.group({
      password: ['', Validators.required]
    });
  }
  
  async verifyPassword(): Promise<void> {
    if (this.passwordForm.valid) {
      this.isVerifying = true;
      this.errorMessage = '';
      
      try {
        const password = this.passwordForm.get('password')?.value;
        const isValid = await this.eventService.verifyAdminPassword(this.data.eventId, password);
        
        if (isValid) {
          this.dialogRef.close({ success: true, password });
        } else {
          this.errorMessage = 'Invalid password';
        }
      } catch (error) {
        this.errorMessage = 'An error occurred while verifying the password';
        console.error('Error verifying password:', error);
      } finally {
        this.isVerifying = false;
      }
    }
  }
}

@Component({
  selector: 'app-event-view',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
    MatCardModule,
    MatMenuModule,
    MatInputModule,
    MatFormFieldModule,
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
  uniqueDates: {
    date: Date,
    dateString: string,
    formattedDate: string,
    slotStart?: Date,
    slotEnd?: Date,
    timezone?: string // Add timezone field
  }[] = [];

  // Store viewer's timezone from Luxon
  viewerTimezone: string = DateTime.local().zoneName;

  displayColumns: string[] = ['participant'];
  footerColumns: string[] = ['available'];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private participantService: ParticipantService,
    private participantStorageService: ParticipantStorageService,
    private adminStorageService: AdminStorageService,
    private iCalendarService: ICalendarService,
    private dialog: MatDialog
  ) {
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    this.adminKey = this.route.snapshot.paramMap.get('adminKey') || '';
    
    // If admin key is provided in the URL, store it for future use
    if (this.adminKey) {
      this.adminStorageService.storeAdminKey(this.eventId, this.adminKey);
    }
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
      
      // Check for admin access from URL parameter or stored admin key
      let storedAdminKey = this.adminStorageService.getAdminKey(this.eventId);
      
      if (this.adminKey) {
        // Use admin key from URL parameter
        this.isAdmin = await this.eventService.verifyAdminKey(this.eventId, this.adminKey);
        
        if (this.isAdmin) {
          // Store valid admin key for future use
          this.adminStorageService.storeAdminKey(this.eventId, this.adminKey);
        } else {
          console.warn('Invalid admin key provided in URL');
        }
      } else if (storedAdminKey) {
        // Use stored admin key
        this.isAdmin = await this.eventService.verifyAdminKey(this.eventId, storedAdminKey);
        this.adminKey = storedAdminKey;
        
        if (!this.isAdmin) {
          console.warn('Stored admin key is no longer valid');
          this.adminStorageService.removeAdminKey(this.eventId);
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
  
  /**
   * Open admin password dialog to verify admin access
   */
  openAdminPasswordDialog(): void {
    // Only show password dialog if the event has a password set
    if (!this.event?.adminPassword) {
      alert('This event does not have an administrator password set.');
      return;
    }
    
    const dialogRef = this.dialog.open(AdminPasswordDialogComponent, {
      width: '400px',
      data: { eventId: this.eventId }
    });
    
    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && result.success) {
        // Password verification successful
        // Get the admin key for this event
        if (this.event?.adminKey) {
          this.adminKey = this.event.adminKey;
          this.adminStorageService.storeAdminKey(this.eventId, this.adminKey);
          this.isAdmin = true;
        }
      }
    });
  }

  /**
   * Copy admin link to clipboard
   */
  copyAdminLink(): void {
    if (this.isAdmin && this.event?.adminKey) {
      const adminUrl = `${window.location.origin}/event/${this.eventId}/admin/${this.event.adminKey}`;
      navigator.clipboard.writeText(adminUrl);
      alert('Admin link copied to clipboard!');
    }
  }

  editEvent(): void {
    // Only allow editing if admin key is valid or we're in development
    if (this.isAdmin) {
      // Navigate to event edit page with admin key
      this.router.navigate(['/event', this.eventId, 'edit'], { 
        queryParams: { adminKey: this.adminKey }
      });
    } else if (this.event?.adminPassword) {
      // If there's an admin password set, show the password dialog
      this.openAdminPasswordDialog();
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

    const isMeeting = this.event?.isMeeting || false;

    if (isMeeting) {
      // For meetings - we need a different approach with time slots
      this.processMeetingAvailability();
    } else {
      // For regular events - use the original date-based approach
      this.processRegularEventAvailability();
    }
  }

  /**
   * Process availability data for regular date-based events (original implementation)
   */
  processRegularEventAvailability(): void {
    // Extract all dates from all participants
    const allDates = new Set<string>();
    
    //console.log('Processing regular event availability for participants:', this.participants);
    
    // First pass: collect all unique dates
    this.participants.forEach(participant => {
      //console.log(`Processing participant ${participant.name}, parsed dates:`, participant.parsedDates);
      
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(dateData => {
          // Check for various timestamp formats
          if (dateData.timestamp && dateData.timestamp.seconds) {
            const date = new Date(dateData.timestamp.seconds * 1000);
            const dateString = date.toISOString().split('T')[0];
            //console.log(`Adding date from timestamp: ${dateString}`);
            allDates.add(dateString);
          } 
          // Handle time range data - use start date
          else if (dateData.startTimestamp && dateData.startTimestamp.seconds) {
            const date = new Date(dateData.startTimestamp.seconds * 1000);
            const dateString = date.toISOString().split('T')[0];
            //console.log(`Adding date from startTimestamp: ${dateString}`);
            allDates.add(dateString);
          }
          // Legacy format - direct seconds value
          else if (dateData.seconds) {
            const date = new Date(dateData.seconds * 1000);
            const dateString = date.toISOString().split('T')[0];
            //console.log(`Adding date from direct seconds: ${dateString}`);
            allDates.add(dateString);
          }
          else {
            console.warn('Unrecognized date format:', dateData);
          }
        });
      }
    });
    
    //console.log('All unique dates found:', allDates);
    
    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
    
    //console.log('Sorted dates:', sortedDates);
    
    // Create displayColumns and uniqueDates
    sortedDates.forEach(dateString => {
      const date = new Date(dateString);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
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
        participant.parsedDates.forEach(dateData => {
          let dateString = '';
          
          // Check for various timestamp formats
          if (dateData.timestamp && dateData.timestamp.seconds) {
            const date = new Date(dateData.timestamp.seconds * 1000);
            dateString = date.toISOString().split('T')[0];
          } 
          // Handle time range data - use start date
          else if (dateData.startTimestamp && dateData.startTimestamp.seconds) {
            const date = new Date(dateData.startTimestamp.seconds * 1000);
            dateString = date.toISOString().split('T')[0];
          }
          // Legacy format - direct seconds value
          else if (dateData.seconds) {
            const date = new Date(dateData.seconds * 1000);
            dateString = date.toISOString().split('T')[0];
          }
          
          if (dateString) {
            const dateIndex = sortedDates.indexOf(dateString);
            if (dateIndex !== -1) {
              participantDates[dateIndex] = 'available';
              //console.log(`Marking ${participant.name} as available on ${dateString}`);
            }
          }
        });
      }
      
      this.availabilityMap.set(participant.id || participant.name, participantDates);
      //console.log(`Set availability for ${participant.name}:`, participantDates);
    });
    
    //console.log('Final uniqueDates:', this.uniqueDates);
    //console.log('Final availabilityMap:', this.availabilityMap);
  }

  /**
   * Process availability data for time-based meetings
   */
  processMeetingAvailability(): void {
    // Extract all unique dates from time ranges
    const allDates = new Set<string>();

    // Get meeting duration from event or default to 60 minutes
    const meetingDuration = this.event?.meetingDuration || 60;

    // First pass: collect all unique dates from time ranges
    this.participants.forEach(participant => {
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(dateData => {
          if (dateData.startTimestamp && dateData.endTimestamp) {
            // This is a time range - extract the date part
            const startDate = new Date(dateData.startTimestamp.seconds * 1000);
            const endDate = new Date(dateData.endTimestamp.seconds * 1000);

            // Add the date(s) to our set
            const startDateString = this.formatDateKey(startDate);
            allDates.add(startDateString);

            // If the end date is different from start date, add it too
            const endDateString = this.formatDateKey(endDate);
            if (endDateString !== startDateString) {
              allDates.add(endDateString);
            }
          } else if (dateData.timestamp) {
            // Fallback for regular timestamps
            const date = new Date(dateData.timestamp.seconds * 1000);
            const dateString = this.formatDateKey(date);
            allDates.add(dateString);
          }
        });
      }
    });

    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    // Find earliest start time and latest end time from all participants with minute precision
    let earliestMinuteOfDay = 24 * 60; // Default to late (24:00)
    let latestMinuteOfDay = 0;         // Default to early (00:00)

    // Scan through all participants' time ranges to find min/max times
    this.participants.forEach(participant => {
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(dateData => {
          if (dateData.startTimestamp && dateData.endTimestamp) {
            // Get timezone and create proper DateTime objects
            const participantTimezone = dateData.timezone || participant.timezone || 'Europe/Zurich';
            
            // Use the approach from the expand-timestamp.js script:
            // 1. Parse timestamp as UTC first
            const utcStartDate = DateTime.fromSeconds(dateData.startTimestamp.seconds, { zone: 'utc' });
            const utcEndDate = DateTime.fromSeconds(dateData.endTimestamp.seconds, { zone: 'utc' });
            
            // 2. Relabel to target timezone keeping the same wall-clock time
            const startDate = utcStartDate.setZone(participantTimezone, { keepLocalTime: true });
            const endDate = utcEndDate.setZone(participantTimezone, { keepLocalTime: true });

            // Update earliest/latest times in minutes of day
            const startMinutes = startDate.hour * 60 + startDate.minute;
            const endMinutes = endDate.hour * 60 + endDate.minute;
            
            earliestMinuteOfDay = Math.min(earliestMinuteOfDay, startMinutes);
            latestMinuteOfDay = Math.max(latestMinuteOfDay, endMinutes);
          }
        });
      }
    });

    // Apply reasonable bounds only if we don't have ANY data
    if (earliestMinuteOfDay === 24 * 60) {
      earliestMinuteOfDay = 7 * 60; // 7:00 AM default
    }
    if (latestMinuteOfDay === 0) {
      latestMinuteOfDay = 19 * 60; // 7:00 PM default
    }
    
    // Ensure we have enough of a time range
    if (latestMinuteOfDay - earliestMinuteOfDay < 2 * 60) { // At least 2 hours
      earliestMinuteOfDay = Math.max(0, earliestMinuteOfDay - 60); // Extend 1 hour earlier
      latestMinuteOfDay = Math.min(24 * 60, latestMinuteOfDay + 60); // Extend 1 hour later
    }

    // Round down earliest time to nearest 15-minute interval
    earliestMinuteOfDay = Math.floor(earliestMinuteOfDay / 15) * 15;
    
    // Round up latest time to nearest 15-minute interval
    latestMinuteOfDay = Math.ceil(latestMinuteOfDay / 15) * 15;

    // Create time slots for each date with dynamic times based on meeting duration
    sortedDates.forEach(dateString => {
      const date = new Date(dateString);

      // Create slots using the meeting duration as the interval
      for (let minuteOfDay = earliestMinuteOfDay; minuteOfDay < latestMinuteOfDay; minuteOfDay += meetingDuration) {
        // Only create slots that can fit the full meeting duration
        if (minuteOfDay + meetingDuration <= latestMinuteOfDay) {
          const hours = Math.floor(minuteOfDay / 60);
          const minutes = minuteOfDay % 60;
          
          const endHours = Math.floor((minuteOfDay + meetingDuration) / 60);
          const endMinutes = (minuteOfDay + meetingDuration) % 60;
          
          const slotDate = new Date(date);
          slotDate.setHours(hours, minutes, 0, 0);

          const slotEndDate = new Date(date);
          slotEndDate.setHours(endHours, endMinutes, 0, 0);

          const slotKey = `${dateString}-${hours}-${minutes}`;

          // Always use the viewer's timezone for display
          const timezoneName = this.viewerTimezone;

          // Create a Luxon DateTime for this slot in the viewer's timezone
          const luxonSlotDate = DateTime.fromJSDate(slotDate).setZone(this.viewerTimezone);
          
          // Format hours and minutes with padding
          const formattedStartTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          const formattedEndTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
          
          // Format time display for this slot in the viewer's timezone
          const formattedDate = `${this.formatDateForDisplay(date)} ${formattedStartTime}-${formattedEndTime}`;

          this.uniqueDates.push({
            date: slotDate,
            dateString: slotKey,
            formattedDate,
            slotStart: slotDate,
            slotEnd: slotEndDate,
            timezone: timezoneName // Add timezone information
          });

          this.displayColumns.push(slotKey);
          this.footerColumns.push(slotKey);
        }
      }
    });

    // Second pass: populate availability map for time slots
    this.participants.forEach(participant => {
      const participantAvailability: string[] = [];

      // Initialize with all slots as unavailable
      this.uniqueDates.forEach(() => {
        participantAvailability.push('unavailable');
      });

      // Mark participant's available time slots
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(dateData => {
          if (dateData.startTimestamp && dateData.endTimestamp) {
            // Get the participant's timezone directly from the data
            // Fall back to Europe/Zurich if not specified - this is for interpreting the input data correctly
            const participantTimezone = dateData.timezone || participant.timezone || 'Europe/Zurich';

            // IMPORTANT: The timestamps in Firestore are Unix timestamps (seconds since epoch in UTC)
            // But the original date components (like 9:00 AM) came from the user's input
            // We need to recreate the original date components in the participant's timezone

            // Use the approach from the expand-timestamp.js script:
            // 1. Parse timestamp as UTC first
            const utcStartDate = DateTime.fromSeconds(dateData.startTimestamp.seconds, { zone: 'utc' });
            const utcEndDate = DateTime.fromSeconds(dateData.endTimestamp.seconds, { zone: 'utc' });
            
            // Look at the originalText to get the real time that was intended - this is for debugging only
            const originalText = dateData.originalText || '';

            // We won't need to parse hours from the original text since we're now using the correct timezone approach
            let originalStartHour = 0;
            let originalStartMinute = 0;
            let originalEndHour = 0;
            let originalEndMinute = 0;

            if (originalText) {
              const matches = originalText.match(/T(\d{2}):(\d{2}).*\/.*T(\d{2}):(\d{2})/);
              if (matches && matches.length >= 5) {
                originalStartHour = parseInt(matches[1]);
                originalStartMinute = parseInt(matches[2]);
                originalEndHour = parseInt(matches[3]);
                originalEndMinute = parseInt(matches[4]);
              }
            }

            // 2. Relabel to target timezone keeping the same wall-clock time
            const luxonStartDate = utcStartDate.setZone(participantTimezone, { keepLocalTime: true });
            const luxonEndDate = utcEndDate.setZone(participantTimezone, { keepLocalTime: true });

            // Convert to viewer's timezone for slot matching
            const startInViewerTZ = luxonStartDate.setZone(this.viewerTimezone);
            const endInViewerTZ = luxonEndDate.setZone(this.viewerTimezone);

            // Match slots based on times converted to viewer's timezone
            this.uniqueDates.forEach((slot, index) => {
              if (slot.slotStart && slot.slotEnd) {
                // Get the slot start and end as DateTime objects
                const slotStartDateTime = DateTime.fromJSDate(slot.slotStart).setZone(this.viewerTimezone);
                const slotEndDateTime = DateTime.fromJSDate(slot.slotEnd).setZone(this.viewerTimezone);
                
                // Format dates for comparison
                const slotDateStr = this.formatDateKey(slot.date);
                const startDateStr = startInViewerTZ.toISODate();
                const endDateStr = endInViewerTZ.toISODate();
                
                // Get timestamp values for comparison (milliseconds)
                const slotStartTs = slotStartDateTime.toMillis();
                const slotEndTs = slotEndDateTime.toMillis();
                const participantStartTs = startInViewerTZ.toMillis();
                const participantEndTs = endInViewerTZ.toMillis();
                
                // For time slots that fit entirely within the participant's available time
                if (slotStartTs >= participantStartTs && slotEndTs <= participantEndTs) {
                  participantAvailability[index] = 'available';
                }
                // Handle cases where the time slot spans multiple days
                else if (startDateStr !== endDateStr) {
                  // If slot is on start date and starts after participant's start time
                  if (slotDateStr === startDateStr && slotStartTs >= participantStartTs) {
                    participantAvailability[index] = 'available';
                  }
                  // If slot is on end date and ends before participant's end time
                  else if (slotDateStr === endDateStr && slotEndTs <= participantEndTs) {
                    participantAvailability[index] = 'available';
                  }
                  // If slot date is between start and end dates
                  else if (startDateStr && endDateStr && slotDateStr > startDateStr && slotDateStr < endDateStr) {
                    participantAvailability[index] = 'available';
                  }
                }
              }
            });
          } else if (dateData.timestamp) {
            // Fallback for regular timestamps (unlikely in meeting mode)
            const participantTimezone = dateData.timezone || participant.timezone || 'Europe/Zurich';

            // Use the approach from the expand-timestamp.js script:
            // 1. Parse timestamp as UTC first
            const utcDate = DateTime.fromSeconds(dateData.timestamp.seconds, { zone: 'utc' });
            
            // These variables are for debugging only - we won't use them anymore
            let originalHour = 0;
            let originalMinute = 0;
            const originalText = dateData.originalText || '';
            
            if (originalText) {
              const matches = originalText.match(/T(\d{2}):(\d{2})/);
              if (matches && matches.length >= 3) {
                originalHour = parseInt(matches[1]);
                originalMinute = parseInt(matches[2]);
              }
            }

            // 2. Relabel to target timezone keeping the same wall-clock time
            const luxonDate = utcDate.setZone(participantTimezone, { keepLocalTime: true });

            // Convert to viewer's timezone
            const dateInViewerTZ = luxonDate.setZone(this.viewerTimezone);

            // For a single point in time, assume the participant is available for the meeting duration
            const startMinutes = dateInViewerTZ.hour * 60 + dateInViewerTZ.minute;
            const endMinutes = startMinutes + (this.event?.meetingDuration || 60);

            this.uniqueDates.forEach((slot, index) => {
              if (slot.slotStart) {
                const slotStartDateTime = DateTime.fromJSDate(slot.slotStart).setZone(this.viewerTimezone);
                const slotMinutes = slotStartDateTime.hour * 60 + slotStartDateTime.minute;
                
                // Check if the slot's date matches the participant's date
                const slotDateStr = this.formatDateKey(slot.date);
                const participantDateStr = dateInViewerTZ.toISODate();
                
                if (slotDateStr === participantDateStr && slotMinutes >= startMinutes && slotMinutes < endMinutes) {
                  participantAvailability[index] = 'available';
                }
              }
            });
          }
        });
      }

      this.availabilityMap.set(participant.id || participant.name, participantAvailability);
    });
    
    // After populating availability map, find common available time slots
    this.findCommonAvailableTimeSlots();
  }
  
  /**
   * Format a date as YYYY-MM-DD for map keys
   * This method works with both JavaScript Date and Luxon DateTime objects
   */
  formatDateKey(date: Date | DateTime): string {
    if (date instanceof DateTime) {
      return date.toISODate() || '';
    } else {
      // For regular JavaScript Date objects, ensure we have a valid date before converting
      if (isNaN(date.getTime())) {
        console.warn('Invalid date detected:', date);
        return ''; // Return empty string for invalid dates
      }
      return date.toISOString().split('T')[0];
    }
  }
  
  /**
   * Format a date for display in the UI
   * This method works with both JavaScript Date and Luxon DateTime objects
   */
  formatDateForDisplay(date: Date | DateTime, timezone?: string): string {
    // Convert Date to Luxon DateTime if needed
    const luxonDate = date instanceof DateTime
      ? date
      : DateTime.fromJSDate(date).setZone(timezone || this.viewerTimezone);

    if (this.event?.isMeeting) {
      // For meetings, include the time
      const hour = luxonDate.hour;
      const formattedTime = `${hour}:00-${hour + 1}:00`;

      // Don't include timezone in the formatted date string because it's displayed separately
      const timezoneInfo = '';

      // Format the date part
      const formattedDate = luxonDate.toLocaleString({
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });

      return `${formattedDate} ${formattedTime}${timezoneInfo}`;
    } else {
      // For regular events, just show the date
      return luxonDate.toLocaleString({
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  /**
   * Format just the day part of a date
   * This method works with both JavaScript Date and Luxon DateTime objects
   */
  formatDayOnly(date: Date | DateTime): string {
    // Convert Date to Luxon DateTime if needed
    const luxonDate = date instanceof DateTime
      ? date
      : DateTime.fromJSDate(date).setZone(this.viewerTimezone);

    return luxonDate.toLocaleString({
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Check if this is the first time slot of a day
   */
  isFirstTimeSlotOfDay(dateInfo: {date: Date, dateString: string, formattedDate: string, slotStart?: Date, slotEnd?: Date}): boolean {
    if (!this.event?.isMeeting || !dateInfo.slotStart) return false;

    // Extract the date part from the dateString (format is YYYY-MM-DD-HH)
    const datePart = dateInfo.dateString.split('-').slice(0, 3).join('-');

    // Get the index of this time slot
    const index = this.uniqueDates.findIndex(d => d.dateString === dateInfo.dateString);

    // If it's the first in the array, it's the first time slot
    if (index === 0) return true;

    // Otherwise, check if the previous slot has a different date part
    const prevDateInfo = this.uniqueDates[index - 1];
    const prevDatePart = prevDateInfo.dateString.split('-').slice(0, 3).join('-');

    return datePart !== prevDatePart;
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

  /**
   * Get class for participation percentage
   */
  getParticipationClass(dateString: string): string {
    if (!this.participants.length) return '';

    const percentage = (this.getAvailableCountForDate(dateString) / this.participants.length) * 100;

    if (percentage <= 50) {
      return 'participation-low';
    } else if (percentage <= 75) {
      return 'participation-medium';
    } else {
      return 'participation-high';
    }
  }
  
  /**
   * Common available time slots for meetings - stores slots where everyone is available
   */
  commonAvailableSlots: {slot: any, dateString: string}[] = [];
  
  /**
   * Find common available time slots where all participants are available
   */
  findCommonAvailableTimeSlots(): void {
    // Clear any previous results
    this.commonAvailableSlots = [];
    
    // Only process if we have participants
    if (this.participants.length === 0) {
      return;
    }
    
    // Check each time slot
    this.uniqueDates.forEach((slot, index) => {
      const dateString = slot.dateString;
      let allAvailable = true;
      
      // Check if all participants are available for this slot
      for (const participant of this.participants) {
        if (!this.isParticipantAvailable(participant, dateString)) {
          allAvailable = false;
          break;
        }
      }
      
      // If all participants are available, add to common slots
      if (allAvailable) {
        this.commonAvailableSlots.push({
          slot,
          dateString
        });
      }
    });
  }
  
  /**
   * Check if a time slot is commonly available for all participants
   * Only applicable for meeting mode
   */
  isCommonAvailableSlot(dateString: string): boolean {
    if (!this.event?.isMeeting) return false;
    return this.commonAvailableSlots.some(item => item.dateString === dateString);
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
   * Get a human-readable timezone abbreviation
   */
  getTimezoneAbbreviation(timezone: string): string {
    if (!timezone) return '';

    // For now, just return the timezone as is
    // In a more robust implementation, you might convert to a nicer display format
    return timezone;
  }

  /**
   * Check if event has any time information to display
   */
  hasTimeInfo(): boolean {
    return !!(this.event &&
      (this.event.startTime || this.event.endTime ||
       (this.event.isMeeting && this.event.meetingDuration)));
  }

  /**
   * Generate and download an iCalendar file for a specific date
   */
  downloadICalForDate(dateInfo: any): void {
    if (!this.event) return;

    // Handle differently based on event type
    let icalContent;

    if (this.event.isMeeting) {
      // For meetings, use the slot start and end times, and pass timezone
      if (dateInfo.slotStart && dateInfo.slotEnd) {
        icalContent = this.iCalendarService.generateICalendarFile(
          this.event,
          dateInfo.date,
          dateInfo.formattedDate,
          dateInfo.slotStart,
          dateInfo.slotEnd,
          dateInfo.timezone || this.viewerTimezone // Pass timezone info for meetings
        );
      } else {
        console.warn('Missing slot times for meeting event');
        icalContent = this.iCalendarService.generateICalendarFile(
          this.event,
          dateInfo.date,
          dateInfo.formattedDate
        );
      }
    } else {
      // For regular events, pass the date only - timezone will be determined by the service
      icalContent = this.iCalendarService.generateICalendarFile(
        this.event,
        dateInfo.date,
        dateInfo.formattedDate
      );
    }

    // Create a filename with the event title and date/time
    let fileName;
    if (this.event.isMeeting && dateInfo.slotStart) {
      // For meetings, include the time in the filename
      const timeStr = dateInfo.slotStart.getHours().toString().padStart(2, '0') + 
                      dateInfo.slotStart.getMinutes().toString().padStart(2, '0');
      const safeTitle = (this.event.title || 'Meeting').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      fileName = `${safeTitle}_${dateInfo.dateString}_${timeStr}.ics`;
    } else {
      // For regular events, just use the date
      const safeTitle = (this.event.title || 'Event').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      fileName = `${safeTitle}_${dateInfo.dateString}.ics`;
    }

    // Trigger the download
    this.iCalendarService.downloadICalFile(icalContent, fileName);
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