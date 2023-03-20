


import { CacheResponse, } from '../decorators/cache-response.decorator';
import { BaseService, } from './base.service';
import { FileService, FileStats, } from './file.service';
import { TimeConstants, } from '../enums/time.enum';
import { GradeBuilderEntry, } from '../interfaces/gradebook.interface';
import {
    AssessmentTypes,
    ExamSubmissionStatus,
    CourseAssessmentStatus,
    AssessmentQuestionTypes,
    FileStatus,
    FillInTheBlankTolerances,
    TrueFalseQuestionValues,
    YesNoQuestionValues,
    AssignmentSubmissionStatus,
    WorksheetShowAnswerOptions,
    WorksheetSubmissionStatus,
} from '../enums/assessment.enum';
require("util").inspect.defaultOptions.depth = null;
import {
    CourseAssessment,
    CourseWorksheet,
    AssignmentSubmission,
    CourseAssignment,
    CourseExam,
    ExamAnswer,
    ExamQuestion,
    ExamSubmission,
    WorksheetAnswer,
    WorksheetQuestion,
    WorksheetSubmission,
    CommonParams,
    AssessmentAttachment,
    GradeBuilder,
    RubricDesign,
    RubricSubmission,
} from '../interfaces'
import { Logger } from './logger.service';
import { GradeBuilderService } from './gradebuilder.service';
import { UtilitiesService, } from '@educator-ng/common';
const fs = require('fs');
const { JsonUtilities } = require('json-utilities');

export class AssessmentService extends BaseService {
    private defaultFileOptions = { encoding: 'utf8', mode: FileService.fileMode }

    public matchingLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

    private gradebuilderService: GradeBuilderService;

    constructor() {
        super();
        this.gradebuilderService = new GradeBuilderService();
    }

    async getAssessments(params: CommonParams): Promise<CourseAssessment[]> {
        const mailboxDirectory = FileService.getMailboxPath(params);
        const objectsPath = `${mailboxDirectory}/objects.txt`;
        const courseDirectory = FileService.getCoursePath(params)
        const gradeBuilderPath = `${courseDirectory}/gradebuilder.txt`;
        const assessmentPromises: Promise<CourseAssessment>[] = [];
        const assessments: CourseAssessment[] = [];

        // key -> object_id; value -> semester
        const gradeBuilderLookup: { [key: string]: any } = {};

        // Read the gradebuilder file
        const gradeBuilderFile: string[] = await FileService.readLines(gradeBuilderPath);
        let objectIDGradeBuilderOrder: string[] = [];
        // Parse the file into our lookup object
        for (const line of gradeBuilderFile) {
            let [object_id, , , semester] = line.split(':');
            objectIDGradeBuilderOrder.push(object_id);
            if (!gradeBuilderLookup.hasOwnProperty(object_id)) {
                gradeBuilderLookup[object_id] = semester || '';
            }
        };
        objectIDGradeBuilderOrder.splice(0, 1); //removing first index of array since it will not an objectID

        // Let's get our Instructor Objects from their mailbox
        // Filter our discussion groups as well
        const instructorObjectFile: string[] = (await FileService.readLines(objectsPath)).filter(line => line.match(/\*(exam|worksheet|assignment)\*/));

        for (const [_index, line] of instructorObjectFile.entries()) {
            let [object_id, type, , key, , courseid] = line.split('*');
            if (courseid === params.courseid && gradeBuilderLookup.hasOwnProperty(object_id)) {
                assessmentPromises.push(this.getAssessment(type as AssessmentTypes, key, params));
            }
        }

        for (const promise of assessmentPromises) {
            try {
                assessments.push(await promise);
            } catch (e) { }
        }

        //sorting array in gradebuilder order:
        assessments.sort((a, b) => objectIDGradeBuilderOrder.indexOf(a.objectId) - objectIDGradeBuilderOrder.indexOf(b.objectId));

        return assessments;
    }

    @CacheResponse({
        cacheKeyPrefix: 'AssessmentService.getAssessment.v3.',
        cacheLength: Number(TimeConstants.dayInMinutes),
        cacheKeyGeneratorFn: async (args) => {
            // Returns a string in the format of `<AssessmentType>-<FileKey>-<LastModifiedMS>`
            // This allows us to invalidate cache keys by touching the assessment designs
            let [type, fileKey, params] = args;
            let assessmentPath = '';

            switch (type) {
                case AssessmentTypes.Exam:
                    assessmentPath = FileService.getExamsPath(params);
                    break;
                case AssessmentTypes.Assignment:
                    assessmentPath = FileService.getAssignmentsPath(params);
                    break;
                case AssessmentTypes.Worksheet:
                    assessmentPath = FileService.getWorksheetsPath(params);
                    break;
            }

            // Set a default in case we cannot determine the path to the file and the stats, just return the type and file key
            let cacheKey: string = `${params.shellroot}-${params.dir}-${type}-${fileKey}-${params.instructor}-${params.courseid}`;

            if (assessmentPath) {
                const stats: FileStats = await FileService.getFileStats(`${assessmentPath}/${fileKey}.txt`);
                cacheKey = `${params.shellroot}-${params.dir}-${type}-${fileKey}-${params.instructor}-${params.courseid}-${stats.mtimeMs}`;
            }

            return cacheKey;
        }
    })
    async getAssessment(type: AssessmentTypes, fileKey: string, params: CommonParams): Promise<CourseAssessment> {
        let assessment: CourseAssessment;

        switch (type) {
            case AssessmentTypes.Exam:
                assessment = await this.parseExam(fileKey, params);
                break;
            case AssessmentTypes.Worksheet:
                assessment = await this.parseWorksheet(fileKey, params);
                break;
            case AssessmentTypes.Assignment:
                assessment = await this.parseAssignment(fileKey, params);
                break;
        }

        if (assessment) {
            const gradebuilder: GradeBuilder = await this.gradebuilderService.getGradeBuilder(params);
            const gbEntry: GradeBuilderEntry = gradebuilder.gradeBuilder.find(entry => entry.objectId === assessment.objectId);
        }

        return assessment;
    }

    async getSubmission(type: AssessmentTypes, username: string, fileKey: string, params: CommonParams, includeAttachments: boolean = true): Promise<ExamSubmission | WorksheetSubmission | AssignmentSubmission> {
        let submission: ExamSubmission | WorksheetSubmission | AssignmentSubmission;
        const design: CourseAssessment = await this.getAssessment(type, fileKey, params);

        if (!design) {
            return;
        }

        switch (type) {
            case AssessmentTypes.Exam:
                submission = await this.parseExamSubmission(fileKey, username, params, includeAttachments) as ExamSubmission;

                if (submission?.pointsPossible !== undefined) {
                    design.pointsPossible = submission.pointsPossible;
                }

                break;
            case AssessmentTypes.Worksheet:
                submission = await this.parseWorksheetSubmission(fileKey, username, params) as WorksheetSubmission;
                break;
            case AssessmentTypes.Assignment:
                submission = await this.parseAssignmentSubmission(fileKey, username, params, includeAttachments) as AssignmentSubmission;
                break;
        }

        const gradeBuilderService = new GradeBuilderService;
        const gradeBuilder = await gradeBuilderService.getGradeBuilder(params);

        const gradeBuilderMatch: GradeBuilderEntry = gradeBuilder.gradeBuilder.find((gradeBuilderObject) => {
            if (gradeBuilderObject.objectId === design.objectId) {
                return gradeBuilderObject;
            }
        })

        if (submission && gradeBuilderMatch) {
            submission.gradebuilder = gradeBuilderMatch;

            if (design.pointsPossible) {
                const gbPointsEarned = (Number(submission.pointsEarned as string) / Number(design.pointsPossible as string)) * Number(gradeBuilderMatch.pointsPossible as string);

                submission.gradebuilder.pointsEarned = gbPointsEarned;
            } else {
                submission.gradebuilder.pointsEarned = 0;
            }
        }

        // Check for saved assessments (not completed / graded) and set their points earned to zero.
        if (
            (submission) &&
            (
                (type === AssessmentTypes.Exam && submission.status !== ExamSubmissionStatus.Submitted) ||
                (type === AssessmentTypes.Assignment && submission.status === AssignmentSubmissionStatus.Saved) ||
                (type === AssessmentTypes.Worksheet && submission.status !== WorksheetSubmissionStatus.Submitted)
            )
        ) {
            submission.pointsEarned = 0;

            if (submission.gradebuilder) {
                submission.gradebuilder.pointsEarned = 0;
            }
        }

        // Check for submitted (or graded) assessments and those with a manual score of 'ex', set their points to zero.
        if (
            (submission) &&
            (
                (type === AssessmentTypes.Exam && submission.status === ExamSubmissionStatus.Submitted) ||
                (type === AssessmentTypes.Assignment && submission.status !== AssignmentSubmissionStatus.Saved) ||
                (type === AssessmentTypes.Worksheet && submission.status === WorksheetSubmissionStatus.Submitted)
            ) &&
            (submission.manualScore.toString().toLowerCase() === 'ex')
        ) {
            if (submission.gradebuilder) {
                submission.gradebuilder.pointsEarned = '0';
            }
        }

        if (submission) {
            return submission;
        }
    }

