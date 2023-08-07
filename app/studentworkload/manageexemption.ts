import { Component, Input, Output, OnInit, EventEmitter } from "@angular/core";
import { FormBuilder, FormArray, FormGroup, FormControl, Validators } from "@angular/forms";
import { hits } from "memory-cache";
import { Assessment, ExemptionRules, ExemptionRule } from "../../auto.exemption.service";

@Component({
  selector: "edu-exemption-form",
  templateUrl: "./manage-exemption.component.html",
  styleUrls: ["./manage-exemption.component.scss"],
})
export class ManageExemptionComponent implements OnInit {
  exemptionForm: FormGroup;
  isEditingExemption: boolean = false;
  editedExemptionIndex: number = -1;
  exemptionRules: ExemptionRule[] = [];
  @Input() exemptionRulesData: ExemptionRules;
  @Input() allAssessments: Assessment[];
  @Output() exemptionFormValueChanges = new EventEmitter();
  @Output() deleteExemptionRule = new EventEmitter();

  // Define the locale object with English translations
  locale = {
    createExemption: 'Create Exemption',
    editExemption: 'Edit Exemption',
    ruleNameLabel: 'Rule Name',
    assessmentsLabel: 'Assessments',
    exemptionConditionLabel: 'Exemption Condition',
    reasonForExemptionLabel: 'Reason for Exemption',
    selectExemptionConditionOption: 'Select Exemption Condition',
    allNewEnrollmentOption: 'All New Enrollment',
    newEnrollmentWithHonorsOption: 'New Enrollment with Honors',
    newEnrollmentWithNonHonorsOption: 'New Enrollment with Non-Honors',
    reasonForExemptionRequiredMessage: 'Reason for Exemption is required.',
    exemptionConditionRequiredMessage: 'Exemption Condition is required.',
    ruleNameRequiredMessage: 'Rule Name is required.',
    noExemptionRulesExistMessage: 'No Exemption Rules Exist.',
    clearButton: 'Clear',
    deleteButton: 'Delete',
    saveButton: 'Save'
  };

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    for (let i in this.exemptionRulesData) {
      this.exemptionRules.push(this.exemptionRulesData[i]);
    }

    console.log(this.exemptionRules);
    this.exemptionForm = this.fb.group({
      ruleName: [null, Validators.required],
      reasonForExemption: [null, Validators.required],
      exemptionCondition: [null, Validators.required],
      assessments: this.fb.array(this.allAssessments.map((assessment) => this.fb.control(false)))
    });
  }

  get assessments(): FormArray {
    return this.exemptionForm.get("assessments") as FormArray;
  }

  get selectedAssessments(): number {
    return this.assessments.controls.filter((control) => control.value).length;
  }

  clearAllSelectedAssessments() {
    this.assessments.controls.forEach((control) => {
      control.patchValue(false);
    });
  }

  selectAssessment(assessment: FormControl, checked: boolean) {
    assessment.patchValue(checked);
  }

  onRuleNameSelection(exemptionRule: ExemptionRule) {
    const ruleName = exemptionRule.ruleName;
    const selectedRule = this.exemptionRulesData[ruleName];
    if (selectedRule) {
      // Clear existing assessments
      while (this.assessments.length !== 0) {
        this.assessments.removeAt(0);
      }
      this.exemptionForm.controls.ruleName.patchValue(exemptionRule.ruleName);
      this.exemptionForm.controls.reasonForExemption.patchValue(exemptionRule.reasonForExemption);

      // Add assessments for the selected rule
      const precheckedAssessments = selectedRule.assessments;
      this.allAssessments.forEach((assessment) => {
        const index = precheckedAssessments.findIndex(
          (precheckedAssessment) =>
            precheckedAssessment.type === assessment.type && precheckedAssessment.title === assessment.title
        );
        this.assessments.push(this.fb.control(index > -1));
      });
    }
  }
  emitFormValues() {
    // ... your existing code ...

    // Check if the form is touched
    const touched = this.exemptionForm.touched;

    if (this.exemptionForm.valid) {
      this.exemptionFormValueChanges.emit({ formValues: this.exemptionForm.value, touched });
    }
  }

  onSave() {
    if (this.exemptionForm.valid) {
      const formData = this.exemptionForm.getRawValue();
      // Here, you can save the data to the database or perform any other action with the form data
      console.log(formData);
    } else {
      // Handle form validation errors if needed
    }
  }

  deleteExemption() {
    const i = this.exemptionRules.findIndex((rule) => rule.ruleName === this.exemptionForm.getRawValue().ruleName);
    this.exemptionRules.splice(i, 1);
    if (i !== 0) this.onRuleNameSelection(this.exemptionRules[0]);
    this.deleteExemptionRule.emit(this.exemptionForm.getRawValue().ruleName);
  }

  switchToCreateExemptionForm() {
    this.isEditingExemption = false;
    this.resetForm();
  }

  switchToEditExemptionForm() {
    this.isEditingExemption = true;
    this.editedExemptionIndex = 0; // Set the index of the exemption rule you want to edit
    const selectedExemption = this.exemptionRules[this.editedExemptionIndex];
    this.exemptionForm.patchValue(selectedExemption);
    this.onRuleNameSelection(this.exemptionRules[0]);
    // Clear existing assessments
    while (this.assessments.length !== 0) {
      this.assessments.removeAt(0);
    }

    // Add assessments for the selected rule
    const precheckedAssessments = selectedExemption.assessments;
    this.allAssessments.forEach((assessment) => {
      const index = precheckedAssessments.findIndex(
        (precheckedAssessment) =>
          precheckedAssessment.type === assessment.type && precheckedAssessment.title === assessment.title
      );
      this.assessments.push(this.fb.control(index > -1));
    });
  }

  resetForm() {
    this.exemptionForm.reset();
    this.assessments.controls.forEach((control) => control.setValue(false));
    this.onRuleNameSelection(this.exemptionRules[0]);
  }
}
