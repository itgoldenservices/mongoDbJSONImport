import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { StudentExemptionComponent } from './student-exemption.component';
import { Store, StoreModule } from '@ngrx/store';
import { MessageService } from 'primeng/api';
import { SpinnerService } from '../../shared/services/spinner.service';
import { AssessmentsService } from '../../assessments/assessments.service';
import { StudentExemptionApiService } from './stude-exemption-service';
import { LocaleState } from '../../locale/state/locale.reducer';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';

describe('StudentExemptionComponent', () => {
  let component: StudentExemptionComponent;
  let fixture: ComponentFixture<StudentExemptionComponent>;
  let store: MockStore;
  const initialState = {
    // Define your initial state here if needed
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StudentExemptionComponent],
      imports: [RouterTestingModule, StoreModule.forRoot({}), /* Add other necessary modules */],
      providers: [
        MessageService,
        SpinnerService,
        AssessmentsService,
        StudentExemptionApiService,
        provideMockStore({ initialState }),
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StudentExemptionComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit should set enableMySnippetFeatureFlag based on franchiseConfig', () => {
    const franchiseConfig = { my_account: { my_snippets: { visible: true } } };
    store.setState({ franchiseConfig });
    component.ngOnInit();
    expect(component.enableMySnippetFeatureFlag).toBe(true);
  });

  it('submitExemptionEvent should call setExemptionRules and show success message', () => {
    const setExemptionSpy = spyOn(component.studentExemptionService, 'setExemptionRules');
    const messageServiceSpy = spyOn(component.messageService, 'add');
    const eventData = { excb_0_0: 1, reason: 'Some Reason' };
    component.submitExemptionEvent(eventData);
    expect(setExemptionSpy).toHaveBeenCalledWith(component.appContext, { data: eventData, student: component.user });
    expect(messageServiceSpy).toHaveBeenCalledWith({
      severity: 'success',
      summary: component.locales['common']?.['success'],
      detail: component.locales['courseSettings']?.['settingsSavedSuccessfully'],
    });
  });

  it('manageSnippets should navigate to account-preferences if my_snippets is enabled', () => {
    component.enableMySnippetFeatureFlag = true;
    const routerSpy = spyOn(component.router, 'navigate');
    component.manageSnippets();
    expect(routerSpy).toHaveBeenCalledWith([`/${component.appContext.role}/${component.appContext.instructor}/${component.appContext.courseId}/account-preferences`], { queryParams: { mode: 'snippet' } });
  });

  it('manageSnippets should redirect to assignmentcommentstemplate.cgi if my_snippets is not enabled', () => {
    component.enableMySnippetFeatureFlag = false;
    component.appContext.role = 'ta';
    const windowHrefSpy = spyOn(window.location, 'href');
    component.manageSnippets();
    expect(windowHrefSpy).toHaveBeenCalledWith(`/educator/${component.appContext.role}/assignmentcommentstemplate.cgi?${component.appContext.instructor}*${component.user}*${component.scranble}*${component.appContext.courseId}`);
  });

  // Add more tests for other methods and edge cases as needed
});