    async parseWorksheet(fileKey: string, params: CommonParams): Promise<CourseWorksheet> {
        const coursePath = FileService.getCoursePath(params);
        let pointsPossible: number = 0;
        let fileContents: string[] = [];

        try {
            fileContents = await FileService.readLines(`${coursePath}/worksheets/${fileKey}.txt`);
        } catch (err) {
            console.log('AssessmentService ~ parseWorksheet ~ error reading file:', `${coursePath}/worksheets/${fileKey}.txt`);
            return;
        }

        // Get the header info from the first row in the file
        let [
            title,  // The title of the worksheet.
            status, // "Active" or "Inactive",
            numSubmissionsAllowed, // "How many times should students be able to submit this for grading?" a list of 1 - 10. Called "continue" in the Perl code.
            objectId, // The object ID of the worksheet.
            author, // The username of the author if there is one
            showAnswer, // "Show Correct and Incorrect Answers", "Show Correct Answers", "Show Incorrect Answers"
            locked, // "Allow no more student submissions, yet keep active"
            _latitudeLongitude, // The latitude and logitude where you should be able to take the workseet? There is no active UI element to set this. #Deprecated
        ] = fileContents[0].split('*');

        const questions: WorksheetQuestion[] = [];
        let lockSubmissions: Boolean = false;

        if (locked.toLowerCase() === 'yes') {
            lockSubmissions = true;
        }

        // Parse the rest of the lines into questions
        for (const [index, line] of fileContents.entries()) {
            // Skip the first line
            if (index === 0) continue;

            const questionLineToSplit = line.split('*');
            const question: string = questionLineToSplit.shift();
            const type: AssessmentQuestionTypes = questionLineToSplit.shift() as AssessmentQuestionTypes;
            const pointValue: number = Number(questionLineToSplit.shift());
            pointsPossible += pointValue;
            const answers: any[] = [];
            let hint: string = '';

            const questionObject: WorksheetQuestion = {
                question: question,
                type: type,
                pointValue: pointValue,
            };

            switch (type) {
                case AssessmentQuestionTypes.Essay: {
                    break;
                }
                case AssessmentQuestionTypes.Informational: {
                    break;
                }
                case AssessmentQuestionTypes.MultipleChoice: {
                    const _choices: number = Number(questionLineToSplit.shift()); // This is legacy from the Perl flat file.
                    hint = questionLineToSplit.pop(); // remove empty tail.

                    for (const [_answerIndex, answerToSplit] of questionLineToSplit.entries()) {
                        const [answer, isCorrectString] = answerToSplit.split('%');
                        const isCorrect: boolean = (isCorrectString.toLowerCase() === 'yes');

                        answers.push({
                            answer,
                            isCorrect,
                        });
                    }

                    break;
                }
                case AssessmentQuestionTypes.TrueFalse: {
                    const answer = questionLineToSplit.shift();
                    // const [,,,answer] = line.split('*');

                    const trueAnswer = {
                        text: TrueFalseQuestionValues.True,
                        isCorrect: false,
                        pointsPossible: 0,
                    };
                    const falseAnswer = {
                        text: TrueFalseQuestionValues.False,
                        isCorrect: false,
                        pointsPossible: 0,
                    };

                    if (answer.toLowerCase() === TrueFalseQuestionValues.True) {
                        trueAnswer.isCorrect = true;
                        trueAnswer.pointsPossible = Number(pointValue);
                    } else {
                        falseAnswer.isCorrect = true;
                        falseAnswer.pointsPossible = Number(pointValue);
                    }

                    answers.push(trueAnswer, falseAnswer);
                    break;
                }
                case AssessmentQuestionTypes.Matching: {
                    let pointsPerBlank: number;

                    if (Number(question) > 0) {
                        pointsPerBlank = Number(pointValue) / Number(question);
                    }

                    questionLineToSplit.pop(); // No hints here.

                    for (const [_matchIndex, matchingString] of questionLineToSplit.entries()) {
                        const [term, definition] = matchingString.split('%');
                        const answer = {
                            term,
                            definition,
                            pointsPossible: pointsPerBlank,
                        };

                        answers.push(answer)
                    }

                    questionObject.question = ''; // We set this to an empty string as Matching questions in Worksheets don't have an actual question.
                    break;
                }
                case AssessmentQuestionTypes.FillInTheBlank: {
                    hint = questionLineToSplit.pop(); // The hint.
                    const _numberOfChoices = questionLineToSplit.shift(); // This is legacy from the Perl flat file.
                    const requireCorrectOrder = questionLineToSplit.shift();
                    const fibPrompts = questionLineToSplit.shift();

                    questionObject.requireCorrectOrder = (requireCorrectOrder.toLowerCase() === 'yes');
                    questionObject.numberOfPrompts = Number(fibPrompts);

                    answers.push(...questionLineToSplit);

                    break;
                }
            };

            if (answers.length > 0) {
                questionObject.answers = answers;
            }

            if (hint !== '') {
                questionObject.hint = hint;
            }

            questions.push(questionObject);
        };


        return {
            title,
            objectId: objectId,
            params: params,
            filename: `${fileKey}.txt`,
            questions,
            status: status as CourseAssessmentStatus,
            type: AssessmentTypes.Worksheet,
            key: fileKey,
            author,
            showAnswer: showAnswer as WorksheetShowAnswerOptions,
            lockSubmissions,
            pointsPossible,
            numSubmissionsAllowed: Number(numSubmissionsAllowed),
        }
    }

    async parseAssignment(fileKey: string, params: CommonParams): Promise<CourseAssignment> {
        const coursePath = FileService.getCoursePath(params)
        let fileContents: string[] = [];
        const rubrics: RubricDesign[] = [];
        let submissionForce: string = '';

        try {
            fileContents = await FileService.readLines(`${coursePath}/assignments/${fileKey}.txt`);
        } catch (err) {
            console.log('AssessmentService ~ parseAssignment ~ error reading file:', `${coursePath}/assignments/${fileKey}.txt`);
            let blankAssignement: CourseAssignment = {
                title: '',
                dueDate: '',
                details: '',
                status: 'Active' as CourseAssessmentStatus,
                pointsPossible: 0,
                objectId: '0',
                author: '',
                params,
                filename: `${fileKey}.txt`,
                coordinates: '',
                rubricCategories: rubrics,
                rubricKey: '',
                type: AssessmentTypes.Assignment,
                key: fileKey,
                numSubmissionsAllowed: Number(0),
                submissionForce,
            };

            return blankAssignement;
        }

        // Get the header info from the first row in the file
        let [
            title,
            dueDate,
            details,
            status,
            pointsPossible,
            objectId,
            author,
            numberOfRubrics,
            rubricsInfo,
            nextRubricId,
            numResetsAllowed,
            coordinates,
        ]: any = fileContents[0].split('*');

        numResetsAllowed = numResetsAllowed ?? 'no';

        // Convert Yes/No to Infinity/0 respectively.
        // All other values will be a number between 1 and 20
        numResetsAllowed = numResetsAllowed.toLowerCase();

        if (numResetsAllowed === 'unlimited') {
            numResetsAllowed = Infinity;
        }

        // There are times where numberOfRubrics is null and others where its 0 (zero).
        if (numberOfRubrics && Number(numberOfRubrics) > 0) {
            let totalPointsPossible: number = 0;
            const designRubrics = rubricsInfo.split('%')
            // Remove the last empty element from the array due to splitting.
            designRubrics.pop()

            // Iterate over the rubrics and put them into an array of objects.
            for (const rubric of designRubrics) {
                const [rubricDescription, rubricPointsPossible, rubricId]: string[] = rubric.split('~');
                rubrics.push({
                    id: rubricId,
                    pointsPossible: rubricPointsPossible,
                    description: rubricDescription,
                });
                totalPointsPossible += Number(rubricPointsPossible);
            }

            pointsPossible = totalPointsPossible.toFixed(2);
        }

        try {
            const assignmentJSONFilePath = `${coursePath}/assignments/${fileKey}.json`;

            if (await FileService.fileExists(assignmentJSONFilePath)) {
                const jsonFile = await FileService.getFileContents(assignmentJSONFilePath, false, false);
                let afterSubmissionObjectId: any = {};

                if (jsonFile) {
                    afterSubmissionObjectId = JSON.parse(jsonFile);
                }

                if (afterSubmissionObjectId.SubmissionForce) {
                    submissionForce = afterSubmissionObjectId.SubmissionForce;
                }
            }
        } catch (err) {
            console.log('AssessmentService ~ parseAssignment ~ error paring json file: ', `${coursePath}/assignments/${fileKey}.json`, err);
        }

        return {
            title,
            dueDate,
            details,
            status: status as CourseAssessmentStatus,
            pointsPossible,
            objectId,
            author,
            params,
            filename: `${fileKey}.txt`,
            coordinates,
            rubricCategories: rubrics,
            rubricKey: nextRubricId,
            type: AssessmentTypes.Assignment,
            key: fileKey,
            numSubmissionsAllowed: Number(numResetsAllowed),
            submissionForce,
        }
    }

