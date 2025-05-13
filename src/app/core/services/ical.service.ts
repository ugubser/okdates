import { Injectable } from '@angular/core';
import { Event } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class ICalendarService {

  constructor() {}

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
      
      startDate = new Date(eventDate);
      startDate.setHours(parseInt(startTime[0], 10), parseInt(startTime[1], 10), 0);
      
      endDate = new Date(eventDate);
      endDate.setHours(parseInt(endTime[0], 10), parseInt(endTime[1], 10), 0);
    } 
    // Default case - all day event
    else {
      console.log('Generating iCal for all-day event');
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Format dates for iCalendar - handle timezone if provided
    const dtstart = timezone ? 
      this.formatDateForICalWithTimezone(startDate, timezone) : 
      this.formatDateForICal(startDate);
      
    const dtend = timezone ? 
      this.formatDateForICalWithTimezone(endDate, timezone) : 
      this.formatDateForICal(endDate);
    
    // Create a unique identifier for the event
    const uid = `${this.formatDateForICal(now)}-${event.id}@okdates.web.app`;
    
    // Clean up description for iCalendar format
    let description = this.escapeText(event.description || '');
    const summary = this.escapeText(event.title || 'Untitled Event');
    const location = this.escapeText(event.location || '');
    
    // Add meeting-specific information to the description if applicable
    if (event.isMeeting && event.meetingDuration) {
      const meetingInfo = `\nMeeting Duration: ${event.meetingDuration} minutes`;
      description = description ? `${description}${meetingInfo}` : meetingInfo;
    }
    
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
    
    // Add start and end times with timezone if applicable
    if (timezone) {
      // Add VTIMEZONE component
      icalContent += '\r\n' + [
        `BEGIN:VTIMEZONE`,
        `TZID:${timezone}`,
        `X-LIC-LOCATION:${timezone}`,
        `END:VTIMEZONE`
      ].join('\r\n');
      
      // Add start and end times with timezone
      const startWithTZ = dtstart as { dateTime: string, timezone: string };
      const endWithTZ = dtend as { dateTime: string, timezone: string };
      
      if (startWithTZ && startWithTZ.dateTime && startWithTZ.timezone) {
        icalContent += `\r\nDTSTART;TZID=${startWithTZ.timezone}:${startWithTZ.dateTime}`;
      } else {
        // Fallback to UTC if timezone object is invalid
        icalContent += `\r\nDTSTART:${dtstart}`;
      }
      
      if (endWithTZ && endWithTZ.dateTime && endWithTZ.timezone) {
        icalContent += `\r\nDTEND;TZID=${endWithTZ.timezone}:${endWithTZ.dateTime}`;
      } else {
        // Fallback to UTC if timezone object is invalid
        icalContent += `\r\nDTEND:${dtend}`;
      }
    } else {
      // Add UTC times without timezone
      icalContent += `\r\nDTSTART:${dtstart}`;
      icalContent += `\r\nDTEND:${dtend}`;
    }
    
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
   * Format a date according to iCalendar specifications with timezone (YYYYMMDDTHHMMSS)
   * @param date The date to format
   * @param timezone IANA timezone string
   * @returns Object with dateTime and timezone properties
   */
  private formatDateForICalWithTimezone(date: Date, timezone: string): { dateTime: string; timezone: string } {
    // We use the local date/time components directly without UTC conversion
    // The timezone identifier will be included in the iCal property
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    // For dates with timezone, we return the full format with TZID
    // This will be used in the DTSTART;TZID=... property
    return {
      dateTime: `${year}${month}${day}T${hours}${minutes}${seconds}`,
      timezone
    };
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
      .replace(/\n/g, '\\n');
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