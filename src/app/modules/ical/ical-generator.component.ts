import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DateParsingService } from '../../core/services/date-parsing.service';
import { ICalendarService, ICalEventInput } from '../../core/services/ical.service';
import { ParsedDate } from '../../core/models/parsed-date.model';

type IcalMode = 'dates' | 'times';

@Component({
  selector: 'app-ical-generator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatCheckboxModule
  ],
  templateUrl: './ical-generator.component.html',
  styleUrls: ['./ical-generator.component.scss']
})
export class IcalGeneratorComponent implements OnInit {
  /** Event title used as the SUMMARY for every generated entry */
  title = '';
  /** Optional location applied to every generated entry */
  location = '';
  /** Free-text prose describing the dates/times */
  rawInput = '';
  /** 'dates' = all-day events, 'times' = timed events with a timezone */
  mode: IcalMode = 'dates';
  /** Timezone for timed events */
  timezone: string;

  parsedDates: ParsedDate[] = [];
  /** Parallel array tracking which parsed entries are checked for download */
  selected: boolean[] = [];
  showResults = false;
  isParsing = false;
  parseError = '';

  timezones: { value: string; label: string }[] = [];

  constructor(
    private dateParsingService: DateParsingService,
    private iCalService: ICalendarService
  ) {
    this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  ngOnInit(): void {
    this.populateTimezones();
  }

  get isMeeting(): boolean {
    return this.mode === 'times';
  }

  get selectedCount(): number {
    return this.selected.filter(Boolean).length;
  }

  /** Parse the prose into dates/time-slots via the LLM Cloud Function */
  async parse(): Promise<void> {
    const input = this.rawInput.trim();
    if (!input) {
      return;
    }

    this.isParsing = true;
    this.parseError = '';

    try {
      const timezone = this.isMeeting ? this.timezone : null;
      const result = await this.dateParsingService.parseWithTitle(input, this.isMeeting, timezone);

      this.parsedDates = result.dates || [];
      this.selected = this.parsedDates.map(() => true);
      this.showResults = true;

      // Pre-fill the title from the LLM only if the user hasn't typed one
      if (!this.title.trim() && result.title) {
        this.title = result.title;
      }
    } catch (error: any) {
      console.error('Error parsing dates for iCal:', error);
      this.parseError = error?.message || 'Failed to parse the text. Please try a different format.';
      this.parsedDates = [];
      this.selected = [];
      this.showResults = true;
    } finally {
      this.isParsing = false;
    }
  }

  /** Build the .ics file from the checked entries and trigger a download */
  download(): void {
    const events: ICalEventInput[] = [];

    this.parsedDates.forEach((d, i) => {
      if (!this.selected[i]) {
        return;
      }

      const summary = this.title.trim() || 'Event';
      const location = this.location.trim() || undefined;

      if (this.isMeeting && d.startTimestamp && d.endTimestamp) {
        events.push({
          summary,
          location,
          allDay: false,
          start: new Date(d.startTimestamp.seconds * 1000),
          end: new Date(d.endTimestamp.seconds * 1000),
          timezone: this.timezone,
          uid: `okdates-ical-${i}-${d.startTimestamp.seconds}@okdates.web.app`
        });
      } else if (d.timestamp) {
        events.push({
          summary,
          location,
          allDay: true,
          start: new Date(d.timestamp.seconds * 1000),
          uid: `okdates-ical-${i}-${d.timestamp.seconds}@okdates.web.app`
        });
      }
    });

    if (events.length === 0) {
      return;
    }

    const content = this.iCalService.generateMultiEventCalendar(events);
    const safeTitle = (this.title.trim() || 'event').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    this.iCalService.downloadICalFile(content, `${safeTitle}.ics`);
  }

  /** Human-readable label for a parsed entry in the review list */
  formatEntry(d: ParsedDate): string {
    if (d.startTimestamp && d.endTimestamp) {
      const start = new Date(d.startTimestamp.seconds * 1000);
      const end = new Date(d.endTimestamp.seconds * 1000);
      const dateStr = new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
      }).format(start);
      const time = (dt: Date) =>
        `${dt.getUTCHours().toString().padStart(2, '0')}:${dt.getUTCMinutes().toString().padStart(2, '0')}`;
      return `${dateStr} from ${time(start)} to ${time(end)} (${this.timezone})`;
    } else if (d.timestamp) {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
      }).format(new Date(d.timestamp.seconds * 1000));
    }
    return d.originalText || '';
  }

  /** Reset results when switching modes so stale dates aren't carried over */
  onModeChange(): void {
    this.showResults = false;
    this.parsedDates = [];
    this.selected = [];
    this.parseError = '';
  }

  /**
   * Populates the timezone dropdown with common options.
   * Mirrors the participant form so the two flows feel consistent.
   */
  populateTimezones(): void {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.timezones = [
      { value: userTimezone, label: `Current (${userTimezone})` },
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'Europe/London', label: 'London (GMT)' },
      { value: 'Europe/Paris', label: 'Central Europe (CET)' },
      { value: 'Europe/Helsinki', label: 'Eastern Europe (EET)' },
      { value: 'Asia/Dubai', label: 'Dubai (GST)' },
      { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      { value: 'Australia/Sydney', label: 'Sydney (AET)' }
    ];

    // De-duplicate in case the user's timezone is already in the common list
    const seen = new Set<string>();
    this.timezones = this.timezones.filter(tz => {
      if (seen.has(tz.value)) {
        return false;
      }
      seen.add(tz.value);
      return true;
    });
  }
}