    async parseExam(fileKey: string, params: CommonParams): Promise<CourseExam> {
        const coursePath = FileService.getCoursePath(params)
        let fileContents: string[] = [];

        try {
            fileContents = await FileService.readLines(`${coursePath}/exams/${fileKey}.txt`);
        } catch (err) {
            console.log('AssessmentService ~ parseExam ~ error reading file:', `${coursePath}/exams/${fileKey}.txt`);
            return;
        }

        // Get the header info from the first row in the file
        let [
            title,
            status,
            distribution,
            due,
            timeLimit,
            buildFeedbackString,
            _ipaddresses, // We should deprecate this field.
            displayInformation,
            groups,
            objectId,
            author,
            latitudeLongitude,
            questionDisplayStyle,
        ] = fileContents[0].split('*');

        let [timeLimitHours, timeLimitMinutes, latePenalty, allowLate, allowOneAccessString, numResetsAllowed,]: any = timeLimit.split('%');
        const [showAnswer, showGrade, requireProctorsString, details, showFeedback] = displayInformation.split('%');
        const proctors = (requireProctorsString !== undefined) ? (requireProctorsString.toLowerCase() === 'yes') : false;
        const [latitude, longitude] = (latitudeLongitude !== undefined) ? latitudeLongitude.split(',') : ['', ''];
        const [dueMonth, dueDay, dueYear, dueHour, dueMinute, dueMeridian, allowEmptyString,] = due.split('%');
        const allowEmpty = (allowEmptyString !== undefined) ? (allowEmptyString.toLowerCase() === 'yes') : false;
        const allowLateSubmissions = (allowLate !== undefined) ? (allowLate.toLowerCase() === 'yes') : false;
        const allowOneAccess = (allowOneAccessString !== undefined) ? (allowOneAccessString.toLowerCase() === 'yes') : false;
        const feedback = (buildFeedbackString !== undefined) ? (buildFeedbackString.toLowerCase() === 'yes') : false;

        const distributionSplit = distribution.split('%');
        distributionSplit.pop();
        const distributionType = distributionSplit.shift();
        const scrambleQuestions = distributionSplit.shift();
        let scrambleGroups = distributionSplit.shift();
        let pointsPossible: number = 0;

        const questions: ExamQuestion[] = [];

        numResetsAllowed = numResetsAllowed ?? 'no';

        // Convert Yes/No to Infinity/0 respectively.
        // All other values will be a number between 1 and 20
        numResetsAllowed = numResetsAllowed.toLowerCase();

        if (numResetsAllowed === 'yes') {
            numResetsAllowed = Infinity;
        } else if (numResetsAllowed === 'no') {
            numResetsAllowed = 0;
        }

        // Parse the rest of the lines into questions
        for (const [index, line] of fileContents.entries()) {
            // Skip the first line
            if (index === 0) continue;
            let answers = [];

            let [
                id,
                type,
                group,
                pointValue,
                feedback,
                question,
                choices,
                answerChoices,
                buttons,
                choicePointControl,
                showNa,
                naCredit
            ] = line.split('*');

            switch (type) {
                case AssessmentQuestionTypes.Essay: {
                    pointsPossible += Number(pointValue);
                    break;
                }
                case AssessmentQuestionTypes.Informational: {
                    break;
                }
                case AssessmentQuestionTypes.MultipleChoice: {
                    let answersSplit: string[] = [];

                    if (answerChoices) {
                        answersSplit = answerChoices.split('%');
                        answersSplit.pop();

                        for (const answerText of answersSplit) {
                            const [optionText, optionIsCorrectOrPoints, optionFeedback] = answerText.split('~');
                            let optionIsCorrect: boolean = false;
                            let optionPointsPossible: number = Number(pointValue);

                            // Take into account either per option points or "all or nothing" points when setting an option to be correct.
                            if (optionIsCorrectOrPoints === 'yes' || Number(optionIsCorrectOrPoints) > 0) {
                                optionIsCorrect = true;
                            }

                            // If per option points is set to yes, those are the number of points possible for each option selected.
                            if (choicePointControl === 'yes') {
                                optionPointsPossible = Number(optionIsCorrectOrPoints);
                            }

                            // If the option is not correct, set the possible points to zero.
                            if (optionIsCorrect === false && choicePointControl !== 'yes') {
                                optionPointsPossible = 0;
                            }

                            const answer = {
                                text: optionText,
                                isCorrect: optionIsCorrect,
                                pointsPossible: Number(optionPointsPossible.toFixed(2)),
                                feedback: optionFeedback,
                            };
                            answers.push(answer);
                        }
                    }

                    break;
                }
                case AssessmentQuestionTypes.TrueFalse: {
                    const trueAnswer = {
                        text: TrueFalseQuestionValues.True,
                        isCorrect: false,
                        pointsPossible: 0,
                    };
                    const falseAnswer = {
                        text: TrueFalseQuestionValues.False,
                        isCorrect: false,
                        pointsPossible: 0,
                    };

                    if (choices === TrueFalseQuestionValues.True) {
                        trueAnswer.isCorrect = true;
                        trueAnswer.pointsPossible = Number(pointValue);
                    } else {
                        falseAnswer.isCorrect = true;
                        falseAnswer.pointsPossible = Number(pointValue);
                    }

                    choices = '2';
                    answers.push(trueAnswer, falseAnswer);

                    break;
                }
                case AssessmentQuestionTypes.YesNo: {
                    const yesAnswer = {
                        text: YesNoQuestionValues.Yes,
                        isCorrect: false,
                        pointsPossible: 0,
                    };
                    const noAnswer = {
                        text: YesNoQuestionValues.No,
                        isCorrect: false,
                        pointsPossible: 0,
                    };
                    const naAnswer = {
                        text: YesNoQuestionValues.NA,
                        isCorrect: false,
                        pointsPossible: 0,
                    };

                    if (choices === YesNoQuestionValues.Yes) {
                        yesAnswer.isCorrect = true;
                        yesAnswer.pointsPossible = Number(pointValue);
                    } else if (choices === YesNoQuestionValues.No) {
                        noAnswer.isCorrect = true;
                        noAnswer.pointsPossible = Number(pointValue);
                    } else {
                        naAnswer.isCorrect = true;
                        naAnswer.pointsPossible = Number(pointValue);
                    }

                    if (naCredit === 'yes' && showNa === 'yes') {
                        naAnswer.isCorrect = true;
                        naAnswer.pointsPossible = Number(pointValue);
                    }

                    choices = '2';
                    answers.push(yesAnswer, noAnswer, naAnswer);

                    break;
                }
                case AssessmentQuestionTypes.FillInTheBlankNonMath: {
                    let answersSplit: string[] = [];

                    if (answerChoices) {
                        let pointsPerBlank: number;

                        if (Number(choices) > 0) {
                            pointsPerBlank = Number(pointValue) / Number(choices);
                        }

                        answersSplit = answerChoices.split('%');
                        answersSplit.pop();

                        for (const answerText of answersSplit) {
                            const [optionText, tolerance, strConsecutiveCharacters, exactMatch,] = answerText.split('~');
                            let isExactMach: boolean = false;
                            const consecutiveCharacters: number = Number(strConsecutiveCharacters);

                            if (exactMatch) {
                                isExactMach = exactMatch.toLocaleLowerCase() === 'yes';
                            };

                            const answer = {
                                text: optionText,
                                pointsPossible: pointsPerBlank,
                                tolerance,
                                consecutiveCharacters,
                                requireExactMatch: isExactMach,
                            };

                            answers.push(answer);
                        }
                    }

                    break;
                }
                case AssessmentQuestionTypes.FillInTheBlankMath: {
                    let answersSplit: string[] = [];

                    if (answerChoices) {
                        let pointsPerBlank: number;

                        if (Number(choices) > 0) {
                            pointsPerBlank = Number(pointValue) / Number(choices);
                        }

                        answersSplit = answerChoices.split('%');
                        answersSplit.pop();

                        for (const answerText of answersSplit) {
                            const [tempText, tempTolerance,] = answerText.split('~');
                            const optionNumber: number = Number(tempText);
                            const tolerance: number = Number(tempTolerance);

                            const answer = {
                                text: optionNumber,
                                pointsPossible: pointsPerBlank,
                                tolerance,
                            };

                            answers.push(answer);
                        }
                    }

                    break;
                }
                case AssessmentQuestionTypes.Correction: {
                    let answersSplit: string[] = [];

                    if (answerChoices) {
                        let pointsPerBlank: number;

                        if (Number(choices) > 0) {
                            pointsPerBlank = Number(pointValue) / Number(choices);
                        }

                        answersSplit = answerChoices.split('%');
                        answersSplit.pop();

                        for (const answerText of answersSplit) {
                            const [optionText, tolerance,] = answerText.split('~');

                            const answer = {
                                text: optionText,
                                pointsPossible: pointsPerBlank,
                                tolerance,
                            };

                            answers.push(answer);
                        }
                    }

                    break;
                }
                case AssessmentQuestionTypes.CorrectionWithOptions: {
                    let answersSplit: string[] = [];

                    if (answerChoices) {
                        let pointsPerBlank: number;

                        if (Number(choices) > 0) {
                            pointsPerBlank = Number(pointValue) / Number(choices);
                        }

                        answersSplit = answerChoices.split('%');
                        answersSplit.pop();

                        for (const answerText of answersSplit) {
                            const [optionText, availableOptions,] = answerText.split('~');
                            let options: string[] = [];

                            if (availableOptions) {
                                options = availableOptions.split(',');
                            }

                            const answer = {
                                text: optionText,
                                pointsPossible: pointsPerBlank,
                                options,
                            };

                            answers.push(answer);
                        }
                    }

                    break;
                }
                case AssessmentQuestionTypes.Matching: {
                    question = buttons;
                    buttons = undefined;
                    let pointsPerBlank: number;

                    if (Number(choices) > 0) {
                        pointsPerBlank = Number(pointValue) / Number(choices);
                    }

                    if (answerChoices) {
                        let matchingSplit: string[] = [];

                        matchingSplit = answerChoices.split('%');
                        matchingSplit.pop();

                        for (const [matchingIndex, matchingText,] of matchingSplit.entries()) {
                            const [term, definition] = matchingText.split('~');

                            const answer = {
                                term,
                                definition,
                                pointsPossible: pointsPerBlank,
                            };

                            answers.push(answer);
                        }
                    }

                    break;
                }
                case AssessmentQuestionTypes.Hottext: {
                    question = buttons;
                    buttons = undefined;
                    let pointsPerBlank: number;

                    if (Number(choices) > 0) {
                        pointsPerBlank = Number(pointValue) / Number(choices);
                    }

                    if (answerChoices) {
                        let matchingSplit: string[] = [];

                        matchingSplit = answerChoices.split('%');
                        matchingSplit.pop();

                        for (const [matchingIndex, matchingText,] of matchingSplit.entries()) {
                            const [term, definition] = matchingText.split('~');

                            const answer = {
                                term,
                                definition,
                                pointsPossible: pointsPerBlank,
                            };

                            answers.push(answer);
                        }
                    }

                    break;
                }
            }

            questions.push({
                id: Number(id),
                type: type as AssessmentQuestionTypes,
                group,
                pointValue: Number(pointValue),
                feedback,
                question,
                choices: Number(choices),
                answers,
                buttons,
                choicePointControl,
                showNa,
                naCredit,
            });
        };

        return {
            title,
            objectId,
            params,
            questions,
            filename: `${fileKey}.txt`,
            status: status as CourseAssessmentStatus,
            type: AssessmentTypes.Exam,
            key: fileKey,
            numResetsAllowed: Number(numResetsAllowed),
            numSubmissionsAllowed: Number(numResetsAllowed) + 1,
            author,
            showAnswer,
            details,
            feedback,
            showFeedback,
            proctors,
            showGrade,
            questionDisplayStyle,
            latitude,
            longitude,
            groups,
            dueDate: {
                month: dueMonth,
                day: dueDay,
                year: dueYear,
                hour: dueHour,
                minute: dueMinute,
                meridian: dueMeridian,
            },
            allowEmpty,
            allowLateSubmissions,
            allowOneAccess,
            timeLimitHours,
            timeLimitMinutes,
            latePenalty,
            distributionType,
        };
    }

