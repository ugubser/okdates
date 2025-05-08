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
import { EventService } from '../../../core/services/event.service';
import { ParticipantService } from '../../../core/services/participant.service';
import { DateParsingService } from '../../../core/services/date-parsing.service';
import { Event } from '../../../core/models/event.model';
import { ParsedDate } from '../../../core/models/parsed-date.model';

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
    MatIconModule
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
  
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private participantService: ParticipantService,
    private dateParsingService: DateParsingService
  ) {
    this.participantForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      availability: ['', [Validators.required, Validators.maxLength(500)]]
    });
    
    this.eventId = this.route.snapshot.paramMap.get('id') || '';
  }
  
  ngOnInit(): void {
    if (this.eventId) {
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
    } catch (error) {
      console.error('Error loading event:', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  async parseDates(): Promise<void> {
    if (this.participantForm.get('availability')?.valid) {
      try {
        this.isParsing = true;
        const rawDateInput = this.participantForm.get('availability')?.value;
        
        // Use the LLM-based parsing
        console.log('Parsing dates using LLM...');
        this.parsedDates = await this.dateParsingService.parseLlm(rawDateInput);
        console.log('Parsed dates:', this.parsedDates);
        
        this.showParsedDates = true;
      } catch (error) {
        console.error('Error parsing dates:', error);
        
        // Fallback to client-side parsing if LLM fails
        const rawDateInput = this.participantForm.get('availability')?.value;
        console.log('Falling back to client-side parsing...');
        this.parsedDates = this.dateParsingService.parseClientSide(rawDateInput);
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
        
        // Extract the timestamps for storage
        const parsedDates = this.parsedDates.map(d => d.timestamp);
        
        // Add participant to the event
        await this.participantService.addParticipantDirect(
          this.eventId,
          name,
          rawDateInput,
          parsedDates
        );
        
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
        const date = this.parsedDates[index];
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
  
  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}