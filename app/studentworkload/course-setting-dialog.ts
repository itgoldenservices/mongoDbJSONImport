import { Component, OnInit, QueryList, ViewChildren } from "@angular/core";
import { WeekDay } from "@angular/common";
import { FormBuilder, FormArray, Validators, FormGroup, FormControl, AbstractControl } from "@angular/forms";
import { CourseSettingsService } from "../course-settings.service";
import { getDirtyValues, markAsPristineIfFormValueEqualsOriginal } from "../../shared/utils/form-group";
import { Store } from "@ngrx/store";
import { State as AppState } from "../../state";
import { HttpErrorResponse } from "@angular/common/http";
import { Subscription } from "rxjs";
import { FormStatus } from "../../shared/enums/form-status";
import { DynamicDialogConfig, DynamicDialogRef } from "primeng/dynamicdialog";
import { CourseListEntry, CourseSettings, EnrollmentManager, FranchiseConfig } from "@educator-ng/common";
import { NavbarComponentActions } from "../../layout/navbar/state/actions";
import { MessageService } from "primeng/api";
import { NgbNavLink } from "@ng-bootstrap/ng-bootstrap";
import { LocaleState } from "../../locale/state/locale.reducer";
import { getSelectedLanguageLocales } from "../../locale/state";
import { RegExPatterns } from "libs/common/src/lib/enums/regex-patterns.enum";
import { FranchiseConfigState } from "../../franchise-config/state/franchise-config.state";
import { selectFranchiseConfig } from "../../franchise-config/state/franchise-config.selectors";
import { AssessmentsService } from "../../assessments/assessments.service";

@Component({
  selector: "edu-course-settings-dialog",
  templateUrl: "./course-settings-dialog.component.html",
  styleUrls: ["./course-settings-dialog.component.scss"],
})
export class CourseSettingsDialogComponent implements OnInit {
  @ViewChildren(NgbNavLink) public navLinks: QueryList<NgbNavLink>;

  franchiseConfig: FranchiseConfig;
  locales;
  getFranchiseConfigSubscription: Subscription;
  getSelectedLanguageLocalesSubscription: Subscription;
  activeTab: string;
  private checkIfFormValuesHaveChangedSubscription: Subscription;
  formStatus: FormStatus = FormStatus.LOADING;
  errorMessage: string;
  assessments: any;
  rules: string[] = ["Rule 1", "Rule 2"];
  enrollmentManager: EnrollmentManager;
  courseSettingsForm: FormGroup = this.fb.group({
    audioVideo: this.fb.group({
      activateAudioVideo: [false],
    }),
    courseInformation: this.fb.group({
      courseId: this.fb.control("", [Validators.required, Validators.pattern(new RegExp(RegExPatterns.CourseId))]),
      courseName: this.fb.control("", [Validators.required, Validators.pattern(new RegExp(RegExPatterns.NoAsterisk))]),
      courseTimeZone: [""],
      creditHours: [""],
      prerequisites: this.fb.array([this.fb.control("", [Validators.pattern(new RegExp(RegExPatterns.NoAsterisk))])]),
    }),
    courseMeetingTimes: this.fb.array(
      Object.values(WeekDay)
        .slice(0, 7)
        .map((day) =>
          this.fb.group(
            {
              day,
              start: this.fb.control(null),
              end: this.fb.control(null),
            },
            {
              validators: (group: AbstractControl) => {
                const start = group.get("start").value;
                const end = group.get("end").value;
                if (!start && !end) {
                  return null;
                }

                if ((!start && end) || (start && !end)) {
                  return { enterBothStartAndEndTimes: true };
                }

                if (60 * start.hour + start.minute > 60 * end.hour + end.minute) {
                  return { endBeforeStart: true };
                }

                return null;
              },
            }
          )
        )
    ),
    security: this.fb.group({
      allowMultipleLogins: [""],
    }),
    studentEnrollment: this.fb.group({
      courseTimeLimit: this.fb.control("", [Validators.pattern(RegExPatterns.OneOrMoreDigit), Validators.min(1)]),
      enrollmentType: [""],
      registrationDoor: [""],
      studentAccess: [""],
    }),
  });

  constructor(
    private fb: FormBuilder,
    private courseSettingsService: CourseSettingsService,
    private assessmentService: AssessmentsService,
    private store: Store<AppState>,
    public config: DynamicDialogConfig,
    public ref: DynamicDialogRef,
    private messageService: MessageService,
    private localeStore: Store<LocaleState>,
    private franchiseConfigStore: Store<FranchiseConfigState>
  ) {}

  showExemptionFormComponent: boolean = false;

  showExemptionForm() {
    this.showExemptionFormComponent = true;
  }

