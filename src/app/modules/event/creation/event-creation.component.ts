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
    MatProgressSpinnerModule
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
  
  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private firestoreService: FirestoreService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.eventForm = this.fb.group({
      title: ['', [Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]]
    });
    
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
    this.isCreatingNew = this.router.url.includes('/event/create');
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
        description: ''
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
        this.eventForm.patchValue({
          title: this.event.title || '',
          description: this.event.description || ''
        });
      }
    } catch (error) {
      console.error('Error loading event:', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  async saveEvent(): Promise<void> {
    if (this.eventForm.valid && this.eventId) {
      try {
        this.isSaving = true;
        
        const { title, description } = this.eventForm.value;
        
        await this.eventService.updateEvent(
          this.eventId,
          {
            title: title || null,
            description: description || null
          }
        );
        
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
  
  // Expose window object for template
  get window(): Window {
    return window;
  }
}