import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface SampleDay {
  weekday: string;
  day: number;
  picked: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  /** A week of days for the hero illustration, built from next Monday so it always reads as "next week". */
  readonly sampleDays: SampleDay[] = this.buildSampleWeek();

  constructor(private router: Router) {}

  createNewEvent(isMeeting: boolean = false): void {
    this.router.navigate(['/event/create'], { queryParams: { isMeeting } });
  }

  createICal(): void {
    this.router.navigate(['/ical']);
  }

  private buildSampleWeek(): SampleDay[] {
    const today = new Date();
    const daysUntilMonday = ((8 - today.getDay()) % 7) || 7;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilMonday);
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // Sentence in the hero: "any evening next week except Wednesday, or Saturday"
    const picked = [true, true, false, true, true, true, false];
    return names.map((weekday, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      return { weekday, day: d.getDate(), picked: picked[i] };
    });
  }
}