    //accounting for rubric edge case where manual score looks something like 'ex %~~1%~~%'. In this case would just consider this as exempted.
    formatManualScore(manualScore: string): string {
        return (manualScore?.toLocaleLowerCase()?.trim()?.split("%")?.filter(val => val?.toLocaleLowerCase()?.trim() == 'ex').length > 0) ? 'ex' : manualScore;
    }

    async parseExamSubmission(fileKey: string, username: string, params: CommonParams, includeAttachments: boolean = true): Promise<ExamSubmission | void> {

        const coursePath = FileService.getCoursePath(params)
        const path = `${coursePath}/students/${username}/exam${fileKey}.txt`;
        let examPointsEarned: number = 0;
        let examPointsPossible: number = 0;

        if (!(await FileService.fileExists(path))) {
            return;
        }

        let fileContents: string[] = [];

        try {
            fileContents = await FileService.readLines(path);
        } catch (e) { }

        if (!fileContents || !fileContents.length) return;

        const exam: CourseExam = await this.getAssessment(AssessmentTypes.Exam, fileKey, params) as CourseExam;

        let [
            status,
            timeStarted,
            _scrambleSetup, // not used
            timeSubmitted,
            manualScore,
            timeGraded,
            , //unknown,
            numSubmissions,
        ] = fileContents[0].split('*');

        const unixTimeStarted = Number(timeStarted);
        const unixTimeSubmitted = Number(timeSubmitted) || 0;
        const unixTimeGraded = Number(timeGraded);
        let ungradedEssayCount = 0;
        let ungradedEssays = false;

        const answers: ExamAnswer[] = [];
        // Parse the rest of the lines into answers

        try {
            for (const [index, line] of fileContents.entries()) {
                // Skip the first line
                if (index === 0) continue;
                // We're not splitting directly to the variables due to id needing to be a number.
                const lineData = line.split('%');
                const id = Number(lineData[0]);
                let answer: string | any[];
                let pointsAwarded: string | number = 0;
                let pointsPossible: number = 0;
                let feedback: string;

                // Match our answer to the original question on the IDs
                const origQuestion: ExamQuestion = exam.questions.find(question => question.id === Number(id));

                // If we can't match the question, we can't score this
                if (!origQuestion) continue;

                // Let's check to see what type of question this was so we can score it correctly
                switch (origQuestion.type) {
                    case AssessmentQuestionTypes.Essay: {
                        // Grab all values from the line data, but skip the id since we already have that
                        [, answer, pointsAwarded, feedback] = [...lineData];

                        if (pointsAwarded === '') {
                            pointsAwarded = NaN;
                        } else {
                            pointsAwarded = Number(pointsAwarded);
                        }

                        if (Number.isNaN(pointsAwarded) === true) {
                            pointsAwarded = 0;

                            ungradedEssayCount++;
                            if (!ungradedEssays) {
                                ungradedEssays = true;
                            }
                        }

                        examPointsEarned += Number(pointsAwarded.toFixed(2));
                        examPointsPossible += Number(origQuestion.pointValue.toFixed(2));

                        break;
                    }
                    case AssessmentQuestionTypes.Informational: {
                        answer = lineData[1];

                        break;
                    }
                    case AssessmentQuestionTypes.MultipleChoice: {
                        // TODO: Revisit "all correct and choice point control all selected" test, that should not award points.
                        const mcChoices: string[] = lineData;
                        // Remove the first and last elements of the array (first is the question ID, last is an empty element from the split).
                        mcChoices.shift();
                        mcChoices.pop();
                        answer = mcChoices;

                        for (const [choiceIndex, studentSelection] of mcChoices.entries()) {
                            pointsPossible += origQuestion.answers[choiceIndex]?.pointsPossible;

                            if (studentSelection === 'yes' && origQuestion.answers[choiceIndex].isCorrect === true) {
                                pointsAwarded += origQuestion.answers[choiceIndex]?.pointsPossible;
                            } else if (studentSelection === 'yes' && origQuestion.answers[choiceIndex].isCorrect === false) {
                                pointsAwarded += origQuestion.answers[choiceIndex]?.pointsPossible;
                            }
                        }

                        if (pointsAwarded < 0) {
                            pointsAwarded = 0;
                        }

                        examPointsEarned += Number(pointsAwarded.toFixed(2));
                        examPointsPossible += Number(pointsPossible.toFixed(2));

                        break;
                    }
                    // True/False and Yes/No use the same code (despite the differences), so lets combine them and make it explicit.
                    case AssessmentQuestionTypes.TrueFalse:
                    case AssessmentQuestionTypes.YesNo: {
                        const studentSelection: string = lineData[1];
                        for (const studentAnswer of origQuestion.answers) {
                            pointsPossible += studentAnswer.pointsPossible;
                            answer = studentSelection;

                            if (studentSelection === studentAnswer.text) {
                                pointsAwarded += studentAnswer.pointsPossible;
                            }
                        }

                        examPointsEarned += Number(pointsAwarded.toFixed(2));
                        examPointsPossible += Number(pointsPossible.toFixed(2));

                        break;
                    }
                    case AssessmentQuestionTypes.FillInTheBlankNonMath: {
                        const fibAnswers: string[] = lineData;
                        // Remove the first and last elements of the array (first is the question ID, last is an empty element from the split).
                        fibAnswers.shift();
                        fibAnswers.pop();
                        answer = fibAnswers;

                        for (const [answerIndex, studentAnswer] of fibAnswers.entries()) {
                            pointsPossible += origQuestion.answers[answerIndex]?.pointsPossible;

                            if (origQuestion.answers[answerIndex]?.requireExactMatch === true) {
                                if (studentAnswer === origQuestion.answers[answerIndex]?.text) {
                                    pointsAwarded += origQuestion.answers[answerIndex]?.pointsPossible;
                                    continue;
                                }
                            } else {
                                if (
                                    ((studentAnswer === origQuestion.answers[answerIndex]?.text) && (origQuestion.answers[answerIndex]?.tolerance === FillInTheBlankTolerances.CaseSensitive)) ||
                                    ((studentAnswer.toLowerCase() === origQuestion.answers[answerIndex]?.text.toLowerCase()) && (origQuestion.answers[answerIndex]?.tolerance === FillInTheBlankTolerances.CaseInsensitive))
                                ) {
                                    pointsAwarded += origQuestion.answers[answerIndex]?.pointsPossible;
                                    continue;
                                } else {
                                    const cleanStudentAnswer = studentAnswer.replace(/\s+/g, '');
                                    const cleanCorrectAnswer = origQuestion.answers[answerIndex]?.text.replace(/\s+/g, '');

                                    let studentAnswerComparison = '';
                                    let correctAnswerComparison = '';

                                    const studentAnswerSplit: string[] = cleanStudentAnswer.split('');
                                    const correctAnswerSplit: string[] = cleanCorrectAnswer.split('');

                                    for (const [studentCaracterIndex, studentCharacter] of studentAnswerSplit.entries()) {
                                        if (
                                            studentCharacter.match(/[A-Z]/) ||
                                            studentCharacter.match(/[a-z]/) ||
                                            studentCharacter.match(/[0-9]/)
                                        ) {
                                            studentAnswerComparison += cleanStudentAnswer[studentCaracterIndex];
                                        }
                                    }

                                    for (const [answerCharacterIndex, answerCharacter] of correctAnswerSplit.entries()) {
                                        if (
                                            answerCharacter.match(/[A-Z]/) ||
                                            answerCharacter.match(/[a-z]/) ||
                                            answerCharacter.match(/[0-9]/)
                                        ) {
                                            correctAnswerComparison += cleanCorrectAnswer[answerCharacterIndex];
                                        }
                                    }

                                    if (origQuestion.answers[answerIndex]?.tolerance === FillInTheBlankTolerances.CaseInsensitive) {
                                        studentAnswerComparison = studentAnswerComparison.toLowerCase();
                                        correctAnswerComparison = correctAnswerComparison.toLowerCase();
                                    }

                                    let counter = 0;
                                    let testComparison = '';

                                    for (let char = 0; char <= (correctAnswerComparison.length - origQuestion.answers[answerIndex]?.consecutiveCharacters); char++) {
                                        for (let studentChar = counter; studentChar < (counter + origQuestion.answers[answerIndex]?.consecutiveCharacters); studentChar++) {
                                            testComparison += correctAnswerComparison[studentChar];
                                        }

                                        counter++;

                                        const matchRegex = new RegExp(testComparison);
                                        if (studentAnswerComparison.match(matchRegex)) {
                                            pointsAwarded += origQuestion.answers[answerIndex]?.pointsPossible;
                                        }
                                    }
                                }
                            }
                        }

                        examPointsEarned += Number(pointsAwarded.toFixed(2));
                        examPointsPossible += Number(pointsPossible.toFixed(2));

                        break;
                    }
                    case AssessmentQuestionTypes.FillInTheBlankMath: {
                        const fibAnswers: string[] = lineData;
                        // Remove the first and last elements of the array (first is the question ID, last is an empty element from the split).
                        fibAnswers.shift();
                        fibAnswers.pop();
                        answer = fibAnswers;

                        for (const [answerIndex, studentAnswer] of fibAnswers.entries()) {
                            pointsPossible += origQuestion.answers[answerIndex]?.pointsPossible;
                            const cleanStudentAnswer = Number(studentAnswer.replace(/\s+/g, ''));

                            if (origQuestion.answers[answerIndex]?.text === cleanStudentAnswer) {
                                pointsAwarded += origQuestion.answers[answerIndex]?.pointsPossible;
                            } else {
                                if (origQuestion.answers[answerIndex]?.tolerance > 0) {
                                    const lowEnd = (origQuestion.answers[answerIndex]?.text - origQuestion.answers[answerIndex]?.tolerance);
                                    const highEnd = (origQuestion.answers[answerIndex]?.text + origQuestion.answers[answerIndex]?.tolerance);

                                    if (cleanStudentAnswer >= lowEnd && cleanStudentAnswer <= highEnd) {
                                        pointsAwarded += origQuestion.answers[answerIndex]?.pointsPossible;
                                    }
                                }
                            }
                        }

                        examPointsEarned += Number(pointsAwarded.toFixed(2));
                        examPointsPossible += Number(pointsPossible.toFixed(2));

                        break;
                    }
                    case AssessmentQuestionTypes.Correction: {
                        const fibAnswers: string[] = lineData;
                        // Remove the first and last elements of the array (first is the question ID, last is an empty element from the split).
                        fibAnswers.shift();
                        fibAnswers.pop();
                        answer = fibAnswers;

                        for (const [answerIndex, studentAnswer] of fibAnswers.entries()) {
                            pointsPossible += origQuestion.answers[answerIndex]?.pointsPossible;

                            if (
                                ((studentAnswer === origQuestion.answers[answerIndex]?.text) && (origQuestion.answers[answerIndex]?.tolerance === FillInTheBlankTolerances.CaseSensitive)) ||
                                ((studentAnswer.toLowerCase() === origQuestion.answers[answerIndex]?.text.toLowerCase()) && (origQuestion.answers[answerIndex]?.tolerance === FillInTheBlankTolerances.CaseInsensitive))
                            ) {
                                pointsAwarded += origQuestion.answers[answerIndex]?.pointsPossible;
                                continue;
                            }
                        }

                        examPointsEarned += Number(pointsAwarded.toFixed(2));
                        examPointsPossible += Number(pointsPossible.toFixed(2));

                        break;
                    }
                    case AssessmentQuestionTypes.CorrectionWithOptions: {
                        const fibAnswers: string[] = lineData;
                        // Remove the first and last elements of the array (first is the question ID, last is an empty element from the split).
                        fibAnswers.shift();
                        fibAnswers.pop();
                        answer = fibAnswers;

                        for (const [answerIndex, studentAnswer] of fibAnswers.entries()) {
                            pointsPossible += origQuestion.answers[answerIndex]?.pointsPossible;

                            if (studentAnswer === origQuestion.answers[answerIndex]?.text) {
                                pointsAwarded += origQuestion.answers[answerIndex]?.pointsPossible;
                                continue;
                            }
                        }

                        examPointsEarned += Number(pointsAwarded.toFixed(2));
                        examPointsPossible += Number(pointsPossible.toFixed(2));

                        break;
                    }
                    // Matching and Hottext (Drag and Drop Matching) used the same code, lets make that more clear and also reduce our code base.
                    case AssessmentQuestionTypes.Matching:
                    case AssessmentQuestionTypes.Hottext: {
                        const matchingAnswers: string[] = lineData;
                        matchingAnswers.pop();

                        const analyseStudentChoices = matchingAnswers[1].split('*');
                        analyseStudentChoices.pop();

                        const inputAnswers = [...matchingAnswers] as string[];
                        inputAnswers.shift();
                        inputAnswers.shift();

                        answer = inputAnswers.map(input => input.toUpperCase());

                        for (let choiceIndex = 0; choiceIndex < origQuestion.choices; choiceIndex++) {
                            pointsPossible += origQuestion.answers[choiceIndex]?.pointsPossible;
                            const choiceInspect: number = Number(analyseStudentChoices[choiceIndex]);
                            const answerLetter: string = this.matchingLetters[choiceIndex];
                            const studentLetter = matchingAnswers[(choiceInspect + 1)].toUpperCase();

                            if (answerLetter === studentLetter) {
                                pointsAwarded += origQuestion.answers[choiceIndex]?.pointsPossible;
                            }
                        }

                        examPointsEarned += Number(pointsAwarded.toFixed(2));
                        examPointsPossible += Number(pointsPossible.toFixed(2));

                        break;
                    }
                }

                answers.push({
                    id,
                    type: origQuestion.type,
                    answer,
                    pointsAwarded: Number(pointsAwarded.toFixed(2)),
                    feedback,
                    question: origQuestion
                })
            };
        }
        catch (err) {
            console.log('AssessmentService ~ parseExamSubmission ~ err', err);
        }

        manualScore = this.formatManualScore(manualScore);

        let attachments: AssessmentAttachment[] = [];

        if (includeAttachments) {
            attachments = await this.getAssessmentAttachments(exam.objectId, username, params);
        }

        return {
            username,
            title: exam.title,
            filename: `exam${fileKey}.txt`,
            filekey: fileKey,
            status: status as ExamSubmissionStatus,
            ungradedEssays,
            answers,
            manualScore,
            type: AssessmentTypes.Exam,
            unixTimeStarted,
            unixTimeSubmitted,
            attachments,
            numSubmissions: Number(numSubmissions),
            numSubmissionsAllowed: exam.numResetsAllowed,
            numResetsAllowed: exam.numResetsAllowed,
            ungradedEssayCount: Number(ungradedEssayCount),
            unixTimeGraded: unixTimeGraded,
            pointsEarned: examPointsEarned,
            pointsPossible: examPointsPossible,
        };
    }

