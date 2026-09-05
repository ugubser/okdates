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
  @Input() preselectedRanges: any[] = [];
  @Output() selectionRestored = new EventEmitter<string[]>();
  @Input() isAdmin: boolean = false;
  @Input() set timezone(value: string) {
    if (value && value !== this.viewerTimezone) {
      this.viewerTimezone = value;
      // Clear selections since slot keys encode timezone-specific wall-clock times
      this.selectedSlotKeys.clear();
      this.slotsSelected.emit([]);
      this.processAvailabilityData();
    }
  }
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
    this.restoreRangeSelection();
    this.publishSelection();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['participants'] || changes['event']) {
      this.processAvailabilityData();
    }
    if (changes['preselectedSlots']) {
      this.selectedSlotKeys = new Set(this.preselectedSlots);
      this.publishSelection();
    }
    if (changes['preselectedRanges'] || changes['participants'] || changes['event']) {
      this.restoreRangeSelection();
    }
  }

  private restoreRangeSelection(): void {
    if (!this.event?.isMeeting || !this.preselectedRanges.length) return;
    const keys = this.uniqueDates.filter(slot => this.preselectedRanges.some(range => {
      if (!range.startTimestamp || !range.endTimestamp || !slot.slotStart || !slot.slotEnd) return false;
      const zone = range.timezone || this.viewerTimezone;
      const start = DateTime.fromSeconds(range.startTimestamp.seconds, { zone: 'utc' })
        .setZone(zone, { keepLocalTime: true }).toMillis();
      const end = DateTime.fromSeconds(range.endTimestamp.seconds, { zone: 'utc' })
        .setZone(zone, { keepLocalTime: true }).toMillis();
      return slot.slotStart.getTime() >= start && slot.slotEnd.getTime() <= end;
    })).map(slot => slot.dateString);
    this.selectedSlotKeys = new Set(keys);
    this.publishSelection(true);
  }

  private publishSelection(restored = false): void {
    const selection = this.selectedSlotKeys;
    // Publish after the parent's current change-detection pass has completed.
    queueMicrotask(() => {
      if (selection !== this.selectedSlotKeys) return;
      const keys = Array.from(selection);
      if (restored) this.selectionRestored.emit(keys);
      this.slotsSelected.emit(keys);
    });
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

    // Common-slot highlighting depends on the count cache, so run it last.
    if (isMeeting) {
      this.findCommonAvailableTimeSlots();
    }
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
        day: 'numeric',
        timeZone: 'UTC'
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
    const duration = this.event?.meetingDuration || 60;
    type Window = { start: DateTime; end: DateTime };
    const windows = new Map<string, Window[]>();
    const starts = new Map<number, DateTime>();

    // Work with full instants throughout, including date boundaries and DST.
    for (const participant of this.participants) {
      const ranges: Window[] = [];
      for (const d of participant.parsedDates || []) {
        if (!d.startTimestamp || !d.endTimestamp) continue;
        const zone = d.timezone || participant.timezone || 'Europe/Zurich';
        const toViewer = (seconds: number) => DateTime.fromSeconds(seconds, { zone: 'utc' })
          .setZone(zone, { keepLocalTime: true }).setZone(this.viewerTimezone);
        const start = toViewer(d.startTimestamp.seconds);
        const end = toViewer(d.endTimestamp.seconds);
        if (!start.isValid || !end.isValid || end.toMillis() <= start.toMillis()) continue;
        ranges.push({ start, end });
        starts.set(start.toMillis(), start);

        // An overnight or multi-day window also offers slots on subsequent days.
        for (let day = start.startOf('day').plus({ days: 1 }); day < end; day = day.plus({ days: 1 })) {
          starts.set(day.toMillis(), day);
        }
        if (this.mode === 'select') {
          for (let slot = start; slot.plus({ minutes: duration }) <= end; slot = slot.plus({ minutes: duration })) {
            starts.set(slot.toMillis(), slot);
          }
        }
      }
      // Adjacent selected blocks together cover a continuous availability window.
      const merged: Window[] = [];
      for (const range of ranges.sort((a, b) => a.start.toMillis() - b.start.toMillis())) {
        const previous = merged[merged.length - 1];
        if (previous && range.start <= previous.end) {
          if (range.end > previous.end) previous.end = range.end;
        } else {
          merged.push({ ...range });
        }
      }
      windows.set(participant.id || participant.name, merged);
    }

    for (const start of Array.from(starts.values()).sort((a, b) => a.toMillis() - b.toMillis())) {
      const end = start.plus({ minutes: duration });
      const key = start.toFormat('yyyy-MM-dd-HH-mm');
      // During the autumn clock change two instants can share a wall-clock key.
      // Keep one column since selection is represented by wall-clock keys.
      if (this.uniqueDates.some(slot => slot.dateString === key)) continue;
      const endLabel = start.toISODate() === end.toISODate()
        ? end.toFormat('HH:mm') : end.toFormat('MMM d HH:mm');
      this.uniqueDates.push({
        date: start.toJSDate(), dateString: key,
        formattedDate: `${start.toFormat('EEE, MMM d')} ${start.toFormat('HH:mm')}-${endLabel}`,
        slotStart: start.toJSDate(), slotEnd: end.toJSDate(), timezone: this.viewerTimezone
      });
      this.displayColumns.push(key);
      this.footerColumns.push(key);
    }

    for (const participant of this.participants) {
      const ranges = windows.get(participant.id || participant.name) || [];
      this.availabilityMap.set(participant.id || participant.name, this.uniqueDates.map(slot => {
        const start = slot.slotStart!.getTime();
        const end = slot.slotEnd!.getTime();
        if (ranges.some(r => r.start.toMillis() <= start && r.end.toMillis() >= end)) return 'available';
        if (ranges.some(r => r.start.toMillis() < end && r.end.toMillis() > start)) return 'partial';
        return 'unavailable';
      }));
    }
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
   * Read date-only values in UTC, independent of the viewer's timezone.
   */
  formatDateKeyFromLocalDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
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

  formatSlotTime(slot: DateInfo): string {
    if (!slot.slotStart || !slot.slotEnd) return '';
    const start = DateTime.fromJSDate(slot.slotStart).setZone(this.viewerTimezone);
    const end = DateTime.fromJSDate(slot.slotEnd).setZone(this.viewerTimezone);
    return start.toFormat('HH:mm') + '–' + end.toFormat(
      start.toISODate() === end.toISODate() ? 'HH:mm' : 'MMM d HH:mm'
    );
  }

  isFirstTimeSlotOfDay(dateInfo: DateInfo): boolean {
    if (!this.event?.isMeeting) {
      return false;
    }

    const currentDateKey = DateTime.fromJSDate(dateInfo.date).setZone(this.viewerTimezone).toISODate();
    const currentIndex = this.uniqueDates.findIndex(d => d.dateString === dateInfo.dateString);

    if (currentIndex === 0) {
      return true;
    }

    const previousDateKey = DateTime.fromJSDate(this.uniqueDates[currentIndex - 1].date).setZone(this.viewerTimezone).toISODate();
    return currentDateKey !== previousDateKey;
  }

  isCommonAvailableSlot(dateString: string): boolean {
    return this.commonAvailableSlots.includes(dateString);
  }

  /** True when every participant is available for the slot (regular events and meetings). */
  isEveryoneAvailable(dateString: string): boolean {
    if (this.participants.length === 0) {
      return false;
    }
    if (this.event?.isMeeting) {
      return this.isCommonAvailableSlot(dateString);
    }
    return this.getAvailableCountForDate(dateString) === this.participants.length;
  }

  /** "Mon" from a formatted "Mon, Jun 2" header. */
  headerWeekday(dateInfo: DateInfo): string {
    const idx = dateInfo.formattedDate.indexOf(',');
    return idx > 0 ? dateInfo.formattedDate.slice(0, idx) : dateInfo.formattedDate;
  }

  /** "Jun 2" from a formatted "Mon, Jun 2" header. */
  headerDay(dateInfo: DateInfo): string {
    const idx = dateInfo.formattedDate.indexOf(',');
    return idx > 0 ? dateInfo.formattedDate.slice(idx + 1).trim() : '';
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

  /**
   * Raw availability state for a participant/slot: 'available' | 'partial' | 'unavailable'.
   * 'partial' means the participant's window overlaps the slot but is shorter than
   * the meeting duration (rendered amber).
   */
  getParticipantSlotState(participant: Participant, dateString: string): string {
    const dateIndex = this.uniqueDates.findIndex(d => d.dateString === dateString);
    if (dateIndex === -1) {
      return 'unavailable';
    }
    const availability = this.availabilityMap.get(participant.id || participant.name);
    return availability ? availability[dateIndex] : 'unavailable';
  }

  getSlotStateTooltip(participant: Participant, dateString: string): string {
    return this.getParticipantSlotState(participant, dateString) === 'partial'
      ? 'Available here, but this window is shorter than the meeting duration'
      : '';
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
