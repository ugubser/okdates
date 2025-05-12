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
import { ICalendarService } from '../../../core/services/ical.service';
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
  uniqueDates: {
    date: Date,
    dateString: string,
    formattedDate: string,
    slotStart?: Date,
    slotEnd?: Date,
    timezone?: string // Add timezone field
  }[] = [];
  displayColumns: string[] = ['participant'];
  footerColumns: string[] = ['available'];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private participantService: ParticipantService,
    private participantStorageService: ParticipantStorageService,
    private iCalendarService: ICalendarService,
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

    const isMeeting = this.event?.isMeeting || false;

    if (isMeeting) {
      // For meetings - we need a different approach with time slots
      this.processMeetingAvailability();
    } else {
      // For regular events - use the original date-based approach
      this.processDateAvailability();
    }
  }

  /**
   * Process availability data for regular date-based events
   */
  processDateAvailability(): void {
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
          if (timestamp.seconds) { // Check if it's a regular timestamp
            // Use UTC Date to avoid automatic timezone conversion
            // This preserves the original time as stored
            const timestampMs = timestamp.seconds * 1000;
            const date = new Date(timestampMs);

            // If timezone info is available, create date that respects it
            if (timestamp.timezone) {
              console.log(`Using timezone from date: ${timestamp.timezone}`);
            } else if (participant.timezone) {
              console.log(`Using timezone from participant: ${participant.timezone}`);
            }

            const dateString = this.formatDateKey(date);
            const dateIndex = sortedDates.indexOf(dateString);
            if (dateIndex !== -1) {
              participantDates[dateIndex] = 'available';
            }
          }
        });
      }

      this.availabilityMap.set(participant.id || participant.name, participantDates);
    });
  }

  /**
   * Process availability data for time-based meetings
   */
  processMeetingAvailability(): void {
    // For meetings, we'll create a grid of date-time slots
    // The time slots will be 1-hour intervals from 9am to 9pm

    // Extract all unique dates from time ranges
    const allDates = new Set<string>();

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

    // Create time slots for each date
    // For simplicity, we'll use 1-hour intervals from 9am to 9pm
    sortedDates.forEach(dateString => {
      const date = new Date(dateString);

      // Create slots for each hour from 9am to 9pm (12 hours)
      for (let hour = 9; hour < 21; hour++) {
        const slotDate = new Date(date);
        slotDate.setHours(hour, 0, 0, 0);

        const slotEndDate = new Date(slotDate);
        slotEndDate.setHours(hour + 1, 0, 0, 0);

        const slotKey = `${dateString}-${hour}`;

        // Get timezone information from the first participant that has this data
        let timezoneInfo = '';
        for (const participant of this.participants) {
          if (participant.timezone) {
            timezoneInfo = participant.timezone;
            break;
          }

          // If participant level timezone isn't available, check individual date entries
          if (participant.parsedDates) {
            for (const dateData of participant.parsedDates) {
              if (dateData.timezone) {
                timezoneInfo = dateData.timezone;
                break;
              }
            }
          }

          if (timezoneInfo) break;
        }

        // Format time display without overriding time with timezone
        const formattedDate = `${this.formatDateForDisplay(date)} ${hour}:00-${hour+1}:00`;

        // Store timezone separately instead of appending to the formatted date
        const timezoneName = timezoneInfo;

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
            // Convert timestamps to milliseconds
            const startTimeMs = dateData.startTimestamp.seconds * 1000;
            const endTimeMs = dateData.endTimestamp.seconds * 1000;

            // Extract the original hours without timezone conversion
            const startDate = new Date(startTimeMs);
            const endDate = new Date(endTimeMs);

            // Extract the original hour values directly
            const timezone = dateData.timezone || participant.timezone;
            console.log(`Processing time range with timezone: ${timezone}`);
            console.log(`Original start time: ${startDate.toISOString()}`);
            console.log(`Original end time: ${endDate.toISOString()}`);

            // Extract the raw hours directly (this avoids timezone conversion)
            const startHour = startDate.getUTCHours();
            const endHour = endDate.getUTCHours();

            console.log(`Extracted hours: Start=${startHour}, End=${endHour}`);

            // Match slots based on raw hour value rather than timestamp comparison
            this.uniqueDates.forEach((slot, index) => {
              if (slot.slotStart && slot.slotEnd) {
                // Extract the slot hour
                const slotHour = slot.slotStart.getHours();
                // Extract the date string to see if it's the same day
                const slotDateStr = this.formatDateKey(slot.date);
                const itemDateStr = this.formatDateKey(startDate);

                // Only consider slots for the same date
                if (slotDateStr === itemDateStr) {
                  // Check if this hour falls within the time range
                  if (slotHour >= startHour && slotHour < endHour) {
                    participantAvailability[index] = 'available';
                    console.log(`Marking slot ${slotHour}:00 as available`);
                  }
                }
              }
            });
          } else if (dateData.timestamp) {
            // Fallback for regular timestamps (unlikely in meeting mode)
            const timestampMs = dateData.timestamp.seconds * 1000;
            const date = new Date(timestampMs);

            // Get timezone info
            const timezone = dateData.timezone || participant.timezone;

            // Log timezone information if available
            if (timezone) {
              console.log(`Using fallback with timezone: ${timezone}`);
              console.log(`Original time: ${date.toISOString()}`);
            }

            // Use the UTC hour to avoid conversion
            const dateString = this.formatDateKey(date);
            const hour = date.getUTCHours(); // Use UTC hour instead of local hour
            console.log(`Extracted hour from timestamp: ${hour}`);

            const slotKey = `${dateString}-${hour}`;
            console.log(`Looking for slot key: ${slotKey}`);

            const slotIndex = this.uniqueDates.findIndex(slot => slot.dateString === slotKey);
            if (slotIndex !== -1) {
              participantAvailability[slotIndex] = 'available';
              console.log(`Marking fallback slot ${hour}:00 as available`);
            }
          }
        });
      }

      this.availabilityMap.set(participant.id || participant.name, participantAvailability);
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
  formatDateForDisplay(date: Date, timezone?: string): string {
    if (this.event?.isMeeting) {
      // For meetings, include the time
      const formattedTime = `${date.getHours()}:00-${date.getHours() + 1}:00`;

      // Include timezone abbreviation if available
      const timezoneInfo = timezone ? ` (${timezone})` : '';

      return `${date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })} ${formattedTime}${timezoneInfo}`;
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  /**
   * Format just the day part of a date
   */
  formatDayOnly(date: Date): string {
    return date.toLocaleDateString('en-US', {
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
  downloadICalForDate(dateInfo: {date: Date, dateString: string, formattedDate: string}): void {
    if (!this.event) return;

    // Generate the iCalendar content
    const icalContent = this.iCalendarService.generateICalendarFile(
      this.event,
      dateInfo.date,
      dateInfo.formattedDate
    );

    // Create a filename with the event title and date
    const safeTitle = (this.event.title || 'Event').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${safeTitle}_${dateInfo.dateString}.ics`;

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