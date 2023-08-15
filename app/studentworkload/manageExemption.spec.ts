import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ManageExemptionComponent } from './manage-exemption.component';

describe('ManageExemptionComponent', () => {
  let component: ManageExemptionComponent;
  let fixture: ComponentFixture<ManageExemptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ManageExemptionComponent],
      providers: [FormBuilder], // Provide FormBuilder for form creation
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageExemptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the exemptionForm', () => {
    expect(component.exemptionForm).toBeDefined();
    expect(component.exemptionForm).toBeInstanceOf(FormGroup);
  });

  it('should initialize isEditingExemption and editedExemptionIndex', () => {
    expect(component.isEditingExemption).toBeFalse();
    expect(component.editedExemptionIndex).toBe(-1);
  });

  it('should initialize exemptionRules and handle exemptionRulesData input', () => {
    const exemptionRulesData = {
      rule1: { ruleName: 'rule1', reasonForExemption: 'Reason 1', assessments: [] },
      rule2: { ruleName: 'rule2', reasonForExemption: 'Reason 2', assessments: [] },
    };
    component.exemptionRulesData = exemptionRulesData;
    component.ngOnInit();

    expect(component.exemptionRules.length).toBe(Object.keys(exemptionRulesData).length);
  });

  it('should initialize the assessments FormArray', () => {
    expect(component.assessments).toBeDefined();
    expect(component.assessments).toBeInstanceOf(FormArray);
  });

  it('should update selectedAssessments count when selecting assessments', () => {
    const assessment1 = new FormControl({ type: 'type1', title: 'Assessment 1', checked: false });
    const assessment2 = new FormControl({ type: 'type2', title: 'Assessment 2', checked: true });
    component.assessments.push(assessment1);
    component.assessments.push(assessment2);

    expect(component.selectedAssessments).toBe(1);

    // Select assessment1
    component.selectAssessment(assessment1, true);
    expect(component.selectedAssessments).toBe(2);

    // Deselect assessment2
    component.selectAssessment(assessment2, false);
    expect(component.selectedAssessments).toBe(1);
  });

  it('should clear all selected assessments', () => {
    const assessment1 = new FormControl({ type: 'type1', title: 'Assessment 1', checked: true });
    const assessment2 = new FormControl({ type: 'type2', title: 'Assessment 2', checked: true });
    component.assessments.push(assessment1);
    component.assessments.push(assessment2);

    component.clearAllSelectedAssessments();

    expect(assessment1.value.checked).toBeFalse();
    expect(assessment2.value.checked).toBeFalse();
  });

  it('should emit form values', () => {
    const emitSpy = spyOn(component.exemptionFormValueChanges, 'emit');
    const formValue = { ruleName: 'rule1', reasonForExemption: 'Reason 1', assessments: [], exemptionCondition: 'Condition 1' };
    component.exemptionForm.patchValue(formValue);
    
    component.emitFormValues();

    expect(emitSpy).toHaveBeenCalledWith(formValue);
  });

  // Write more test cases based on the behavior of onSave, onRuleNameSelection, switchToEditExemptionForm, switchToCreateExemptionForm, and other methods.
});
