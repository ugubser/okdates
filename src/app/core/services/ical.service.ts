import { Injectable } from '@angular/core';
import { Event } from '../models/event.model';
import { DateTime } from 'luxon';

/**
 * A single calendar entry used by {@link ICalendarService.generateMultiEventCalendar}.
 * Date components are read in UTC, matching how OkDates stores wall-clock time as
 * UTC seconds (see the parsing Cloud Function).
 */
export interface ICalEventInput {
  /** Event title (SUMMARY) */
  summary: string;
  /** Optional free-text description */
  description?: string;
  /** Optional location */
  location?: string;
  /** When true the entry is an all-day event (DATE value type, no time) */
  allDay: boolean;
  /** For all-day: the day to use. For timed: the wall-clock start */
  start: Date;
  /** Wall-clock end (timed events only) */
  end?: Date;
  /** IANA timezone for timed events; omit for all-day or floating UTC */
  timezone?: string;
  /** Globally unique identifier for this VEVENT */
  uid: string;
}

@Injectable({
  providedIn: 'root'
})
export class ICalendarService {

  constructor() {}

  /**
   * Build a single iCalendar file containing one VEVENT per supplied entry.
   * Used by the standalone "Create iCAL for download" tool, where free-text
   * prose is parsed into several dates/time-slots that all share one title.
   * @param events The calendar entries to include
   * @returns The complete iCalendar (VCALENDAR) content as a string
   */
  generateMultiEventCalendar(events: ICalEventInput[]): string {
    const dtstamp = this.formatDateForICal(new Date());

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:OkDates',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    for (const ev of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${ev.uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);

      if (ev.allDay) {
        // All-day events use the DATE value type; DTEND is exclusive (next day)
        const next = new Date(Date.UTC(
          ev.start.getUTCFullYear(),
          ev.start.getUTCMonth(),
          ev.start.getUTCDate() + 1
        ));
        lines.push(`DTSTART;VALUE=DATE:${this.formatDateOnly(ev.start)}`);
        lines.push(`DTEND;VALUE=DATE:${this.formatDateOnly(next)}`);
      } else if (ev.timezone && ev.end) {
        // Convert stored wall-clock values to real UTC instants. UTC DTSTART
        // needs no VTIMEZONE and is portable across calendar applications.
        lines.push(`DTSTART:${this.formatDateForICal(this.wallClockToInstant(ev.start, ev.timezone))}`);
        lines.push(`DTEND:${this.formatDateForICal(this.wallClockToInstant(ev.end, ev.timezone))}`);
      } else if (ev.end) {
        // Timed event without a timezone: emit as UTC
        lines.push(`DTSTART:${this.formatDateForICal(ev.start)}`);
        lines.push(`DTEND:${this.formatDateForICal(ev.end)}`);
      }

      lines.push(`SUMMARY:${this.escapeText(ev.summary || 'Untitled Event')}`);
      if (ev.description) {
        lines.push(`DESCRIPTION:${this.escapeText(ev.description)}`);
      }
      if (ev.location) {
        lines.push(`LOCATION:${this.escapeText(ev.location)}`);
      }
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Generate an iCalendar file for a specific event on a specific date
   * @param event The event data
   * @param date The specific date for the calendar event
   * @param formattedDate The formatted date string for display
   * @param slotStart Optional start time for meeting slots
   * @param slotEnd Optional end time for meeting slots
   * @param timezone Optional timezone information
   * @returns The iCalendar file content as a string
   */
  generateICalendarFile(
    event: Event, 
    date: Date, 
    formattedDate: string,
    slotStart?: Date,
    slotEnd?: Date,
    timezone?: string
  ): string {
    // Format dates according to iCalendar specs (YYYYMMDDTHHmmssZ)
    const now = new Date();
    const dtstamp = this.formatDateForICal(now);
    
    // Handle different date/time formats depending on event type
    let startDate: Date;
    let endDate: Date;
    const allDay = !(event.isMeeting && slotStart && slotEnd) && !(event.startTime && event.endTime);
    
    // For meeting mode with specific slot times
    if (event.isMeeting && slotStart && slotEnd) {
      console.log('Generating iCal for meeting mode with slot times:', slotStart, slotEnd);
      startDate = new Date(slotStart);
      endDate = new Date(slotEnd);
    } 
    // For regular events with defined start/end times
    else if (event.startTime && event.endTime) {
      console.log('Generating iCal for event with defined start/end times');
      const eventDate = new Date(date);
      const startTime = event.startTime.split(':');
      const endTime = event.endTime.split(':');
      
      const zone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const atTime = (time: string[]) => this.wallClockToInstant(new Date(Date.UTC(
        eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate(),
        Number(time[0]), Number(time[1])
      )), zone);
      startDate = atTime(startTime);
      endDate = atTime(endTime);
    } 
    // Default case - all day event
    else {
      console.log('Generating iCal for all-day event');
      startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      
      endDate = new Date(date);
      endDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
    }
    
    const dtstart = this.formatDateForICal(startDate);
    const dtend = this.formatDateForICal(endDate);
    
    // Create a unique identifier for the event
    const uid = `${this.formatDateForICal(now)}-${event.id}@okdates.web.app`;
    
    // Clean up description for iCalendar format
    let description = event.description || '';
    const summary = this.escapeText(event.title || 'Untitled Event');
    const location = this.escapeText(event.location || '');
    
    // Add meeting-specific information to the description if applicable
    if (event.isMeeting && event.meetingDuration) {
      const meetingInfo = `\nMeeting Duration: ${event.meetingDuration} minutes`;
      description = description ? `${description}${meetingInfo}` : meetingInfo;
    }
    description = this.escapeText(description);
    
    // Build the base iCalendar content
    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:OkDates',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      '',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`
    ].join('\r\n');
    
    icalContent += allDay
      ? `\r\nDTSTART;VALUE=DATE:${this.formatDateOnly(startDate)}\r\nDTEND;VALUE=DATE:${this.formatDateOnly(endDate)}`
      : `\r\nDTSTART:${dtstart}\r\nDTEND:${dtend}`;
    
    // Add summary
    icalContent += `\r\nSUMMARY:${summary}`;
    
    // Only add description if it exists
    if (description) {
      icalContent += `\r\nDESCRIPTION:${description}`;
    }
    
    // Only add location if it exists
    if (location) {
      icalContent += `\r\nLOCATION:${location}`;
    }
    
    // Complete the iCalendar content
    icalContent += [
      '',
      'END:VEVENT',
      '',
      'END:VCALENDAR'
    ].join('\r\n');
    
    return icalContent;
  }
  
  /**
   * Format a date according to iCalendar specifications in UTC (YYYYMMDDTHHmmssZ)
   * @param date The date to format
   * @returns Formatted date string for UTC timestamps
   */
  private formatDateForICal(date: Date): string {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }
  
  /**
   * Format the date portion only, in UTC (YYYYMMDD) — for all-day DATE values.
   */
  private formatDateOnly(date: Date): string {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private wallClockToInstant(date: Date, timezone: string): Date {
    const instant = DateTime.fromJSDate(date, { zone: 'utc' })
      .setZone(timezone, { keepLocalTime: true });
    if (!instant.isValid) throw new Error('Invalid calendar timezone or date');
    return instant.toJSDate();
  }
  
  /**
   * Escape special characters for iCalendar text fields
   * @param text The text to escape
   * @returns Escaped text
   */
  private escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }
  
  /**
   * Trigger download of an iCalendar file
   * @param content The iCalendar file content
   * @param filename The filename to use for the download
   */
  downloadICalFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Create a link element and trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
