import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormArray, FormGroup, FormControl, Validators } from "@angular/forms";
import { ExemptionRule } from "./exemption-rule.interface"; // Assuming you have an interface to define the exemption rule structure

@Component({
  selector: "edu-exemption-form",
  templateUrl: "./exemption-form.component.html",
  styleUrls: ["./exemption-form.component.scss"],
})
export class ExemptionFormComponent implements OnInit {
  exemptionForm: FormGroup;
  exemptionRules: ExemptionRule[] = []; // Assuming you have an array of exemption rules fetched from the database
  isEditingExemption: boolean = false;
  editedExemptionIndex: number = -1;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.exemptionForm = this.fb.group({
      ruleName: [null, Validators.required],
      reasonForExemption: [null, Validators.required],
      assessments: this.fb.array([]),
      exemptionCondition: [null, Validators.required],
    });
  }

  get assessments(): FormArray {
    return this.exemptionForm.get("assessments") as FormArray;
  }

  onRuleNameSelection(ruleName: string) {
    const selectedRule = this.exemptionRules.find((rule) => rule.ruleName === ruleName);
    if (selectedRule) {
      // Clear existing assessments
      while (this.assessments.length !== 0) {
        this.assessments.removeAt(0);
      }

      // Add assessments for the selected rule
      selectedRule.assessments.forEach((assessment) => {
        this.assessments.push(new FormControl(assessment));
      });
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

  switchToCreateExemptionForm() {
    this.isEditingExemption = false;
    this.resetForm();
  }

  switchToEditExemptionForm() {
    this.isEditingExemption = true;
    this.editedExemptionIndex = 0; // Set the index of the exemption rule you want to edit
    const selectedExemption = this.exemptionRules[this.editedExemptionIndex];
    this.exemptionForm.patchValue(selectedExemption);
    this.onRuleNameSelection(selectedExemption.ruleName);
  }

  resetForm() {
    this.exemptionForm.reset();
    this.assessments.clear();
    this.onRuleNameSelection(this.exemptionRules[0].ruleName);
  }
}
