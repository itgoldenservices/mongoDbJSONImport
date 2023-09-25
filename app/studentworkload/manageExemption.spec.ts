import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { ManageExemptionComponent } from './manage-exemption.component';

describe('ManageExemptionComponent', () => {
  let fixture: ComponentFixture<ManageExemptionComponent>;
  let component: ManageExemptionComponent;
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ManageExemptionComponent],
      imports: [ReactiveFormsModule],
      providers: [FormBuilder],
    });

    fixture = TestBed.createComponent(ManageExemptionComponent);
    component = fixture.componentInstance;
    fb = TestBed.inject(FormBuilder);
  });


  
  it('should get assessments FormArray', () => {
    component.ngOnInit();
    const assessmentsArray: FormArray = component.assessments;
    expect(assessmentsArray).toBeTruthy();
  });

  it('should calculate the number of selected assessments', () => {
    component.ngOnInit();
    const assessmentsArray: FormArray = component.assessments;

    // Set some assessments as selected
    assessmentsArray.at(0).patchValue({ checked: true });
    assessmentsArray.at(1).patchValue({ checked: false });
    assessmentsArray.at(2).patchValue({ checked: true });

    const selectedAssessmentsCount = component.selectedAssessments;
    expect(selectedAssessmentsCount).toBe(2);
  });

  it('should select an assessment', () => {
    component.ngOnInit();
    const assessmentsArray: FormArray = component.assessments;

    // Select an assessment
    component.selectAssessment(assessmentsArray.at(0), true);

    // Expect the assessment to be selected
    expect(assessmentsArray.at(0).value.checked).toBeTruthy();
  });

  it('should emit form values when form is valid', () => {
    spyOn(component.exemptionFormValueChanges, 'emit');
    component.ngOnInit();

    // Mock valid form values
    const mockFormValues = {
      ruleName: 'TestRule',
      reasonForExemption: 'TestReason',
      assessments: [],
      exemptionCondition: 'TestCondition',
    };

    component.exemptionForm.patchValue(mockFormValues);
    component.emitFormValues();

    // Expect form values to be emitted
    expect(component.exemptionFormValueChanges.emit).toHaveBeenCalledWith({
      formValues: mockFormValues,
    });
  });

  it('should delete an exemption rule', () => {
    spyOn(component.deleteExemptionRule, 'emit');
    component.ngOnInit();

    // Mock exemption rule to be deleted
    const ruleToDelete = 'RuleToDelete';
    component.exemptionForm.controls.ruleName.setValue(ruleToDelete);

    component.deleteExemption();

    // Expect the deleteExemptionRule.emit method to be called with the rule name
    expect(component.deleteExemptionRule.emit).toHaveBeenCalledWith(ruleToDelete);
  });

  
  // ... Previous test cases ...

  it('should get assessments FormArray', () => {
    component.ngOnInit();
    const assessmentsArray: FormArray = component.assessments;
    expect(assessmentsArray).toBeTruthy();
  });

  it('should calculate the number of selected assessments', () => {
    component.ngOnInit();
    const assessmentsArray: FormArray = component.assessments;

    // Set some assessments as selected
    assessmentsArray.at(0).patchValue({ checked: true });
    assessmentsArray.at(1).patchValue({ checked: false });
    assessmentsArray.at(2).patchValue({ checked: true });

    const selectedAssessmentsCount = component.selectedAssessments;
    expect(selectedAssessmentsCount).toBe(2);
  });

  it('should select an assessment', () => {
    component.ngOnInit();
    const assessmentsArray: FormArray = component.assessments;

    // Select an assessment
    component.selectAssessment(assessmentsArray.at(0), true);

    // Expect the assessment to be selected
    expect(assessmentsArray.at(0).value.checked).toBeTruthy();
  });

  it('should emit form values when form is valid', () => {
    spyOn(component.exemptionFormValueChanges, 'emit');
    component.ngOnInit();

    // Mock valid form values
    const mockFormValues = {
      ruleName: 'TestRule',
      reasonForExemption: 'TestReason',
      assessments: [],
      exemptionCondition: 'TestCondition',
    };

    component.exemptionForm.patchValue(mockFormValues);
    component.emitFormValues();

    // Expect form values to be emitted
    expect(component.exemptionFormValueChanges.emit).toHaveBeenCalledWith({
      formValues: mockFormValues,
    });
  });

  it('should delete an exemption rule', () => {
    spyOn(component.deleteExemptionRule, 'emit');
    component.ngOnInit();

    // Mock exemption rule to be deleted
    const ruleToDelete = 'RuleToDelete';
    component.exemptionForm.controls.ruleName.setValue(ruleToDelete);

    component.deleteExemption();

    // Expect the deleteExemptionRule.emit method to be called with the rule name
    expect(component.deleteExemptionRule.emit).toHaveBeenCalledWith(ruleToDelete);
  });
  
  it('should handle onSave when in edit mode', () => {
    spyOn(component.exemptionFormValueChanges, 'emit');
    spyOn(component, 'deleteExemptionRule');
    component.ngOnInit();

    // Mock form data
    const editedRuleName = 'EditedRule';
    component.ruleToBeEdited = editedRuleName;
    component.isEditingExemption = true;

    // Call onSave
    component.emitFormValues();

    // Expect form values to be emitted
    expect(component.exemptionFormValueChanges.emit).toHaveBeenCalled();

    // Expect deleteExemptionRule to be called with the edited rule name
    expect(component.deleteExemptionRule).toHaveBeenCalledWith(editedRuleName);
  });

  it('should handle onSave when not in edit mode', () => {
    spyOn(component.exemptionFormValueChanges, 'emit');
    spyOn(component, 'deleteExemptionRule');
    component.ngOnInit();

    // Mock valid form data
    const mockFormValues = {
      ruleName: 'TestRule',
      reasonForExemption: 'TestReason',
      assessments: [],
      exemptionCondition: 'TestCondition',
    };

    component.exemptionForm.patchValue(mockFormValues);

    // Call onSave
    component.emitFormValues();

    // Expect form values to be emitted
    expect(component.exemptionFormValueChanges.emit).toHaveBeenCalledWith({
      formValues: mockFormValues,
    });

    // Expect deleteExemptionRule not to be called
    expect(component.deleteExemptionRule).not.toHaveBeenCalled();
  });

  it('should handle onRuleNameSelection', () => {
    component.ngOnInit();
    
    // Mock exemption rule
    const exemptionRule = {
      ruleName: 'Rule1',
      reasonForExemption: 'Reason1',
      assessments: [], // Mock assessments
      exemptionCondition: 'Condition1',
    };

    // Set exemption rule data
    component.exemptionRules = [exemptionRule];

    spyOn(component.assessments, 'clear');

    // Call onRuleNameSelection
    component.onRuleNameSelection(exemptionRule);

    // Expect assessments to be cleared
    expect(component.assessments.clear).toHaveBeenCalled();

    // Expect exemption form to be patched with exemptionRule values
    expect(component.exemptionForm.get('ruleName').value).toEqual(exemptionRule.ruleName);
    expect(component.exemptionForm.get('reasonForExemption').value).toEqual(exemptionRule.reasonForExemption);
    expect(component.exemptionForm.get('exemptionCondition').value).toEqual(exemptionRule.exemptionCondition);
 
  });

  it('should switch to edit exemption form', () => {
    component.ngOnInit(); // Initialize the component

    // Mock exemption rule data
    const exemptionRule = {
      ruleName: 'Rule1',
      reasonForExemption: 'Reason1',
      assessments: [], // Mock assessments
      exemptionCondition: 'Condition1',
    };

    // Set exemption rule data
    component.exemptionRules = [exemptionRule];

    spyOn(component, 'onRuleNameSelection');

    // Call switchToEditExemptionForm
    component.switchToEditExemptionForm();

    // Expect onRuleNameSelection to be called with the first exemption rule
    expect(component.onRuleNameSelection).toHaveBeenCalledWith(exemptionRule);

    // Expect isEditingExemption to be true
    expect(component.isEditingExemption).toBe(true);
  });

  it('should switch to create exemption form', () => {
    component.ngOnInit(); // Initialize the component

    // Mock exemption rule data
    const exemptionRule = {
      ruleName: 'Rule1',
      reasonForExemption: 'Reason1',
      assessments: [], // Mock assessments
      exemptionCondition: 'Condition1',
    };

    // Set exemption rule data
    component.exemptionRules = [exemptionRule];

    spyOn(component.exemptionForm, 'reset');

    // Call switchToCreateExemptionForm
    component.switchToCreateExemptionForm();

    // Expect form to be reset
    expect(component.exemptionForm.reset).toHaveBeenCalled();

    // Expect isEditingExemption to be false
    expect(component.isEditingExemption).toBe(false);
  });

  
});
