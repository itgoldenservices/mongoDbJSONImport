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

  // ... Previous test cases ...

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

    // You can add more assertions to check assessments FormArray as well
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

  // Add more test cases for other methods and edge cases as needed
});
