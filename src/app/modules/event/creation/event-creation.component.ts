import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';
import { EventService } from '../../../core/services/event.service';
import { Event } from '../../../core/models/event.model';
import { FirestoreService } from '../../../core/services/firestore.service';

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
    NgxMaterialTimepickerModule
  ],
  templateUrl: './event-creation.component.html',
  styleUrls: ['./event-creation.component.scss']
})
export class EventCreationComponent implements OnInit {
  eventForm: FormGroup;
  eventId: string = '';
  event: Event | null = null;
  isSaving = false;
  isCreatingNew = false;
  isLoading = false;
  adminKey: string = '';
  isAdmin = false;
  
  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private firestoreService: FirestoreService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.eventForm = this.fb.group({
      title: ['', [Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      startTime: [null],
      endTime: [null]
    });
    
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    this.isCreatingNew = this.router.url.includes('/event/create');
    
    // Check for admin key in query params (passed from event view)
    this.adminKey = this.route.snapshot.queryParamMap.get('adminKey') || '';
  }
  
  ngOnInit(): void {
    console.log('Event creation component initialized');
    console.log('isCreatingNew:', this.isCreatingNew);
    console.log('eventId:', this.eventId);
    
    if (this.isCreatingNew) {
      // Initialize a new empty event
      console.log('Creating new event...');
      this.createNewEvent();
    } else if (this.eventId) {
      // Load existing event
      console.log('Loading existing event...');
      this.loadEvent();
    } else {
      // Navigate to home if no event ID and not creating
      console.log('No event ID and not creating, navigating to home...');
      this.router.navigate(['/']);
    }
  }
  
  async createNewEvent(): Promise<void> {
    try {
      this.isLoading = true;
      console.log('Creating event in Firestore...');
      
      // Initialize with empty title and description
      const { eventId, event } = await this.eventService.createEventDirect(null, null);
      console.log('Event created with ID:', eventId);
      
      this.eventId = eventId;
      this.event = event;
      
      // Create an empty form for the user to fill out
      this.eventForm.patchValue({
        title: '',
        description: '',
        startTime: null,
        endTime: null
      });
      
      // Now the user can edit the empty event
      console.log('New event ready for editing:', this.event);
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
          startTime: this.event.startTime || null,
          endTime: this.event.endTime || null
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
    if (this.eventForm.valid && this.eventId) {
      try {
        this.isSaving = true;

        const { title, description, startTime, endTime } = this.eventForm.value;

        // Create update object without empty time fields
        const updateData: Partial<Event> = {
          title: title || null,
          description: description || null
        };

        // Only add time fields if they have values
        if (startTime) {
          updateData.startTime = startTime;
        }

        if (endTime) {
          updateData.endTime = endTime;
        }

        await this.eventService.updateEvent(this.eventId, updateData);
        
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