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

    // Check for admin key in query params (passed from event view)
    this.adminKey = this.route.snapshot.queryParamMap.get('adminKey') || '';

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
  
  async createNewEvent(): Promise<void> {
    try {
      this.isLoading = true;
      //console.log('Creating event in Firestore...');

      // Initialize with empty title and description
      const { eventId, event } = await this.eventService.createEventDirect(null, null, null, this.isMeeting);
      //console.log('Event created with ID:', eventId);

      this.eventId = eventId;
      this.event = event;
      
      // Store admin key in localStorage to make this user the administrator
      if (event.adminKey) {
        this.adminKey = event.adminKey;
        this.adminStorageService.storeAdminKey(eventId, event.adminKey);
      }

      // Create an empty form for the user to fill out
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

      // Now the user can edit the empty event
      //console.log('New event ready for editing:', this.event);
    } catch (error) {
      console.error('Error creating event:', error);
      // Navigate back to home on error
      this.router.navigate(['/']);
    } finally {
      this.isLoading = false;
    }
  }
  
  async loadEvent(): Promise<void> {
    try {
      this.isLoading = true;
      this.event = await this.eventService.getEventDirect(this.eventId);

      if (this.event) {
        // Check if this is a meeting
        this.isMeeting = this.event.isMeeting || false;

        // Verify admin key if not creating new event
        if (this.adminKey && !this.isCreatingNew) {
          this.isAdmin = await this.eventService.verifyAdminKey(this.eventId, this.adminKey);

          if (!this.isAdmin) {
            console.warn('Invalid admin key provided - redirecting to view');
            this.router.navigate(['/event', this.eventId, 'view']);
            return;
          }
        } else if (!this.isCreatingNew) {
          // If no admin key is provided and we're not creating a new event, redirect to view
          console.warn('No admin key provided - redirecting to view');
          this.router.navigate(['/event', this.eventId, 'view']);
          return;
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

    if (this.eventForm.valid && this.eventId && !this.timeError && !this.passwordError) {
      try {
        this.isSaving = true;

        const { title, description, location, startTime, endTime, meetingDuration, adminPassword } = this.eventForm.value;
        let finalStartTime = startTime;
        let finalEndTime = endTime;

        // Create update object without empty time fields
        const updateData: Partial<Event> = {
          title: title || null,
          description: description || null,
          isMeeting: this.isMeeting
        };

        // Only add location if it's not empty
        if (location) {
          updateData.location = location;
        }

        // Add meeting duration if this is a meeting
        if (this.isMeeting && meetingDuration) {
          updateData.meetingDuration = meetingDuration;
        }

        // Add admin password if provided
        if (adminPassword) {
          updateData.adminPassword = adminPassword;
        }

        // If start time exists
        if (finalStartTime) {
          updateData.startTime = finalStartTime;

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

            updateData.endTime = finalEndTime;
          } else {
            // Use end time as is - validation will prevent invalid submissions
            updateData.endTime = finalEndTime;
          }
        } else if (finalEndTime) {
          // If only end time is provided, add it to the update
          updateData.endTime = finalEndTime;
        }

        await this.eventService.updateEvent(this.eventId, updateData);
        
        // If this is a new event, store the admin key in localStorage
        if (this.isCreatingNew && this.event?.adminKey) {
          this.adminStorageService.storeAdminKey(this.eventId, this.event.adminKey);
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
    if (this.event?.adminKey) {
      const adminUrl = `${window.location.origin}/event/${this.eventId}/admin/${this.event.adminKey}`;
      navigator.clipboard.writeText(adminUrl);
      // Would add a notification here in a real app
    }
  }
  
  // Expose window object for template
  get window(): Window {
    return window;
  }
}