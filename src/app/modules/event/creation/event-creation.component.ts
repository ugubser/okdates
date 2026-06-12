import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Subject, takeUntil } from 'rxjs';
import { EventService } from '../../../core/services/event.service';
import { Event } from '../../../core/models/event.model';
import { FirestoreService } from '../../../core/services/firestore.service';
import { AdminStorageService } from '../../../core/services/admin-storage.service';

@Component({
  selector: 'app-event-creation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './event-creation.component.html',
  styleUrls: ['./event-creation.component.scss']
})
export class EventCreationComponent implements OnInit, OnDestroy {
  eventForm: FormGroup;
  eventId: string = '';
  event: Event | null = null;
  isSaving = false;
  isCreatingNew = false;
  private destroy$ = new Subject<void>();
  isLoading = false;
  adminKey: string = '';
  isAdmin = false;
  isMeeting = false;

  timeError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private firestoreService: FirestoreService,
    private adminStorageService: AdminStorageService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.eventForm = this.fb.group({
      title: ['', [Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      location: ['', [Validators.maxLength(200)]],
      startTime: [null],
      endTime: [null],
      meetingDuration: [120, [Validators.min(15), Validators.max(720)]], // Default to 2 hours (120 minutes)
      adminPassword: ['', [Validators.maxLength(100)]],
      confirmPassword: ['', [Validators.maxLength(100)]]
    }, { validators: [this.timeValidator, this.passwordMatchValidator] });

    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    this.isCreatingNew = this.router.url.includes('/event/create');

    // Read admin key from localStorage (stored by AdminStorageService)
    if (this.eventId) {
      this.adminKey = this.adminStorageService.getAdminKey(this.eventId) || '';
    }

    // Subscribe to form value changes to update validation in real-time
    this.eventForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.checkTimeValidity();
      this.checkPasswordValidity();
    });