    async parseWorksheetSubmission(fileKey: string, username: string, params: CommonParams): Promise<WorksheetSubmission | void> {
        const coursePath = FileService.getCoursePath(params);
        const answerPath = `${coursePath}/students/${username}/worksheet${fileKey}.txt`;
        const feedbackPath = `${coursePath}/students/${username}/worksheet${fileKey}.feedback`;

        if (!(await FileService.fileExists(answerPath))) {
            return;
        }

        let answerContents: string[] = [];
        let feedbackContents: string[] = [];

        try {
            answerContents = await FileService.readLines(answerPath, false);
        } catch (e) { }

        try {
            feedbackContents = await FileService.readLines(feedbackPath, false, false) || [];

            // We can't use the removeEmptyLines feature of readLines as worksheets can have empty lines in their feedback. We just don't want the last one to be empty.
            if (feedbackContents && (feedbackContents[feedbackContents.length - 1] === '')) {
                feedbackContents.pop();
            }
        } catch (e) { }

        if (!answerContents || !answerContents.length) return;

        const assessment: CourseWorksheet = await this.getAssessment(AssessmentTypes.Worksheet, fileKey, params) as CourseWorksheet;
        const fileStats: FileStats = await FileService.getFileStats(feedbackPath);
        const unixTimeGraded = (fileStats.mtimeMs) ? Math.floor(fileStats.mtimeMs / 1000) : 0;
        let totalScore: string;

        totalScore = feedbackContents[feedbackContents.length - 1]?.slice(6);

        let [
            status,
            timeSubmitted,
            submissionNumber,
            manualScore
        ] = answerContents[0].split('*');

        let ungradedEssays = false;
        const unixTimeSubmitted = Number(timeSubmitted)
        let ungradedEssayCount = 0
        const answers: WorksheetAnswer[] = [];
        // Parse the rest of the lines into answers
        for (let [index, line] of answerContents.entries()) {
            // Skip the first line
            if (index === 0) continue;

            let questionFeedback: string = '';
            const feedbackRegex = new RegExp(/(\@\@.+$)/);
            const result = line.match(feedbackRegex);

            if (result) {
                const commentRegex = new RegExp(result[0]);
                line = line.replace(commentRegex, '');
                questionFeedback = result[0];
                questionFeedback = questionFeedback.slice(2);
            }

            const questionNumber = index - 1;
            const answerData = line.split('*');
            const scoreData = (feedbackContents[index] || '').split('*');
            const question = (assessment.questions || [])[questionNumber];
            let answer: string | any[];
            let pointsAwarded: string = scoreData[0];

            // Grab all values from the line data, but skip the id since we already have that
            answer = answerData[0];

            switch (question?.type) {
                case AssessmentQuestionTypes.Essay: {
                    // If this value is already true, don't overwrite with a false value
                    if (!ungradedEssays && (!pointsAwarded?.trim())) {
                        ungradedEssays = true;
                    }
                    questionFeedback = scoreData[1] || '';

                    break;
                }
                case AssessmentQuestionTypes.MultipleChoice: {
                    answer = answerData;

                    if (Number(pointsAwarded) < 0) {
                        pointsAwarded = '0';
                    }

                    break;
                }
                case AssessmentQuestionTypes.Matching: {
                    answer = answerData;
                    answer.shift();
                    answer.shift();
                    answer.pop();
                    break;
                }
                case AssessmentQuestionTypes.FillInTheBlank: {
                    answer = answerData;
                    answer.pop();
                    break;
                }
            }

            const answerObject: WorksheetAnswer = {
                type: question?.type,
                question: question,
                answer,
                pointsAwarded,
            };

            if (questionFeedback !== '' && questionFeedback !== undefined) {
                answerObject.feedback = questionFeedback;
            }

            answers.push(answerObject);
        }

        manualScore = this.formatManualScore(manualScore);

        return {
            username,
            title: assessment.title,
            filename: `worksheet${fileKey}.txt`,
            status: status as WorksheetSubmissionStatus,
            ungradedEssays,
            answers,
            manualScore,
            filekey: fileKey,
            type: AssessmentTypes.Worksheet,
            unixTimeSubmitted,
            numSubmissions: Number(submissionNumber),
            numSubmissionsAllowed: assessment.numSubmissionsAllowed,
            gradebuilder: assessment.gradebuilder,
            ungradedEssayCount: Number(ungradedEssayCount),
            unixTimeGraded,
            pointsEarned: totalScore,
        }
    }

