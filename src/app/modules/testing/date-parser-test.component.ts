import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DateParsingService } from '../../core/services/date-parsing.service';
import { ParsedDate } from '../../core/models/parsed-date.model';

@Component({
  selector: 'app-date-parser-test',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="test-container">
      <h2>Date Parser Test</h2>
      
      <mat-card>
        <mat-card-header>
          <mat-card-title>Test the LLM Date Parser</mat-card-title>
        </mat-card-header>
        
        <mat-card-content>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Enter date text</mat-label>
            <textarea 
              matInput 
              [(ngModel)]="rawInput"
              placeholder="e.g., June 2-4, July 5"
              rows="4">
            </textarea>
            <mat-hint>
              Try formats like "June 15-17", "next weekend", "mon, tues & wed next week", etc.
            </mat-hint>
          </mat-form-field>
        </mat-card-content>
        
        <mat-card-actions>
          <button 
            mat-raised-button 
            color="primary" 
            (click)="parseWithLLM()" 
            [disabled]="isParsing">
            {{ isParsing ? 'Parsing...' : 'Parse with LLM' }}
          </button>
          
          <button 
            mat-button 
            (click)="parseClientSide()" 
            [disabled]="isParsing">
            Parse Client-Side (Fallback)
          </button>
        </mat-card-actions>
        
        <mat-card-content *ngIf="isParsing">
          <div class="loading-indicator">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Parsing with AI...</p>
          </div>
        </mat-card-content>
        
        <mat-card-content *ngIf="parsedDates.length > 0">
          <h3>Parsed Dates:</h3>
          <div class="parsed-dates">
            <div *ngFor="let date of parsedDates" class="date-item">
              <div class="date-value">{{ formatDate(date.timestamp) }}</div>
              <div class="date-original">Original: "{{ date.originalText }}"</div>
            </div>
          </div>
        </mat-card-content>
        
        <mat-card-content *ngIf="error">
          <div class="error-message">
            <p>Error: {{ error }}</p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .test-container {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    
    .full-width {
      width: 100%;
    }
    
    .loading-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 1rem 0;
    }
    
    .parsed-dates {
      margin-top: 1rem;
    }
    
    .date-item {
      padding: 0.5rem;
      border-bottom: 1px solid #f0f0f0;
      margin-bottom: 0.5rem;
    }
    
    .date-value {
      font-weight: 500;
      font-size: 1.1rem;
    }
    
    .date-original {
      color: rgba(0, 0, 0, 0.6);
      font-size: 0.9rem;
      font-style: italic;
    }
    
    .error-message {
      color: #f44336;
      margin: 1rem 0;
      padding: 0.5rem;
      background-color: #ffebee;
      border-radius: 4px;
    }
  `]
})
export class DateParserTestComponent {
  rawInput: string = '';
  parsedDates: ParsedDate[] = [];
  isParsing = false;
  error: string | null = null;
  
  constructor(private dateParsingService: DateParsingService) {}
  
  async parseWithLLM(): Promise<void> {
    if (!this.rawInput.trim()) {
      this.error = 'Please enter some date text';
      return;
    }
    
    this.error = null;
    this.isParsing = true;
    this.parsedDates = [];
    
    try {
      this.parsedDates = await this.dateParsingService.parseLlm(this.rawInput);
      console.log('Parsed dates:', this.parsedDates);
    } catch (error) {
      console.error('Error in LLM parsing:', error);
      this.error = 'Failed to parse dates with LLM. See console for details.';
    } finally {
      this.isParsing = false;
    }
  }
  
  async parseClientSide(): Promise<void> {
    if (!this.rawInput.trim()) {
      this.error = 'Please enter some date text';
      return;
    }
    
    this.error = null;
    this.isParsing = true;
    this.parsedDates = [];
    
    try {
      this.parsedDates = this.dateParsingService.parseClientSide(this.rawInput);
      console.log('Parsed dates (client-side):', this.parsedDates);
    } catch (error) {
      console.error('Error in client-side parsing:', error);
      this.error = 'Failed to parse dates with client-side parser.';
    } finally {
      this.isParsing = false;
    }
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