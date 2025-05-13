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
import { DateTime } from 'luxon';

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
          // console.log('Admin access verified');
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
              // console.log(`Using timezone from date: ${timestamp.timezone}`);
            } else if (participant.timezone) {
              // console.log(`Using timezone from participant: ${participant.timezone}`);
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
    let earliestMinuteOfDay = 23 * 60; // Default to late (23:00)
    let latestMinuteOfDay = 9 * 60;    // Default to early (09:00)

    // Scan through all participants' time ranges to find min/max times
    this.participants.forEach(participant => {
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(dateData => {
          if (dateData.startTimestamp && dateData.endTimestamp) {
            // Get timezone and create proper DateTime objects
            const participantTimezone = dateData.timezone || participant.timezone || 'Europe/Zurich';
            const startDate = DateTime.fromSeconds(dateData.startTimestamp.seconds, { zone: 'UTC' }).setZone(participantTimezone);
            const endDate = DateTime.fromSeconds(dateData.endTimestamp.seconds, { zone: 'UTC' }).setZone(participantTimezone);

            // Update earliest/latest times in minutes of day
            const startMinutes = startDate.hour * 60 + startDate.minute;
            const endMinutes = endDate.hour * 60 + endDate.minute;
            
            earliestMinuteOfDay = Math.min(earliestMinuteOfDay, startMinutes);
            latestMinuteOfDay = Math.max(latestMinuteOfDay, endMinutes);
          }
        });
      }
    });

    // Apply some reasonable bounds if we don't have enough data
    earliestMinuteOfDay = Math.max(6 * 60, Math.min(earliestMinuteOfDay, 9 * 60));  // Between 6am and 9am
    latestMinuteOfDay = Math.min(23 * 60, Math.max(latestMinuteOfDay, 21 * 60));   // Between 9pm and 11pm

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

            // Let's try a different approach - first get a UTC DateTime
            const utcStartDate = DateTime.fromSeconds(dateData.startTimestamp.seconds, { zone: 'UTC' });
            const utcEndDate = DateTime.fromSeconds(dateData.endTimestamp.seconds, { zone: 'UTC' });

            // Look at the originalText to get the real time that was intended
            const originalText = dateData.originalText || '';

            // Parse out the hours from the original text if available
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

            // Create DateTime objects with the original hour/minute but in the participant's timezone
            // We need to rebuild the DateTime from its components
            const luxonStartDate = DateTime.fromObject({
              year: utcStartDate.year,
              month: utcStartDate.month,
              day: utcStartDate.day,
              hour: originalStartHour || utcStartDate.hour,
              minute: originalStartMinute || utcStartDate.minute,
              second: utcStartDate.second,
            }, { zone: participantTimezone });

            const luxonEndDate = DateTime.fromObject({
              year: utcEndDate.year,
              month: utcEndDate.month,
              day: utcEndDate.day,
              hour: originalEndHour || utcEndDate.hour,
              minute: originalEndMinute || utcEndDate.minute,
              second: utcEndDate.second,
            }, { zone: participantTimezone });

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

            // Get a UTC date first
            const utcDate = DateTime.fromSeconds(dateData.timestamp.seconds, { zone: 'UTC' });

            // Try to extract the original hour
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

            // Create a DateTime with the original hour in the participant's timezone
            const luxonDate = DateTime.fromObject({
              year: utcDate.year,
              month: utcDate.month,
              day: utcDate.day,
              hour: originalHour || utcDate.hour,
              minute: originalMinute || utcDate.minute,
              second: utcDate.second,
            }, { zone: participantTimezone });

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
   */
  isCommonAvailableSlot(dateString: string): boolean {
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