    async parseAssignmentSubmission(fileKey: string, username: string, params: CommonParams, includeAttachments: boolean = true): Promise<AssignmentSubmission | void> {
        const coursePath: string = FileService.getCoursePath(params);
        const feedbackPath: string = `${coursePath}/students/${username}/assignment${fileKey}.feedback`;
        const commentsPath: string = `${coursePath}/students/${username}/assignment${fileKey}.comments`;
        const submissionPath: string = `${coursePath}/students/${username}/assignment${fileKey}.submissions`;
        const feedbackExists: boolean = await FileService.fileExists(feedbackPath);
        const commentsExists: boolean = await FileService.fileExists(commentsPath);
        const submissionsExists: boolean = await FileService.fileExists(submissionPath);
        let workIsCompleted: boolean = false;

        if (!feedbackExists) {
            return;
        }

        let status = AssignmentSubmissionStatus.NotAttempted;
        let fileContents: string[] = [];

        try {
            fileContents = await FileService.readLines(feedbackPath);
        } catch (e) { }

        if (!fileContents || !fileContents.length) return;

        let submissions: string[] = [];
        let submissionTimeStamps: number[] = [];
        let unixTimeSubmitted: number = 0;
        let unixTimeGraded: number = 0;

        if (submissionsExists) {
            submissions = await FileService.readLines(submissionPath);
            unixTimeSubmitted = Number(submissions[submissions.length - 1]);
        }

        if (fileContents.length) {
            const feedbackStats: FileStats = await FileService.getFileStats(feedbackPath);
            unixTimeGraded = Math.floor(feedbackStats.mtimeMs / 1000);
        }

        if (submissions) {
            submissionTimeStamps = submissions.map((timeStamp) => Number(timeStamp));
        }

        let studentComments: string = '';

        if (commentsExists) {
            studentComments = await FileService.getFileContents(commentsPath);
        }

        const assessment: CourseAssignment = await this.getAssessment(AssessmentTypes.Assignment, fileKey, params) as CourseAssignment;
        let [manualScore, teacherComments, _file, requestGrade] = fileContents[0].split('*');
        manualScore = this.formatManualScore(manualScore);
        const rubricScores: RubricSubmission[] = [];

        if (requestGrade === undefined) {
            requestGrade = '';
        }

        if (requestGrade.toLowerCase() === 'yes') {
            status = AssignmentSubmissionStatus.GradingRequested;
            workIsCompleted = true;
        } else if (requestGrade.toLowerCase() !== 'yes' && manualScore !== '') {
            status = AssignmentSubmissionStatus.Graded;
        } else {
            status = AssignmentSubmissionStatus.Saved;
        }

        if (assessment?.rubricCategories?.length > 0 && manualScore !== '') {
            const tempRubricScores = manualScore.split('%');

            // Remove the manual score field from the array.
            const fullManualScore = tempRubricScores.shift();

            // These two pops remove the empty element from the split (to the right of the last %)
            // and the last element which isn't empty and also never contains any data.
            tempRubricScores.pop();
            tempRubricScores.pop();

            if (fullManualScore) {
                manualScore = fullManualScore;
            } else {
                let tempManualScore: number = 0;

                for (const score of tempRubricScores) {
                    const [_comment, scoreString, rubricId] = score.split('~');
                    const rubricScore = Number(scoreString);
                    rubricScores.push({ id: rubricId, pointsEarned: rubricScore });
                    tempManualScore += rubricScore;
                }

                manualScore = tempManualScore.toFixed(2);
            }
        }

        if (manualScore === '' || manualScore === null || manualScore === undefined) {
            unixTimeGraded = 0;
        } else if (manualScore !== '' || manualScore !== null || manualScore !== undefined) {
            workIsCompleted = true;
        }

        if (submissionsExists || commentsExists || status === AssignmentSubmissionStatus.GradingRequested) {
            status = AssignmentSubmissionStatus.Submitted;
        }

        let attachments: AssessmentAttachment[] = [];

        if (includeAttachments) {
            attachments = await this.getAssessmentAttachments(assessment.objectId, username, params);
        }

        return {
            username,
            title: assessment.title,
            filename: `assignment${fileKey}.feedback`,
            filekey: fileKey,
            status: status as AssignmentSubmissionStatus,
            type: AssessmentTypes.Assignment,
            requestGrade: requestGrade.toLowerCase() === 'yes',
            manualScore,
            attachments,
            numSubmissions: submissions.length,
            numSubmissionsAllowed: assessment.numSubmissionsAllowed,
            unixTimeSubmitted,
            submissions: submissionTimeStamps,
            teacherComments,
            studentComments,
            pointsEarned: manualScore,
            pointsPossible: Number(assessment.pointsPossible),
            unixTimeGraded,
            rubrics: rubricScores,
            workIsCompleted,
        };
    }

