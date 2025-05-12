import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule, MatSelectionList } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { EventService } from '../../../core/services/event.service';
import { ParticipantService } from '../../../core/services/participant.service';
import { DateParsingService } from '../../../core/services/date-parsing.service';
import { ParticipantStorageService } from '../../../core/services/participant-storage.service';
import { Event } from '../../../core/models/event.model';
import { ParsedDate } from '../../../core/models/parsed-date.model';
import { Participant } from '../../../core/models/participant.model';

@Component({
  selector: 'app-participant-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSelectModule
  ],
  templateUrl: './participant-form.component.html',
  styleUrls: ['./participant-form.component.scss']
})
export class ParticipantFormComponent implements OnInit {
  @ViewChild('datesList') datesList!: MatSelectionList;

  participantForm: FormGroup;
  eventId: string;
  event: Event | null = null;
  parsedDates: ParsedDate[] = [];
  isSubmitting = false;
  isParsing = false;
  isLoading = true;
  showParsedDates = false;
  parsingTitle: string = '';
  isEditMode = false;
  participantId = '';
  existingParticipant: Participant | null = null;
  isAdmin = false;
  adminKey = '';

  // Timezone handling
  timezones: {value: string, label: string}[] = [];
  userTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private participantService: ParticipantService,
    private dateParsingService: DateParsingService,
    private participantStorageService: ParticipantStorageService
  ) {
    this.participantForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      availability: ['', [Validators.required, Validators.maxLength(500)]],
      timezone: [this.userTimezone, Validators.required]
    });

    // Populate timezone list
    this.populateTimezones();
    
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
  }
  
  ngOnInit(): void {
    if (this.eventId) {
      // Check for edit mode - either via query param or if we have a participantId in the route
      this.isEditMode = this.route.snapshot.queryParamMap.get('edit') === 'true';
      
      // Get participant ID either from the route or from query params
      const routeParticipantId = this.route.snapshot.paramMap.get('participantId');
      const queryParticipantId = this.route.snapshot.queryParamMap.get('participantId');
      
      this.participantId = routeParticipantId || queryParticipantId || '';
      
      // Check for admin key in query params
      this.adminKey = this.route.snapshot.queryParamMap.get('adminKey') || '';
      
      // If we have a participant ID in the route, we're definitely in edit mode
      if (routeParticipantId) {
        this.isEditMode = true;
      }
      
      // Load event and participant data
      this.loadEvent();
    } else {
      this.router.navigate(['/']);
    }
  }
  
  async loadEvent(): Promise<void> {
    try {
      this.isLoading = true;
      this.event = await this.eventService.getEventDirect(this.eventId);
      
      if (!this.event) {
        this.router.navigate(['/']);
        return;
      }
      
      // Check if admin key is valid
      if (this.adminKey) {
        this.isAdmin = await this.eventService.verifyAdminKey(this.eventId, this.adminKey);
      }
      
      // If in edit mode, load the existing participant data
      if (this.isEditMode && this.participantId) {
        // Fetch the participant data
        this.existingParticipant = await this.participantService.getParticipantDirect(
          this.eventId,
          this.participantId
        );
        
        if (this.existingParticipant) {
          // Verify that the user is either the admin or the owner of this participant
          const isOwner = this.participantStorageService.isParticipantOwner(
            this.eventId, 
            this.participantId
          );
          
          if (!isOwner && !this.isAdmin) {
            // Redirect to view page if not the owner or admin
            console.warn('User is not the owner of this participant entry and not an admin');
            this.router.navigate(['/event', this.eventId, 'view']);
            return;
          }
          
          // Populate the form with existing data
          this.participantForm.patchValue({
            name: this.existingParticipant.name,
            availability: this.existingParticipant.rawDateInput
          });
          
          // Convert the existing parsed dates to our format
          if (this.existingParticipant.parsedDates && this.existingParticipant.parsedDates.length > 0) {
            this.parsedDates = this.existingParticipant.parsedDates.map(timestamp => {
              return {
                timestamp,
                originalText: '', // We don't have this info from storage
                isConfirmed: true
              };
            });
          }
        } else {
          console.warn('Participant not found:', this.participantId);
          this.router.navigate(['/event', this.eventId, 'view']);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading event or participant:', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  async parseDates(): Promise<void> {
    if (this.participantForm.get('availability')?.valid) {
      try {
        this.isParsing = true;
        const rawDateInput = this.participantForm.get('availability')?.value;

        // Check if this is a meeting event or a regular event
        const isMeeting = this.event?.isMeeting || false;

        // Get the selected timezone (only relevant for meetings)
        const timezone = isMeeting ? this.participantForm.get('timezone')?.value : null;
        console.log(`Using timezone: ${timezone || 'default'}`);

        // Use the LLM-based parsing
        console.log(`Parsing ${isMeeting ? 'meeting times' : 'dates'} using LLM...`);
        this.parsedDates = await this.dateParsingService.parseLlm(rawDateInput, isMeeting, timezone);
        console.log('Parsed dates:', this.parsedDates);

        this.showParsedDates = true;
      } catch (error) {
        console.error('Error parsing dates:', error);

        // Fallback to client-side parsing if LLM fails
        const rawDateInput = this.participantForm.get('availability')?.value;
        const isMeeting = this.event?.isMeeting || false;
        const timezone = isMeeting ? this.participantForm.get('timezone')?.value : null;
        console.log('Falling back to client-side parsing...');
        this.parsedDates = this.dateParsingService.parseClientSide(rawDateInput, isMeeting, timezone);
      } finally {
        this.isParsing = false;
      }
    }
  }
  
  async submitParticipant(): Promise<void> {
    if (this.participantForm.valid && this.eventId) {
      try {
        this.isSubmitting = true;

        const name = this.participantForm.get('name')?.value;
        const rawDateInput = this.participantForm.get('availability')?.value;

        // If we haven't parsed dates yet, do it now
        if (!this.showParsedDates) {
          await this.parseDates();
        }

        // Debug: log parsed dates before processing
        console.log('Raw parsed dates before processing:', JSON.stringify(this.parsedDates));
        
        // Extract the timestamps for storage
        // For meetings, we need both startTimestamp and endTimestamp
        // For regular events, we need just timestamp
        const isMeeting = this.event?.isMeeting || false;

        const parsedDates = this.parsedDates.map(d => {
          if (isMeeting && d.startTimestamp && d.endTimestamp) {
            // For meeting time ranges
            return {
              startTimestamp: d.startTimestamp,
              endTimestamp: d.endTimestamp
            };
          } else if (d.timestamp) {
            // For regular event dates
            return {
              timestamp: d.timestamp
            };
          } else {
            console.error('Invalid date format:', d);
            // Return a placeholder to avoid undefined values
            return {
              timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 },
              note: 'Invalid date format'
            };
          }
        });

        // Debug: log processed dates
        console.log('Processed parsed dates:', JSON.stringify(parsedDates));

        // Clean the timestamps to remove any undefined values
        const cleanDates = this.cleanTimestampsForStorage(parsedDates);
        console.log('Cleaned dates for storage:', JSON.stringify(cleanDates));

        if (this.isEditMode && this.participantId && this.existingParticipant) {
          // Update existing participant
          await this.participantService.updateParticipantDirect(
            this.eventId,
            this.participantId,
            {
              name,
              rawDateInput,
              parsedDates: cleanDates,
              submittedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
            }
          );
          
          console.log('Updated participant:', this.participantId);
        } else {
          // Add new participant
          const result = await this.participantService.addParticipantDirect(
            this.eventId,
            name,
            rawDateInput,
            cleanDates
          );
          
          // Store participant ID in localStorage for future editing
          this.participantStorageService.storeParticipantId(this.eventId, result.participantId);
          console.log('Stored participant ID in localStorage:', result.participantId);
        }
        
        // Navigate to event view
        this.router.navigate(['/event', this.eventId, 'view']);
      } catch (error) {
        console.error('Error submitting participant:', error);
      } finally {
        this.isSubmitting = false;
      }
    }
  }
  
  confirmDates(): void {
    // Get the selected dates from the selection list
    const selectedOptions = this.datesList.selectedOptions.selected;
    console.log('Selected options:', selectedOptions);

    // Filter the parsedDates to include only selected ones
    const confirmedDates: ParsedDate[] = [];

    selectedOptions.forEach(option => {
      // Get the index from the option
      const index = parseInt(option._elementRef.nativeElement.getAttribute('data-index') || '0');
      if (!isNaN(index) && index >= 0 && index < this.parsedDates.length) {
        const date = {...this.parsedDates[index]};  // Make a copy to avoid references
        // Mark as confirmed
        date.isConfirmed = true;
        confirmedDates.push(date);
      }
    });

    console.log('Confirmed dates:', confirmedDates);

    // Update the parsed dates to only include confirmed ones
    this.parsedDates = confirmedDates;

    // Submit the participant
    this.submitParticipant();
  }
  
  backToDateInput(): void {
    this.showParsedDates = false;
  }

  /**
   * Helper method to clean timestamps for storage
   * This removes any undefined fields which Firestore doesn't accept
   */
  cleanTimestampsForStorage(dates: any[]): any[] {
    // First stringify and then parse to remove undefined values
    const cleanString = JSON.stringify(dates);
    return JSON.parse(cleanString);
  }
  
  formatDate(timestamp: any, startTimestamp?: any, endTimestamp?: any): string {
    const timezone = this.event?.isMeeting ?
      this.participantForm.get('timezone')?.value || Intl.DateTimeFormat().resolvedOptions().timeZone :
      undefined;

    if (startTimestamp && endTimestamp) {
      // Format a time range
      const startDate = new Date(startTimestamp.seconds * 1000);
      const endDate = new Date(endTimestamp.seconds * 1000);

      // Format the date part
      const dateFormatter = new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone
      });

      // Format the time part
      const timeFormatter = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: 'numeric',
        timeZone: timezone
      });

      // If the dates are on the same day, just show one date with time range
      const startDateStr = startDate.toLocaleDateString(undefined, { timeZone: timezone });
      const endDateStr = endDate.toLocaleDateString(undefined, { timeZone: timezone });

      if (startDateStr === endDateStr) {
        return `${dateFormatter.format(startDate)} from ${timeFormatter.format(startDate)} to ${timeFormatter.format(endDate)} (${timezone})`;
      } else {
        // If dates are different, show full range
        return `${dateFormatter.format(startDate)} ${timeFormatter.format(startDate)} to ${dateFormatter.format(endDate)} ${timeFormatter.format(endDate)} (${timezone})`;
      }
    } else if (timestamp) {
      // Format a single date
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    return '';
  }

  /**
   * Populates the timezone dropdown with common options
   */
  populateTimezones(): void {
    // Start with the user's current timezone
    this.timezones = [
      { value: this.userTimezone, label: `Current (${this.userTimezone})` },
    ];

    // Add common timezones
    const commonTimezones = [
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
      { value: 'Australia/Sydney', label: 'Sydney (AEST)' }
    ];

    // Only add common timezones that aren't already the user's timezone
    commonTimezones.forEach(tz => {
      if (tz.value !== this.userTimezone) {
        this.timezones.push(tz);
      }
    });
  }
}