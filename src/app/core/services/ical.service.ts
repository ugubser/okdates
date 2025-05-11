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
   * @returns The iCalendar file content as a string
   */
  generateICalendarFile(event: Event, date: Date, formattedDate: string): string {
    // Format dates according to iCalendar specs (YYYYMMDDTHHmmssZ)
    const now = new Date();
    const dtstamp = this.formatDateForICal(now);
    
    // Setup event date information with start and end times if available
    const eventDate = new Date(date);
    const startTime = event.startTime ? event.startTime.split(':') : ['00', '00'];
    const endTime = event.endTime ? event.endTime.split(':') : ['01', '00'];
    
    // Set the start and end times on the event date
    const startDate = new Date(eventDate);
    startDate.setHours(parseInt(startTime[0], 10), parseInt(startTime[1], 10), 0);
    
    const endDate = new Date(eventDate);
    endDate.setHours(parseInt(endTime[0], 10), parseInt(endTime[1], 10), 0);
    
    // Format dates for iCalendar
    const dtstart = this.formatDateForICal(startDate);
    const dtend = this.formatDateForICal(endDate);
    
    // Create a unique identifier for the event
    const uid = `${this.formatDateForICal(now)}-${event.id}@okdates.web.app`;
    
    // Clean up description for iCalendar format
    const description = this.escapeText(event.description || '');
    const summary = this.escapeText(event.title || 'Untitled Event');
    const location = this.escapeText(event.location || '');
    
    // Build the iCalendar content
    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:OkDates',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      '',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`
    ].join('\r\n');
    
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
   * Format a date according to iCalendar specifications (YYYYMMDDTHHmmssZ)
   * @param date The date to format
   * @returns Formatted date string
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