    async saveAssignmentSubmission(fileKey: string, username: string, params: CommonParams, forGrading: boolean, submissionBody: string = '',): Promise<void> {
        const coursePath = FileService.getCoursePath(params);
        const existingAssignment: AssignmentSubmission = await this.getSubmission(AssessmentTypes.Assignment, username, fileKey, params) as AssignmentSubmission;
        let grade: string = '';
        let teacherComments: string = '';
        let file: string = '';
        let gradingRequested: string = '';

        if (existingAssignment !== undefined) {
            grade = existingAssignment.manualScore.toString() || '';
            teacherComments = existingAssignment.teacherComments || '';
            file = existingAssignment.attachments.toString() || '';
        }

        if (forGrading === true) {
            gradingRequested = 'yes';
            const submissionTime = UtilitiesService.getEpochTime();

            try {
                const submissionsPath = `${coursePath}/students/${username}/assignment${fileKey}.submissions`;
                await FileService.appendFile(submissionsPath, `${submissionTime}\n`, this.defaultFileOptions);
                await FileService.setFilePermissionsAndOwnership(submissionsPath);
            } catch (err) {
                console.log(err);
            }
        }

        try {
            const commentsPath = `${coursePath}/students/${username}/assignment${fileKey}.comments`;
            await FileService.writeFile(commentsPath, submissionBody);
            await FileService.setFilePermissionsAndOwnership(commentsPath);
        } catch (err) {
            console.log(err);
        }

        try {
            const feedbackPath = `${coursePath}/students/${username}/assignment${fileKey}.feedback`;
            await FileService.writeFile(feedbackPath, `${grade}*${teacherComments}*${file}*${gradingRequested}\n`, this.defaultFileOptions);
            await FileService.setFilePermissionsAndOwnership(feedbackPath);
        } catch (err) {
            console.log(err);
        }

        return;
    }

    async saveAssignmentGrade(fileKey: string, username: string, params: CommonParams, grade: string | number, teacherComments: string,): Promise<void> {
        const coursePath = FileService.getCoursePath(params);

        try {
            const feedbackPath = `${coursePath}/students/${username}/assignment${fileKey}.feedback`;
            await FileService.writeFile(feedbackPath, `${grade}*${teacherComments}**`, this.defaultFileOptions);
            await FileService.setFilePermissionsAndOwnership(feedbackPath);
        }
        catch (err) {
            console.log(err);
        }

        return;
    }

    setAssessment(path, lines) {
        try {
            fs.writeFileSync(path, lines.join('\n'), { mode: 0o660 });
        } catch (err) {
            console.error(`Failed to write file at "${path}"`, err);
        }
    }

    async getAssessmentAttachments(objectId: string, username: string, params: CommonParams): Promise<AssessmentAttachment[]> {
        // Change the context to that of the student being requested
        params = {
            ...params,
            username: username
        }
        const tempDirectory = FileService.getTempDirectoryPath(params);
        let detailFiles = [];
        const attachments: AssessmentAttachment[] = [];
        // Get our listing of detail files from the temp directory
        try {
            detailFiles = (await FileService.readdir(tempDirectory)).filter(entry => entry.endsWith('.details'));
        } catch (e: any) {
            if (e?.code !== 'ENOENT') {
                Logger.error(e)
            }
        }

        let infoLine: string;
        // Loop through them until we find a match on objectid
        for (let file of detailFiles) {
            try {
                infoLine = (await FileService.readLines(`${tempDirectory}/${file}`))[0] ?? '';
                const [attachmentObjectId, _timestamp, fileStatus, _unknown, displayName, _five, _six, _seven, _eight, _nine, assessmentObjectId] = infoLine.split('*');
                if (assessmentObjectId === objectId) {
                    let status = FileStatus[fileStatus as keyof typeof FileStatus];
                    const fileName = file.replace('.details', '');
                    attachments.push({
                        objectId: attachmentObjectId,
                        fileName,
                        fileStatus: status,
                        displayName,
                        filePath: `${tempDirectory}/${fileName}`
                    })
                }
            } catch (e: any) {
                if (e.code !== 'ENOENT') {
                    Logger.error(e)
                }
            }
        }

        return attachments;
    }

