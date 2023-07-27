import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExemptionRule } from './exemption-rule';

@Injectable({
  providedIn: 'root'
})
export class AutoExemptionApiService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  updateExemptions(courseId: string, dbSelector: any, exemptions: ExemptionRule[]): Observable<void> {
    const endpoint = `${this.apiUrl}/updateExemptions`;
    const body = { courseId, dbSelector, exemptions };
    return this.http.post<void>(endpoint, body);
  }

  getExemptionRules(courseId: string, dbSelector: any): Observable<ExemptionRule[]> {
    const endpoint = `${this.apiUrl}/getExemptionRules/${courseId}`;
    const params = { dbSelector };
    return this.http.get<ExemptionRule[]>(endpoint, { params });
  }
}
