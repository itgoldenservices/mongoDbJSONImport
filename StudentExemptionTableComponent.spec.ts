import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { StudentExemptionTableComponent } from './your-component-file'; // Replace with the correct path

describe('StudentExemptionTableComponent', () => {
  let component: StudentExemptionTableComponent;
  let fixture: ComponentFixture<StudentExemptionTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StudentExemptionTableComponent, InputText],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [MessageService],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StudentExemptionTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit should initialize filteredData with studentExemption', () => {
    component.studentExemption = [{ studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors' }];
    component.ngOnInit();
    expect(component.filteredData).toEqual(component.studentExemption);
  });

  it('ngOnChanges should update filteredData when studentExemption changes', () => {
    const changes: SimpleChange = { studentExemption: { currentValue: [{ studentSegment: '2', type: 'assignment', title: 'English', honors: 'Non-Honors' }] } };
    component.ngOnChanges({ studentExemption: changes });
    expect(component.filteredData).toEqual(changes.studentExemption.currentValue);
  });

  it('doGlobalSearch should filter rows based on search value', () => {
    component.studentExemption = [
      { studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors' },
      { studentSegment: '2', type: 'assignment', title: 'English', honors: 'Non-Honors' },
    ];
    const event = { value: 'Math' };
    component.doGlobalSearch(event);
    expect(component.filteredData.length).toBe(1);
    expect(component.filteredData[0].title).toBe('Math');
  });

  it('filterSegment should filter rows based on studentSegment value', () => {
    component.studentExemption = [
      { studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors' },
      { studentSegment: '2', type: 'assignment', title: 'English', honors: 'Non-Honors' },
    ];
    const event = { value: '2' };
    component.filterSegment(event);
    expect(component.filteredData.length).toBe(1);
    expect(component.filteredData[0].studentSegment).toBe('2');
  });

  it('filterHonors should filter rows based on honors value', () => {
    component.studentExemption = [
      { studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors' },
      { studentSegment: '2', type: 'assignment', title: 'English', honors: 'Non-Honors' },
    ];
    const event = { value: 'Non-Honors' };
    component.filterHonors(event);
    expect(component.filteredData.length).toBe(1);
    expect(component.filteredData[0].honors).toBe('Non-Honors');
  });

  it('filterExempt should filter rows based on exempt value', () => {
    component.studentExemption = [
      { studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors', selected: false },
      { studentSegment: '2', type: 'assignment', title: 'English', honors: 'Non-Honors', selected: false },
    ];
    const event = { value: 'all' };
    component.filterExempt(event);
    expect(component.filteredData.every(row => row.selected)).toBe(true);
  });

  it('findIfSelected should return true if any row is selected', () => {
    component.studentExemption = [
      { studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors', selected: false },
      { studentSegment: '2', type: 'assignment', title: 'English', honors: 'Non-Honors', selected: true },
    ];
    expect(component.findIfSelected()).toBe(true);
  });

  it('changeExempt should toggle the selected property of a row', () => {
    const rowData = { studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors', selected: false };
    component.changeExempt(rowData);
    expect(rowData.selected).toBe(true);
  });

  it('submitExemption should emit event with the correct data', () => {
    component.studentExemption = [
      { studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors', selected: true, assessmentIndex: 0 },
      { studentSegment: '2', type: 'assignment', title: 'English', honors: 'Non-Honors', selected: false, assessmentIndex: 1 },
    ];
    component.tableForm.controls['reason'].setValue('Some Reason');
    spyOn(component.submitExemptionEvent, 'emit');
    component.submitExemption();
    expect(component.submitExemptionEvent.emit).toHaveBeenCalledWith({
      excb_0_0: 1,
      excb_1_1: 0,
      reason: 'Some Reason',
    });
  });

  it('cancelExemption should reset selected property and form control', () => {
    component.studentExemption = [
      { studentSegment: '1', type: 'exam', title: 'Math', honors: 'Honors', selected: true },
      { studentSegment: '2', type: 'assignment', title: 'English', honors: 'Non-Honors', selected: false },
    ];
    component.tableForm.controls['reason'].setValue('Some Reason');
    component.cancelExemption();
    expect(component.studentExemption.every(row => row.selected === false)).toBe(true);
    expect(component.tableForm.controls['reason'].value).toBe('');
  });
});