    static getAssessmentType(pluralType: string): AssessmentTypes {
        let singularType: string = pluralType.toLowerCase().substring(0, pluralType.length - 1); // Turn the plural into singular
        return singularType as unknown as AssessmentTypes;
    }

    getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
        let pathToAssessment = `/${netapp}/${theDir}/educator/${instructor}/${cid}/students/${student}/`;

        if (typeIndex === "exams") {
            pathToAssessment += "exam" + assessmentIndex + ".txt";
        } else if (typeIndex === "assignments") {
            pathToAssessment += "assignment" + assessmentIndex + ".feedback";
        } else if (typeIndex === "worksheets") {
            pathToAssessment += "worksheet" + assessmentIndex + ".txt";
        } else if (typeIndex === "quizzes") {
            pathToAssessment += "quiz" + assessmentIndex + ".txt";
        } else {
            pathToAssessment = "/dev/null/out.txt";
        }

        return pathToAssessment;
    }


    setExamInstructorComments(path, comment) {
        const JSON_UTILITIES = new JsonUtilities();

        let dataHash = {};

        if (fs.existsSync(path)) {
            const rawJSONData = fs.readFileSync(path).toString();
            dataHash = JSON_UTILITIES.decodeJson(rawJSONData);
        }

        if (comment === 'DELETE ME-UCOMPASS') {
            delete dataHash.instructorComments;
        } else {
            dataHash.instructorComments = comment;
        }

        const jsonText = JSON_UTILITIES.encodeJson(dataHash);

        fs.writeFileSync(path, jsonText);
        fs.chmodSync(path, '660');
    }

    assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
        let pathToAssessment = this.getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

        if (typeIndex === "exams") {
            if (fs.existsSync(pathToAssessment)) {
                let data = fs.readFileSync(pathToAssessment, 'utf8').split("\n");
                let headers = data[0].split("*");
                if (headers[4].toLowerCase() == "ex") {
                    return 1;
                }
            }
        }
        else if (typeIndex === "assignments") {
            if (fs.existsSync(pathToAssessment)) {
                let data = fs.readFileSync(pathToAssessment, 'utf8').split("\n");
                let headers = data[0].split("*");
                headers[0] = headers[0].toLowerCase();
                if (headers[0].match(/^ex/)) {
                    return 1;
                }
            }
        }
        else if (typeIndex === "worksheets") {
            if (fs.existsSync(pathToAssessment)) {
                let data = fs.readFileSync(pathToAssessment, 'utf8').split("\n");
                let headers = data[0].split("*");
                headers[3] = headers[3].trim();
                if (headers[3].toLowerCase() == "ex") {
                    return 1;
                }
            }
        }
        else if (typeIndex === "quizzes") {
            if (fs.existsSync(pathToAssessment)) {
                let data = fs.readFileSync(pathToAssessment, 'utf8').split("\n");
                let headers = data[0].split("*");
                headers[4] = headers[4].trim();
                if (headers[4].toLowerCase() == "ex") {
                    return 1;
                }
            }
        }
        return 0;
    }

    assessmentIsManuallyGraded(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
        let pathToAssessment = this.getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

        if (typeIndex === "exams") {
            if (fs.existsSync(pathToAssessment)) {
                const lines = fs.readFileSync(pathToAssessment, 'utf-8').split(/\r?\n/);
                const headers = lines[0].split("");
                if (headers[4].toLowerCase() !== "") {
                    return true;
                }
            }
        } else if (typeIndex === "assignments") {
            if (fs.existsSync(pathToAssessment)) {
                const lines = fs.readFileSync(pathToAssessment, 'utf-8').split(/\r?\n/),
                    headers = lines[0].split("");
                headers[0] = headers[0].toLowerCase();

                if (headers[0] !== '') {
                    return true;
                }
            }
        } else if (typeIndex === "worksheets") {
            if (fs.existsSync(pathToAssessment)) {
                const lines = fs.readFileSync(pathToAssessment, 'utf-8').split(/\r?\n/);
                const headers = lines[0].split("*");
                headers[3] = headers[3].trim();
                if (headers[3].toLowerCase() !== "") {
                    return true;
                }
            }
        } else if (typeIndex === "quizzes") {
            if (fs.existsSync(pathToAssessment)) {
                const lines = fs.readFileSync(pathToAssessment, 'utf-8').split(/\r?\n/);
                const headers = lines[0].split("*");
                headers[4] = headers[4].trim();
                if (headers[4].toLowerCase() !== "") {
                    return true;
                }
            }
        }
        return false;
    }

    assessmentHasBeenAccessed(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
        let pathToAssessment = this.getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

        if (fs.existsSync(pathToAssessment)) {
            return 1;
        }

        return 0;
    }


    async setAssessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student, shouldExempt, comment, ignoreIfSubmissionExists){

        if (comment.length) {
            comment = comment.replace(/\+/g, ' ');
            comment = comment.replace(/%([a-fA-F0-9][a-fA-F0-9])/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
            comment = comment.replace(/<!--(.|\n)*-->/g, '');

            comment = comment.replace(/\*/g, '&#42;');
            comment = comment.replace(/%/g, '&#37;');
            comment = comment.replace(/~/g, '&#126;');
        }
        let updateGradesChanged = 0;
        const curTime = (new Date()).getTime();
        const domain = process.env.HTTP_HOST || '';
        const pathToAssessment = this.getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);
        if (typeIndex === "exams") {
            if (shouldExempt === 1) {
                if (fs.existsSync(pathToAssessment)) {
                    if ((!this.assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student))
                        && (!this.assessmentIsManuallyGraded(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student))
                        && ((ignoreIfSubmissionExists === 0) || (!this.assessmentHasBeenAccessed(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)))) {

                        const lines = await this.getAssessments(pathToAssessment);
                        let headers = lines[0].split('*');

                        headers[0] = 'Submission';
                        headers[4] = 'ex';
                        headers[5] = curTime;

                        if (headers[3] === '') {
                            headers[3] = curTime;
                        }
                        lines[0] = headers.join('*');
                        this.setAssessment(pathToAssessment, lines);
                        updateGradesChanged = 1;
                        console.log(`Exempting: ${pathToAssessment}`);
                    }
                }
                else {
                    const lines = ["Submission***curTime*ex*curTime**\n"];
                    this.setAssessment(pathToAssessment, lines);
                    updateGradesChanged = 1;
                    console.log(`Exempting: ${pathToAssessment}`);
                }

                let pathToJSON = pathToAssessment.replace(/\.txt$/, '.json');
                this.setExamInstructorComments(pathToJSON, comment);
            }
            else {
                if (this.assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)) {
                    console.log(`Unexempting: ${pathToAssessment}`);

                    const lines = await this.getAssessments(pathToAssessment);

                    if (lines.length > 1) {
                        let headers = lines[0].split('*');

                        headers[0] = 'Submission';
                        headers[4] = '';
                        headers[5] = '';

                        lines[0] = headers.join('*');
                        this.setAssessment(pathToAssessment, lines);
                        updateGradesChanged = 1;
                    }
                    else {
                        if (((!domain.match(/^(fatdec|tolland)/)) && (domain.match(/flvs\.net/)) || (domain.match(/dev\.educator\.flvs\.net$/)) || (domain.match(/testlearn\.educator\.flvs\.net$/))) && (cid > 0)) {
                            recordEvent({
                                path: pathToAssessment,
                                event: "ASSESSMENT_RESET"
                            });
                        }


                        fs.unlinkSync(pathToAssessment);
                        updateGradesChanged = 1;
                    }

                    let pathToJSON = pathToAssessment.replace(/\.txt$/, '.json');
                    this.setExamInstructorComments(pathToJSON, 'DELETE ME-UCOMPASS');
                }
            }

        }
    }
}