  ngOnInit(): void {
    this.getFranchiseConfigSubscription = this.franchiseConfigStore.select(selectFranchiseConfig).subscribe((franchiseConfig) => {
      this.franchiseConfig = franchiseConfig;
    });

    this.getSelectedLanguageLocalesSubscription = this.localeStore.select(getSelectedLanguageLocales).subscribe((locales) => {
      this.locales = locales;
    });

    this.courseSettingsService.getCourseSettings(this.config.data.course).subscribe(
      ({ courseSettings }) => {
        console.log("courseSettings:", courseSettings);
        this.courseSettingsForm.patchValue(courseSettings);

        this.enrollmentManager = courseSettings.enrollmentManager;
        this.courseId.disable();

        // Set value for exemption form group
      const exemptions = courseSettings?.exemptionRules || [];
      const exemptionFormArray = this.fb.array(exemptions.map(exemption => this.createExemptionFormGroup(exemption)));
      this.courseSettingsForm.setControl('exemptions', exemptionFormArray);


        if (this.enrollmentManager.instructorsChangeEnrollmentOptions === "No") {
          this.enrollmentType.disable();
          this.enrollmentType.setValue(this.enrollmentManager.defaultEnrollmentOption);
        }

        if (this.enrollmentManager.controlStudentAccess === "No") {
          this.studentAccess.disable();
        }

        // hide or disable security
        if (this.franchiseConfig?.course_settings?.security?.allow_multiple_logins?.enabled === false) {
          this.allowMultipleLogins.disable();
        }

        if (this.franchiseConfig?.course_settings?.security?.allow_multiple_logins?.visible === false) {
          this.security.removeControl("allowMultipleLogins");
        }

        if (this.franchiseConfig?.course_settings?.security?.visible === false) {
          this.courseSettingsForm.removeControl("security");
        }

        // hide or disable registration door
        if (this.franchiseConfig?.course_settings?.student_enrollment?.registration_door?.enabled === false) {
          this.registrationDoor.disable();
        }

        if (this.franchiseConfig?.course_settings?.student_enrollment?.registration_door?.visible === false) {
          this.studentEnrollment.removeControl("registrationDoor");
        }

        // hide or disable course length
        if (this.franchiseConfig?.course_settings?.student_enrollment?.course_length?.enabled === false) {
          this.courseTimeLimit.disable();
        }

        if (this.franchiseConfig?.course_settings?.student_enrollment?.course_length?.visible === false) {
          this.studentEnrollment.removeControl("courseTimeLimit");
        }

        if (this.franchiseConfig?.course_settings?.student_enrollment?.visible === false) {
          this.courseSettingsForm.removeControl("studentEnrollment");
        }

        const prerequisites = courseSettings?.courseInformation?.prerequisites;

        if (prerequisites) {
          this.courseInformation.setControl(
            "prerequisites",
            this.fb.array(prerequisites.map((prerequisite) => this.fb.control(prerequisite, [Validators.pattern(new RegExp(RegExPatterns.NoAsterisk))])))
          );
        }

        this.checkIfFormValuesHaveChangedSubscription = markAsPristineIfFormValueEqualsOriginal(this.courseSettingsForm);
        this.formStatus = FormStatus.LOADED;
      },
      (error: HttpErrorResponse) => {
        this.formStatus = FormStatus.FAIlED_TO_LOAD;
        this.errorMessage = this.locales?.["apiMessages"]?.[error.error];
      }
    );

    this.assessmentService.getAssessments(this.config.data.appContext).subscribe((assessments) => {
      console.log("Assess:", assessments);
      this.assessments = assessments;
    });
  }

  ngAfterViewInit() {
    // this is needed to make tabs tabbable for accessibility. tabIndex 0 is the default.
    this.navLinks.changes.subscribe((navLinksQueryList: QueryList<NgbNavLink>) => {
      navLinksQueryList.forEach((navLink: NgbNavLink) => {
        navLink.elRef.nativeElement.tabIndex = 0;
      });
    });
  }

  ngOnDestroy() {
    if (this.checkIfFormValuesHaveChangedSubscription) {
      this.checkIfFormValuesHaveChangedSubscription.unsubscribe();
    }

    this.getSelectedLanguageLocalesSubscription?.unsubscribe();

    if (this.getFranchiseConfigSubscription) {
      this.getFranchiseConfigSubscription.unsubscribe();
    }
  }

  get security() {
    return this.courseSettingsForm.get("security") as FormGroup;
  }

  get allowMultipleLogins() {
    return this.courseSettingsForm.get("security.allowMultipleLogins") as FormControl;
  }

  get courseId() {
    return this.courseSettingsForm.get("courseInformation.courseId") as FormControl;
  }

  get studentEnrollment() {
    return this.courseSettingsForm.get("studentEnrollment") as FormGroup;
  }