    // We'll handle start time changes through the change event instead
    // which works better with the native time input
  }
  
  // Password validator to check if passwords match
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const formGroup = control as FormGroup;
    const password = formGroup.get('adminPassword')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    
    // Only validate if both fields have values
    if (password && confirmPassword) {
      if (password !== confirmPassword) {
        return { passwordMismatch: true };
      }
    }
    
    return null;
  }
  
  // Check password validity and update error
  passwordError: string | null = null;
  
  checkPasswordValidity(): void {
    const password = this.eventForm.get('adminPassword')?.value;
    const confirmPassword = this.eventForm.get('confirmPassword')?.value;
    
    if (password && confirmPassword && password !== confirmPassword) {
      this.passwordError = 'Passwords do not match';
    } else {
      this.passwordError = null;
    }
  }

  // Custom validator function for the form
  timeValidator(control: AbstractControl): ValidationErrors | null {
    const formGroup = control as FormGroup;
    const startTime = formGroup.get('startTime')?.value;
    const endTime = formGroup.get('endTime')?.value;

    if (startTime && endTime) {
      let startHours = 0, startMinutes = 0, endHours = 0, endMinutes = 0;
      
      // Time inputs will now always be strings in format "HH:MM"
      if (startTime) {
        [startHours, startMinutes] = startTime.split(':').map(Number);
      }
      
      if (endTime) {
        [endHours, endMinutes] = endTime.split(':').map(Number);
      }

      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      if (endTotalMinutes <= startTotalMinutes) {
        return { invalidTimeRange: true };
      }
    }

    return null;
  }

  // Method to check time validity and update error message
  checkTimeValidity(): void {
    const startTime = this.eventForm.get('startTime')?.value;
    const endTime = this.eventForm.get('endTime')?.value;

    if (startTime && endTime) {
      // Time inputs will now always be strings in format "HH:MM"
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);

      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      if (endTotalMinutes <= startTotalMinutes) {
        this.timeError = 'End time must be after start time';
      } else {
        this.timeError = null;
      }
    } else {
      this.timeError = null;
    }
  }

  // Handle start time changes
  onStartTimeChange(): void {
    const startTime = this.eventForm.get('startTime')?.value;
    
    // Only set end time if start time exists and end time doesn't
    if (startTime && !this.eventForm.get('endTime')?.value) {
      this.setDefaultEndTime(startTime);
    }
    
    // Validate times
    this.checkTimeValidity();
  }
  
  // Method to set default end time (2 hours after start time)
  setDefaultEndTime(startTime: string): void {
    if (!startTime) return;

    // Parse time (format: "HH:MM")
    const [hours, minutes] = startTime.split(':').map(Number);
    let endHours = hours + 2;
    
    // Handle day overflow
    if (endHours >= 24) {
      endHours = endHours - 24;
    }
    
    // Format end time and set it in the form
    const endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    this.eventForm.get('endTime')?.setValue(endTime);
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    //console.log('Event creation component initialized');
    //console.log('isCreatingNew:', this.isCreatingNew);
    //console.log('eventId:', this.eventId);

    // Check if this is a meeting creation
    const isMeetingParam = this.route.snapshot.queryParamMap.get('isMeeting');
    this.isMeeting = isMeetingParam === 'true';
    //console.log('isMeeting:', this.isMeeting);

    if (this.isCreatingNew) {
      // Initialize a new empty event
      //console.log('Creating new event...');
      this.createNewEvent();
    } else if (this.eventId) {
      // Load existing event
      //console.log('Loading existing event...');
      this.loadEvent();
    } else {
      // Navigate to home if no event ID and not creating
      //console.log('No event ID and not creating, navigating to home...');
      this.router.navigate(['/']);
    }
  }
  
  createNewEvent(): void {
    // The Firestore document is created atomically in saveEvent() so that the
    // admin password (which is immutable after creation) is set as part of the
    // initial write. Here we only set up an in-memory placeholder so the form
    // renders; no document is written until the user saves.
    this.event = {
      createdAt: this.firestoreService.createTimestamp(),
      title: null,
      description: null,
      isActive: true,
      isMeeting: this.isMeeting
    };

    this.eventForm.patchValue({
      title: '',
      description: '',
      location: '',
      startTime: null,
      endTime: null,
      meetingDuration: this.isMeeting ? 120 : null, // Default to 2 hours for meetings
      adminPassword: '',
      confirmPassword: ''
    });
  }

  async loadEvent(): Promise<void> {
    try {
      this.isLoading = true;
      this.event = await this.eventService.getEventDirect(this.eventId);

      if (this.event) {
        // Check if this is a meeting
        this.isMeeting = this.event.isMeeting || false;

        // Verify admin access if not creating a new event. Access is granted by a
        // valid admin key OR a stored password-verified marker (set after the
        // admin passed the password check on the view page).
        if (!this.isCreatingNew) {
          let ok = false;
          if (this.adminKey) {
            ok = await this.eventService.verifyAdminKey(this.eventId, this.adminKey);
          }
          if (!ok && this.adminStorageService.isPasswordVerified(this.eventId)) {
            ok = true;
          }
          this.isAdmin = ok;

          if (!ok) {
            console.warn('No valid admin access - redirecting to view');
            this.router.navigate(['/event', this.eventId, 'view']);
            return;
          }
        }

        // Populate form
        this.eventForm.patchValue({
          title: this.event.title || '',
          description: this.event.description || '',
          location: this.event.location || '',
          startTime: this.event.startTime || null,
          endTime: this.event.endTime || null,
          meetingDuration: this.event.meetingDuration || (this.isMeeting ? 120 : null) // Default to 2 hours if it's a meeting
        });
      }
    } catch (error) {
      console.error('Error loading event:', error);
      this.router.navigate(['/']);
    } finally {
      this.isLoading = false;
    }
  }
  
  async saveEvent(): Promise<void> {
    // Check time validity before saving
    this.checkTimeValidity();
    this.checkPasswordValidity();

    if (this.eventForm.valid && (this.isCreatingNew || this.eventId) && !this.timeError && !this.passwordError) {
      try {
        this.isSaving = true;

        const { title, description, location, startTime, endTime, meetingDuration, adminPassword } = this.eventForm.value;
        let finalStartTime = startTime;
        let finalEndTime = endTime;

        // Non-secret fields, written on both create and edit.
        const fields: Partial<Event> = {
          title: title || null,
          description: description || null,
          isMeeting: this.isMeeting
        };

        // Only add location if it's not empty
        if (location) {
          fields.location = location;
        }

        // Add meeting duration if this is a meeting
        if (this.isMeeting && meetingDuration) {
          fields.meetingDuration = meetingDuration;
        }

        // If start time exists
        if (finalStartTime) {
          fields.startTime = finalStartTime;

          // If end time is missing, set it to start time + 2 hours
          if (!finalEndTime) {
            let hours: number, minutes: number;

            if (typeof finalStartTime === 'string') {
              [hours, minutes] = finalStartTime.split(':').map(Number);
              let endHours = hours + 2;

              // Handle day overflow
              if (endHours >= 24) {
                endHours = endHours - 24;
              }

              // Format end time
              finalEndTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }

            fields.endTime = finalEndTime;
          } else {
            // Use end time as is - validation will prevent invalid submissions
            fields.endTime = finalEndTime;
          }
        } else if (finalEndTime) {
          // If only end time is provided, add it to the update
          fields.endTime = finalEndTime;
        }

        if (this.isCreatingNew) {
          // Create the document atomically so the admin password (immutable
          // after creation) is part of the initial write.
          const { eventId, adminKey } = await this.eventService.createEventDirect(
            fields.title ?? null,
            fields.description ?? null,
            fields.location ?? null,
            this.isMeeting,
            adminPassword || null
          );
          this.eventId = eventId;
          this.adminKey = adminKey;
          this.adminStorageService.storeAdminKey(eventId, adminKey);

          // Persist the remaining non-secret fields (times, meeting duration).
          const { title: _t, description: _d, location: _l, ...rest } = fields;
          if (Object.keys(rest).length > 0) {
            await this.eventService.updateEvent(eventId, rest);
          }
        } else {
          // Edit: never write admin credentials (adminKey/adminPassword are
          // immutable after creation and enforced by firestore.rules).
          await this.eventService.updateEvent(this.eventId, fields);
        }

        // Redirect to the event view page after saving
        this.router.navigate(['/event', this.eventId, 'view']);
      } catch (error) {
        console.error('Error saving event:', error);
      } finally {
        this.isSaving = false;
      }
    }
  }
  
  copyEventLink(): void {
    const eventUrl = `${window.location.origin}/event/${this.eventId}/view`;
    navigator.clipboard.writeText(eventUrl);
    // Would add a notification here in a real app
  }
  
  copyAdminLink(): void {
    if (this.adminKey) {
      const adminUrl = `${window.location.origin}/event/${this.eventId}/view#admin=${this.adminKey}`;
      navigator.clipboard.writeText(adminUrl);
      // Would add a notification here in a real app
    }
  }
  
  // Expose window object for template
  get window(): Window {
    return window;
  }
}