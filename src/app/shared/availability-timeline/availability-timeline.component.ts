import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Event } from '../../core/models/event.model';
import { Participant } from '../../core/models/participant.model';
import { DateTime } from 'luxon';

interface DateInfo {
  date: Date;
  dateString: string;
  formattedDate: string;
  slotStart?: Date;
  slotEnd?: Date;
  timezone?: string;
}

@Component({
  selector: 'app-availability-timeline',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './availability-timeline.component.html',
  styleUrls: ['./availability-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvailabilityTimelineComponent implements OnInit, OnChanges {
  @Input() event!: Event;
  @Input() participants: Participant[] = [];
  @Input() mode: 'view' | 'select' = 'view';
  @Input() preselectedSlots: string[] = [];
  @Input() isAdmin: boolean = false;
  @Output() slotsSelected = new EventEmitter<string[]>();
  @Output() downloadRequested = new EventEmitter<DateInfo>();

  uniqueDates: DateInfo[] = [];
  availabilityMap = new Map<string, string[]>();
  displayColumns: string[] = ['participant'];
  footerColumns: string[] = ['available'];
  commonAvailableSlots: string[] = [];
  selectedSlotKeys = new Set<string>();
  viewerTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private availableCountCache = new Map<string, number>();

  // Expose Math for template
  Math = Math;

  ngOnInit(): void {
    // Initialize preselected slots
    if (this.preselectedSlots && this.preselectedSlots.length > 0) {
      this.selectedSlotKeys = new Set(this.preselectedSlots);
    }
    this.processAvailabilityData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['participants'] || changes['event']) {
      this.processAvailabilityData();
    }
    if (changes['preselectedSlots']) {
      this.selectedSlotKeys = new Set(this.preselectedSlots);
    }
  }

  processAvailabilityData(): void {
    // Clear any existing data
    this.availabilityMap.clear();
    this.availableCountCache.clear();
    this.uniqueDates = [];
    this.displayColumns = ['participant'];
    this.footerColumns = ['available'];

    const isMeeting = this.event?.isMeeting || false;

    if (isMeeting) {
      this.processMeetingAvailability();
    } else {
      this.processRegularEventAvailability();
    }

    this.buildAvailableCountCache();
  }

  private buildAvailableCountCache(): void {
    this.availableCountCache.clear();
    this.uniqueDates.forEach((dateInfo, dateIndex) => {
      let count = 0;
      this.participants.forEach(participant => {
        const availability = this.availabilityMap.get(participant.id || participant.name);
        if (availability && availability[dateIndex] === 'available') {
          count++;
        }
      });
      this.availableCountCache.set(dateInfo.dateString, count);
    });
  }

  processRegularEventAvailability(): void {
    // Extract all dates from all participants
    const allDates = new Set<string>();

    // First pass: collect all unique dates
    this.participants.forEach(participant => {
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(dateData => {
          // Check for various timestamp formats
          if (dateData.timestamp && dateData.timestamp.seconds) {
            const date = new Date(dateData.timestamp.seconds * 1000);
            const dateString = this.formatDateKeyFromLocalDate(date);
            allDates.add(dateString);
          }
          // Handle time range data - use start date
          else if (dateData.startTimestamp && dateData.startTimestamp.seconds) {
            const date = new Date(dateData.startTimestamp.seconds * 1000);
            const dateString = this.formatDateKeyFromLocalDate(date);
            allDates.add(dateString);
          }
          // Legacy format - direct seconds value
          else if (dateData.seconds) {
            const date = new Date(dateData.seconds * 1000);
            const dateString = this.formatDateKeyFromLocalDate(date);
            allDates.add(dateString);
          }
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
            dateString = this.formatDateKeyFromLocalDate(date);
          }
          // Handle time range data - use start date
          else if (dateData.startTimestamp && dateData.startTimestamp.seconds) {
            const date = new Date(dateData.startTimestamp.seconds * 1000);
            dateString = this.formatDateKeyFromLocalDate(date);
          }
          // Legacy format - direct seconds value
          else if (dateData.seconds) {
            const date = new Date(dateData.seconds * 1000);
            dateString = this.formatDateKeyFromLocalDate(date);
          }

          if (dateString) {
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
            const startDate = new Date(dateData.startTimestamp.seconds * 1000);
            const endDate = new Date(dateData.endTimestamp.seconds * 1000);

            const startDateString = this.formatDateKey(startDate);
            allDates.add(startDateString);

            const endDateString = this.formatDateKey(endDate);
            if (endDateString !== startDateString) {
              allDates.add(endDateString);
            }
          } else if (dateData.timestamp) {
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

    // Find earliest start time and latest end time from all participants
    let earliestMinuteOfDay = 24 * 60;
    let latestMinuteOfDay = 0;

    this.participants.forEach(participant => {
      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(dateData => {
          if (dateData.startTimestamp && dateData.endTimestamp) {
            const participantTimezone = dateData.timezone || participant.timezone || 'Europe/Zurich';

            const utcStartDate = DateTime.fromSeconds(dateData.startTimestamp.seconds, { zone: 'utc' });
            const utcEndDate = DateTime.fromSeconds(dateData.endTimestamp.seconds, { zone: 'utc' });

            const startDate = utcStartDate.setZone(participantTimezone, { keepLocalTime: true });
            const endDate = utcEndDate.setZone(participantTimezone, { keepLocalTime: true });

            const startMinutes = startDate.hour * 60 + startDate.minute;
            const endMinutes = endDate.hour * 60 + endDate.minute;

            earliestMinuteOfDay = Math.min(earliestMinuteOfDay, startMinutes);
            latestMinuteOfDay = Math.max(latestMinuteOfDay, endMinutes);
          }
        });
      }
    });

    // Apply reasonable bounds
    if (earliestMinuteOfDay === 24 * 60) {
      earliestMinuteOfDay = 7 * 60;
    }
    if (latestMinuteOfDay === 0) {
      latestMinuteOfDay = 19 * 60;
    }

    // Ensure minimum 2-hour range
    if (latestMinuteOfDay - earliestMinuteOfDay < 2 * 60) {
      earliestMinuteOfDay = Math.max(0, earliestMinuteOfDay - 60);
      latestMinuteOfDay = Math.min(24 * 60, latestMinuteOfDay + 60);
    }

    // Round to 15-minute intervals
    earliestMinuteOfDay = Math.floor(earliestMinuteOfDay / 15) * 15;
    latestMinuteOfDay = Math.ceil(latestMinuteOfDay / 15) * 15;

    // Create time slots for each date
    sortedDates.forEach(dateString => {
      const date = new Date(dateString);

      for (let minuteOfDay = earliestMinuteOfDay; minuteOfDay < latestMinuteOfDay; minuteOfDay += meetingDuration) {
        if (minuteOfDay + meetingDuration <= latestMinuteOfDay) {
          const hours = Math.floor(minuteOfDay / 60);
          const minutes = minuteOfDay % 60;

          const endHours = Math.floor((minuteOfDay + meetingDuration) / 60);
          const endMinutes = (minuteOfDay + meetingDuration) % 60;

          const slotDate = new Date(date);
          slotDate.setHours(hours, minutes, 0, 0);

          const slotEndDate = new Date(date);
          slotEndDate.setHours(endHours, endMinutes, 0, 0);

          const slotKey = `${dateString}-${hours.toString().padStart(2, '0')}-${minutes.toString().padStart(2, '0')}`;

          const formattedStartTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          const formattedEndTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

          const formattedDate = `${this.formatDateForDisplay(date)} ${formattedStartTime}-${formattedEndTime}`;

          this.uniqueDates.push({
            date: slotDate,
            dateString: slotKey,
            formattedDate,
            slotStart: slotDate,
            slotEnd: slotEndDate,
            timezone: this.viewerTimezone
          });

          this.displayColumns.push(slotKey);
          this.footerColumns.push(slotKey);
        }
      }
    });

    // Second pass: populate availability map
    this.participants.forEach(participant => {
      const participantAvailability: string[] = [];

      this.uniqueDates.forEach(() => {
        participantAvailability.push('unavailable');
      });

      if (participant.parsedDates && participant.parsedDates.length > 0) {
        participant.parsedDates.forEach(dateData => {
          if (dateData.startTimestamp && dateData.endTimestamp) {
            const participantTimezone = dateData.timezone || participant.timezone || 'Europe/Zurich';

            const utcStartDate = DateTime.fromSeconds(dateData.startTimestamp.seconds, { zone: 'utc' });
            const utcEndDate = DateTime.fromSeconds(dateData.endTimestamp.seconds, { zone: 'utc' });

            const luxonStartDate = utcStartDate.setZone(participantTimezone, { keepLocalTime: true });
            const luxonEndDate = utcEndDate.setZone(participantTimezone, { keepLocalTime: true });

            const startInViewerTZ = luxonStartDate.setZone(this.viewerTimezone);
            const endInViewerTZ = luxonEndDate.setZone(this.viewerTimezone);

            this.uniqueDates.forEach((slot, index) => {
              if (slot.slotStart && slot.slotEnd) {
                const slotStartDateTime = DateTime.fromJSDate(slot.slotStart).setZone(this.viewerTimezone);
                const slotEndDateTime = DateTime.fromJSDate(slot.slotEnd).setZone(this.viewerTimezone);

                const slotStartTs = slotStartDateTime.toMillis();
                const slotEndTs = slotEndDateTime.toMillis();
                const participantStartTs = startInViewerTZ.toMillis();
                const participantEndTs = endInViewerTZ.toMillis();

                if (slotStartTs >= participantStartTs && slotEndTs <= participantEndTs) {
                  participantAvailability[index] = 'available';
                }
              }
            });
          }
        });
      }

      this.availabilityMap.set(participant.id || participant.name, participantAvailability);
    });

    // Find common available time slots
    this.findCommonAvailableTimeSlots();
  }

  findCommonAvailableTimeSlots(): void {
    this.commonAvailableSlots = [];

    if (this.participants.length === 0) {
      return;
    }

    this.uniqueDates.forEach((dateInfo) => {
      const availableCount = this.getAvailableCountForDate(dateInfo.dateString);
      if (availableCount === this.participants.length) {
        this.commonAvailableSlots.push(dateInfo.dateString);
      }
    });
  }

  formatDateKey(date: Date | DateTime): string {
    if (date instanceof DateTime) {
      return date.toISODate() || '';
    } else {
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toISOString().split('T')[0];
    }
  }

  /**
   * Format a date as YYYY-MM-DD using local timezone (not UTC)
   * This fixes the T-1 display issue when showing dates
   */
  formatDateKeyFromLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateForDisplay(date: Date | DateTime): string {
    const luxonDate = date instanceof DateTime
      ? date
      : DateTime.fromJSDate(date).setZone(this.viewerTimezone);

    return luxonDate.toFormat('EEE, MMM d');
  }

  formatDayOnly(date: Date): string {
    const luxonDate = DateTime.fromJSDate(date).setZone(this.viewerTimezone);
    return luxonDate.toFormat('EEE, MMM d');
  }

  isFirstTimeSlotOfDay(dateInfo: DateInfo): boolean {
    if (!this.event?.isMeeting) {
      return false;
    }

    const currentDateKey = this.formatDateKey(dateInfo.date);
    const currentIndex = this.uniqueDates.findIndex(d => d.dateString === dateInfo.dateString);

    if (currentIndex === 0) {
      return true;
    }

    const previousDateKey = this.formatDateKey(this.uniqueDates[currentIndex - 1].date);
    return currentDateKey !== previousDateKey;
  }

  isCommonAvailableSlot(dateString: string): boolean {
    return this.commonAvailableSlots.includes(dateString);
  }

  getParticipationClass(dateString: string): string {
    const count = this.getAvailableCountForDate(dateString);
    const total = this.participants.length;

    if (total === 0) {
      return '';
    }

    const percentage = (count / total) * 100;

    if (percentage <= 50) {
      return 'participation-low';
    } else if (percentage <= 75) {
      return 'participation-medium';
    } else {
      return 'participation-high';
    }
  }

  getAvailableCountForDate(dateString: string): number {
    return this.availableCountCache.get(dateString) || 0;
  }

  isParticipantAvailable(participant: Participant, dateString: string): boolean {
    const dateIndex = this.uniqueDates.findIndex(d => d.dateString === dateString);

    if (dateIndex === -1) {
      return false;
    }

    const availability = this.availabilityMap.get(participant.id || participant.name);
    return availability ? availability[dateIndex] === 'available' : false;
  }

  getAvailabilityClass(isAvailable: boolean): string {
    return isAvailable ? 'available' : 'unavailable';
  }

  // Selection mode methods
  toggleSlot(dateKey: string): void {
    if (this.mode !== 'select') {
      return;
    }

    if (this.selectedSlotKeys.has(dateKey)) {
      this.selectedSlotKeys.delete(dateKey);
    } else {
      this.selectedSlotKeys.add(dateKey);
    }

    this.slotsSelected.emit(Array.from(this.selectedSlotKeys));
  }

  isSelected(dateKey: string): boolean {
    return this.selectedSlotKeys.has(dateKey);
  }

  /**
   * Request download of iCalendar file for a specific date/time slot
   */
  requestDownload(dateInfo: DateInfo): void {
    this.downloadRequested.emit(dateInfo);
  }
}