  get enrollmentType() {
    return this.courseSettingsForm.get("studentEnrollment.enrollmentType") as FormControl;
  }

  get courseTimeLimit() {
    return this.courseSettingsForm.get("studentEnrollment.courseTimeLimit") as FormControl;
  }

  get registrationDoor() {
    return this.courseSettingsForm.get("studentEnrollment.registrationDoor") as FormControl;
  }

  get studentAccess() {
    return this.courseSettingsForm.get("studentEnrollment.studentAccess") as FormControl;
  }

  get courseInformation() {
    return this.courseSettingsForm.get("courseInformation") as FormGroup;
  }

  get prerequisites() {
    return this.courseSettingsForm.get("courseInformation.prerequisites") as FormArray;
  }

  get courseMeetingTimes() {
    return this.courseSettingsForm.get("courseMeetingTimes") as FormArray;
  }

  get isLoading() {
    return this.formStatus === FormStatus.LOADING;
  }

  get isSubmitted() {
    return this.formStatus === FormStatus.SUBMITTED;
  }

  get isSaving() {
    return this.formStatus === FormStatus.SAVING;
  }

  get isSavedSuccessfully() {
    return this.formStatus === FormStatus.SAVED_SUCCESSFULLY;
  }

  addPrerequisite() {
    this.prerequisites.push(this.fb.control("", [Validators.pattern(new RegExp(RegExPatterns.NoAsterisk))]));
    this.prerequisites.markAsDirty();
  }

  removePrerequisite(i: number) {
    if (this.prerequisites.length > 1) {
      this.prerequisites.removeAt(i);
      this.prerequisites.markAsDirty();
    }
  }

  selectAssessment(assessment: string, isChecked: boolean) {
    const assessmentFormArray = <FormArray>this.courseSettingsForm.controls.exemptions["controls"]["assessments"];

    if (isChecked) {
      assessmentFormArray.push(new FormControl(assessment));
    } else {
      let index = assessmentFormArray.controls.findIndex((x) => x.value == assessment);
      assessmentFormArray.removeAt(index);
    }
  }

  selectExemptionCondition(exemptionCondition: string) {
    this.courseSettingsForm.controls.exemptions["controls"]["exemptionCondition"].patchValue(exemptionCondition);
  }

  selectRule(rule: string) {
    this.courseSettingsForm.controls.exemptions["controls"]["ruleName"].patchValue(rule);
  }

  createExemptionForm(action: string) {
    if (action === "create") {
      const exemptionConditionControl = new FormControl();
      const exemptionForm = <FormGroup>this.courseSettingsForm.controls.exemptions;
      exemptionForm.addControl("exemptionCondition", exemptionConditionControl);
    }
    else if (action === "edit") {
      const exemptionForm = <FormGroup>this.courseSettingsForm.controls.exemptions;
      exemptionForm.removeControl('exemptionCondition');
    }
  }

  onSubmit() {
    this.formStatus = FormStatus.SUBMITTED;
    if (this.courseSettingsForm.valid) {
      this.formStatus = FormStatus.SAVING;
      const updatedCourseSettings = getDirtyValues(this.courseSettingsForm) as CourseSettings;
      const course: CourseListEntry = this.config.data.course;
      this.courseSettingsService.patchCourseSettings(course, { courseSettings: updatedCourseSettings }).subscribe(
        () => {
          this.errorMessage = undefined;
          this.checkIfFormValuesHaveChangedSubscription.unsubscribe();
          this.checkIfFormValuesHaveChangedSubscription = markAsPristineIfFormValueEqualsOriginal(this.courseSettingsForm);
          this.courseSettingsForm.markAsPristine();
          this.formStatus = FormStatus.SAVED_SUCCESSFULLY;

          const newValues = {
            courseName: updatedCourseSettings?.courseInformation?.courseName,
            courseId: updatedCourseSettings?.courseInformation?.courseId,
          };

          if (updatedCourseSettings?.courseInformation?.courseName || updatedCourseSettings?.courseInformation?.courseId) {
            this.store.dispatch(
              NavbarComponentActions.updateNavbarCourse({
                course,
                newValues,
              })
            );
          }

          this.messageService.add({
            severity: "success",
            summary: this.locales["common"]?.["success"],
            detail: this.locales["courseSettings"]?.["settingsSavedSuccessfully"],
          });

          this.ref.close(newValues);
        },
        (error: HttpErrorResponse) => {
          this.formStatus = FormStatus.FAILED_TO_SAVE;
          this.errorMessage = this.locales?.["apiMessages"]?.[error.error];
        }
      );
    } else {
      Object.entries(this.courseSettingsForm.controls).forEach(([controlKey, control]) => {
        if (control.valid === false) {
          this.activeTab = controlKey;
          return;
        }
      });
    }
  }
}
