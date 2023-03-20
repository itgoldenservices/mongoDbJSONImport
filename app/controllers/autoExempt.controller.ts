import { CommonParams } from '../interfaces';
import { FileService } from './file.service';
import { MongoDB } from "@educator-ng/database";
import { AssessmentService } from './assessment.controller';
const fs = require("fs");

const AssessService = new AssessmentService();

export class AutoExemptionService {
    static async getExemptedLessons(params: CommonParams): Promise<string[]> {
        const exemptedLessons: string[] = [];

        try {
            const tempExemptedLessons = JSON.parse(await FileService.getFileContents(`${FileService.getStudentCoursePath(params)}/exemptedlesssons_json.txt`, false, false) ?? '{}');
            if (tempExemptedLessons && tempExemptedLessons?.exempted_pages) {
                for (const [lesson, _isExemptedInt] of Object.entries(tempExemptedLessons.exempted_pages)) {
                    exemptedLessons.push(lesson);
                }
            }
        } catch (err: any) {
            console.log(err);
        }

        return exemptedLessons;
    }

    async importData(data, type) {
        try {
            MongoDB.connect(process.env.MDB_ADDRESS, async (err: Error) => {
                if (err) {
                    console.log('\n===============================================');
                    console.log(`\nUnable to connect to database server ( ${process.env.MDB_ADDRESS} )\n`);
                    console.log('=================================================');
                    process.exit(1)
                } else {
                    const client = MongoDB.get()
                    const database = client.db(type === 'definitions' ? 'e1 general' : 'enrollments');
                    const config_collection = database.collection(type === 'definitions' ? 'definitions' : 'lessons');
                    const res = await config_collection.insertMany(JSON.parse(data));
                    process.exit(0);
                }
            });

        } catch (e) {

            process.exit(1);

        }
    }


    getDomain() {
        return process.env.HTTP_HOST;
    }

    getBasicAssessmentName(path: string) {
        const lines = fs.readFileSync(path);
        const fields = lines[0].split(/\*/);
        return fields[0];
    }

    getStudentInfo(netapp: string, dir: string, instructor: string, cid: string, learner: string,) {
        const STUPROFILE = fs.readFileSync(`/${netapp}/${dir}/educator/${instructor}/${cid}/students/${learner}/profile.txt`);

        const returnValue = { fname: '', email: '' };

        const fields = STUPROFILE[0].split('*');

        returnValue.fname = fields[1];
        returnValue.email = learner + '@' + this.getDomain();

        return returnValue;

    }

    autoExemotionsTurnedOn(usage: any, dir: string, instructor: string) {
        if (!usage.active)
            return 0;

        let allow = false;
        if (usage.mode === 'restrict') {
            const dirExists = usage.dir_exceptions && usage.dir_exceptions[dir];
            const instructorExists = usage.instructor_exceptions && !usage.instructor_exceptions[instructor];

            if (dirExists || instructorExists) {
                allow = true;
            }
        } else if (usage.mode === 'open') {
            allow = true;
            const dirExceptionExists = usage.dir_exceptions && !usage.dir_exceptions[dir];
            const instructorExceptionExists = usage.instructor_exceptions && usage.instructor_exceptions[instructor];

            if (dirExceptionExists || instructorExceptionExists) {
                allow = false;
            }
        }

        return allow ? 1 : 0;
    }
    getAllGroups(template: any[], result: any) {
        const correctGroups = {};
        const assessmentMap = {};

        for (const questionInfo of template) {
            const [questionID, format, group, points] = questionInfo.split("*");
            assessmentMap[questionID] = { group, points };
        }

        for (const key of Object.keys(result)) {
            const resultEntry = result[key];
            const assessmentMapEntry = assessmentMap[key];

            if (!assessmentMapEntry) continue;

            let groupEntry = correctGroups[assessmentMapEntry.group]?.[key]?.group;

            if (typeof groupEntry === "undefined") {
                correctGroups[assessmentMapEntry.group] = correctGroups[assessmentMapEntry.group] || {};
                groupEntry = 0;
            }

            if (resultEntry < assessmentMapEntry.points) {
                groupEntry = 0;
            } else {
                groupEntry = 1;
            }

            correctGroups[assessmentMapEntry.group][key] = { group: groupEntry };
        }

        return correctGroups;
    }

    getCorrectGroups(template: any[], result: any) {
        const correctGroups = {};
        const assessmentMap = {};

        for (const questionInfo of template) {
            const [questionID, format, group, points] = questionInfo.split("*");
            assessmentMap[questionID] = { group, points, correct_count: 0, all_correct: 1 };
        }

        for (const key of Object.keys(result)) {
            const resultEntry = result[key];
            const assessmentMapEntry = assessmentMap[key];

            if (!assessmentMapEntry) continue;

            if (resultEntry < assessmentMapEntry.points) {
                assessmentMapEntry.all_correct = 0;
                assessmentMapEntry.correct_count = 0;
            } else {
                assessmentMapEntry.correct_count++;
            }

            if (assessmentMapEntry.correct_count === 0) {
                correctGroups[assessmentMapEntry.group] = { all_correct: 0, correct_count: 0 };
            } else if (assessmentMapEntry.correct_count === Object.keys(assessmentMap).length) {
                correctGroups[assessmentMapEntry.group] = { all_correct: 1, correct_count: assessmentMapEntry.correct_count };
            } else {
                correctGroups[assessmentMapEntry.group] = { all_correct: 0, correct_count: assessmentMapEntry.correct_count };
            }
        }

        return correctGroups;
    }

    handleExemptions(entry: any, pathToFile: string, assessmentsExemted: string[]) {
        const [, netapp, netappDir, , instructor, cid, , learner, assessment] = pathToFile.split(/\//);
        const pathToCourse = `/${netapp}/${netappDir}/educator/instructor/${cid}`;

         entry.assessments_to_ex.forEach((item) => {
            const thePath = `/${netapp}/${netappDir}/educator/instructor/${cid}/${item.path}/${item.index}.txt`;
            const nameOfAssessmentInCourse = this.getBasicAssessmentName(thePath); // get definition

            if (item.name === nameOfAssessmentInCourse) {
                console.warn(`should exempt: ${item.name}`);
                assessmentsExemted.push(item.name);
                AssessService.setAssessmentIsExempt(netapp, netappDir, instructor, cid, item.path, item.index, learner, 1, "Mastery of content and skills were demonstrated on pretestName", 1);
            } else {
                console.log(`Assessment names do not match for list of assessments to ex: ${thePath} - ${item.name} - ${nameOfAssessmentInCourse}`);
            }
        });

        // read in existing data
        if (entry.assessments_to_ex.length == 0 && entry.lessons_to_skip) {
            const pathToStoSkippedLessons = `${pathToCourse}/students/${learner}/exemptedlesssons_json.txt`;
            let exemptedPagesStruc;

            if (fs.existsSync(pathToStoSkippedLessons)) {
                try {
                    const data = fs.readFileSync(pathToStoSkippedLessons);
                    exemptedPagesStruc = JSON.parse(data);
                } catch (err) {
                    console.warn(`cannot read json file: ${pathToStoSkippedLessons}`);
                }
            }

            for (const lessonToSkip in entry.lessons_to_skip) {
                exemptedPagesStruc.exempted_pages[lessonToSkip] = 1;
            }

            if (exemptedPagesStruc) {
                //moving definitions to definitions to e1 general
                this.importData(exemptedPagesStruc, 'definitions');
                // let constJSON = {}
                // constJSON = constJSON.indent(['true']);
                // const utf8_encoded_json_text = constJSON.encode(exemptedPagesStruc);

                // open(constFILE, '>'. "pathToStoSkippedLessons");
                // print constFILE $utf8_encoded_json_text;
                // close constFILE;
                // chmod(0660, pathToStoSkippedLessons);
            }
        }

        return assessmentsExemted;
    }


    checkExam(pathToFile: string, event: string) {
        let assessmentsExemted, storedPretestName, studentPageNames;

        const activeCourses = [
            'jarnstein1_3921',
            'sking222_4028',
            'amacy3_3803',
            'arobinson143_2489'
        ];

        const [, netapp, netappDir, dummy, instructor, cid, dummy2, learner, assessment] = pathToFile.split('/\//');
        if (!activeCourses.includes[instructor + '_' + cid])
            return;

        if ((/^exam/).test(assessment) || (/^assignment/).test(assessment)) {

            const pathToCourse = `/${netapp}/${netappDir}/educator/${instructor}/${cid}`;
            let pathToExemptionFile = `${pathToCourse}/autoexemption.json`;

            if ((netapp === 'flvs840') || (netapp === 'f840')) {
                pathToExemptionFile = `/flvs840/content/educator/master${cid}/master${cid}/autoexemption.json`;
            }

            if (pathToExemptionFile) {

                try {
                    const exemptionData = JSON.parse(fs.readFileSync(pathToExemptionFile));
                    // first check to see if submitted exam is pretest in structure
                    // strip out the extra data and get to the index

                    if (!this.autoExemotionsTurnedOn(exemptionData.usage, netappDir, instructor)) {

                        // warn (" --. auto exemptions off! <--- ");
                        return;
                    }

                    let submittedIndex = assessment;

                    let assessmentType = "exam";
                    if ((/^ exam/).test(submittedIndex)) {
                        submittedIndex = '/\.txt$/';
                        assessmentType = "assignment";
                    }
                    if ((/^ assignment/).test(submittedIndex)) {
                        submittedIndex = '/\.feedback$/';
                    }
                    let pathToExamTemplate;
                    const JSONSubmittedIndex = assessmentType + '_' + submittedIndex;
                    let examTemplate;
                    if (exemptionData[JSONSubmittedIndex]) {
                        console.warn("assessment in pretest list:pathToFile");
                        // now read in the assessment design...
                        if (assessmentType === "exam") {
                            pathToExamTemplate = `${pathToCourse}/exams/submittedIndex.txt`;
                            examTemplate = JSON.parse(fs.readFileSync(pathToExamTemplate));
                        } else if (assessmentType === "assignment") {
                            pathToExamTemplate = `${pathToCourse}/assignments/submittedIndex.txt`;
                            examTemplate = JSON.parse(fs.readFileSync(pathToExamTemplate));
                        } else {
                            console.warn("Invalid assessment type sent to checkExam: assessmentType");
                            return;
                        }
                        if (this.getBasicAssessmentName(pathToExamTemplate) === exemptionData[JSONSubmittedIndex]['pretest_name'])
                            if (event === 'ASSESSMENT_RESET') {
                                for (const key in exemptionData[JSONSubmittedIndex]['pretest_name']) {
                                    const entry = exemptionData[JSONSubmittedIndex]['pretest_name'][key];
                                    const pathToAssessment = pathToExamTemplate;

                                    const $assessmentName = this.getBasicAssessmentName(pathToAssessment);

                                    // make sure the pretest (or assignment) name stored in the auto exempt json matches
                                    // what is expected for that particular assessment index in the course shell.
                                    // if not we don't want to change anything as the assessments are misaligned
                                    // relative to the master

                                    if ($assessmentName === exemptionData[JSONSubmittedIndex]['pretest_name']) {

                                        // check the group requirements
                                        const shouldExempt = 1;

                                        // now actually do the exemption
                                        if (shouldExempt) {
                                            entry.assessments_to_ex.forEach((exAssessmentEntry: any) => {
                                                // Get name of assessments to be un-exempted upfront
                                                const thePath = "/" + netapp + "/" + netappDir + "/educator/instructor/" + cid + "/" + exAssessmentEntry['path'] + "/" + exAssessmentEntry['index'] + ".txt";
                                                const nameOfAssessmentInCourse = this.getBasicAssessmentName(thePath);

                                                // Check names of assessments to be un-exempted
                                                if (exAssessmentEntry['name'] === nameOfAssessmentInCourse) {
                                                    // warn "removing exemption exempt: assessment.name}";
                                                    AssessService.setAssessmentIsExempt(netapp, netappDir, instructor, cid, exAssessmentEntry.path, exAssessmentEntry.index, learner, 0, "Exemption Removed", 1);
                                                } else {
                                                    console.error("Assessment names do not match for list of assessments to un-ex:", exAssessmentEntry.name, "-", nameOfAssessmentInCourse);
                                                }

                                            });

                                            // read in existing data

                                            if (entry['lessons_to_skip']) {
                                                try {
                                                    const pathToStoSkippedLessons = `${pathToCourse}/students/${learner}/exemptedlesssons_json.txt`;

                                                    if (!fs.existsSync(pathToStoSkippedLessons)) {
                                                        throw new Error(`File does not exist: ${pathToStoSkippedLessons}`);
                                                    }

                                                    const data = fs.readFileSync(pathToStoSkippedLessons);
                                                    const exemptedPagesStruc = JSON.parse(data);

                                                    // copy ignored lessons into existing structure
                                                    const { lessons_to_skip } = entry;
                                                    lessons_to_skip.forEach((lessonToSkip) => {
                                                        exemptedPagesStruc.exempted_pages[lessonToSkip] = 0;
                                                    });

                                                    // write out lessons to exempt
                                                    // const utf8EncodedJson = JSON.stringify(exemptedPagesStruc);
                                                    // fs.writeFileSync(pathToStoSkippedLessons, utf8EncodedJson);

                                                    // // Set file permissions to 660
                                                    // fs.chmodSync(pathToStoSkippedLessons, 0o660);
                                                    this.importData(exemptedPagesStruc, 'lessons');
                                                    

                                                } catch (err) {
                                                    console.error('Error:', err);
                                                }
                                            }
                                        }
                                        else {
                                            console.log("Assessment names do not match for removal of auto exemptions: $assessmentName - exemptionData.JSONSubmittedIndex}.pretest_name}");
                                        }

                                    }
                                }
                            } else {
                                // now we know it is a pretest - we need to read
                                // in all the question answers
                                // left off here!
                                let examResults;
                                if (assessmentType === "exam") {
                                    examResults = getScore();
                                    const correctGroups = this.getCorrectGroups(examResults, examTemplate);

                                    const exemptionEntries: any = Object.entries(
                                        exemptionData[JSONSubmittedIndex]['exemption_data']
                                    );

                                    for (const [key, entry] of exemptionEntries) {
                                        let shouldExempt = 1;
                                        const exam_group_requirements: any = Object.entries(entry['exam_group_requirements']);
                                        for (const [groupRequirement, requirementValue] of exam_group_requirements) {
                                            const correctGroup = correctGroups[requirementValue];
                                            const allCorrect = correctGroup['group']['all_correct'];
                                            const isAllRequired = groupRequirement['required'] === 'all';

                                            if (isAllRequired && allCorrect !== 1) {
                                                shouldExempt = 0;
                                            } else if (allCorrect < requirementValue['required']) {
                                                shouldExempt = 0;
                                            }
                                        }

                                        if (shouldExempt) {
                                            assessmentsExemted = this.handleExemptions(entry, pathToFile, exemptionData['JSONSubmittedIndex']['pretest_name'], assessmentsExemted);

                                            storedPretestName = exemptionData[JSONSubmittedIndex]['pretest_name'];

                                            entry['standards'].forEach((studentPageName) => {
                                                studentPageNames.push(studentPageName);
                                            });
                                        }
                                    }

                                } else if (assessmentType === "assignment") {

                                    let shouldExempt = 0;
                                    let assignmentresults = getscore();
                                    // const @correctGroups = getCorrectGroups(submission.\@rawAnsweredQuestions, template.\examTemplate);
                                    const examData = exemptionData[JSONSubmittedIndex]['exemption_data'];
                                    const { manual_score, rubrics } = assignmentresults;

                                    Object.keys(examData).forEach(key => {
                                        const entry = examData[key];
                                        let shouldExempt = 0;

                                        if (manual_score && entry.assignment_total_requirement > 0 && manual_score >= entry.assignment_total_requirement) {
                                            shouldExempt = 1;
                                        } else if (entry.rubric_requirements) {
                                            entry.rubric_requirements.forEach((rubricRequirement) => {
                                                if (rubrics[rubricRequirement.rubric_name] >= rubricRequirement.required) {
                                                    shouldExempt = 1;
                                                }
                                            });
                                        }

                                        if (shouldExempt) {
                                            assessmentsExemted = this.handleExemptions(entry, pathToFile, exemptionData.JSONSubmittedIndex.pretest_name, assessmentsExempted);
                                            storedPretestName = exemptionData.JSONSubmittedIndex.pretest_name;

                                            const studentPageNamesTemp = [...entry.standards];
                                            studentPageNames.push(...studentPageNamesTemp);

                                            //AssessService.setAssessmentIsExempt(netapp, netappDir, instructor, cid, assessment.path, assessment.index, learner, 1, "Auto Exempted based on work done in exemptionData.submittedIndex}.pretest_name}", 1);
                                        } else {
                                            // warn("NOT Exmpting: entry.name}");
                                        }
                                    });

                                }
                                else {
                                    console.warn("Invalid assessment type sent to checkExam for setting grade: $assessmentType");
                                    return;
                                }
                            }
                    } else {
                        console.warn("pretest name does not match file template $pathToExamTemplate - " + this.getBasicAssessmentName(pathToExamTemplate) + ' - ' + exemptionData.JSONSubmittedIndex.pretest_name);
                    }
                } catch (err) {

                    console.warn("assessment not in pretest list: $submittedIndex");
                }
            } else {
                return;
            }
        } else {
            return;
        }

        if (assessmentsExemted || studentPageNames.length > 0) {
            const studentInfo = this.getStudentInfo(netapp, netappDir, instructor, cid, learner);

            const allExemptions = assessmentsExemted.sort().join('<br>');
            const studentPages = studentPageNames.sort().join('<br>');

            const allTests = `${allExemptions}${studentPages}`;


            const domain = this.getDomain();
            const emailText = `<p>
            Dear ${studentInfo.fname},<br>
            <br>
            Nice work on the ${storedPretestName}!<br>
            <br>
            Your results show that you have already mastered the content on the following lesson page(s) and assessment:<br>
            <br>
            ${allTests}
            <br>
            <strong>What do my pretest results mean?</strong><br>
            <br>
            You successfully answered several questions on your pretest. This shows that you already have some or all the skills taught in the lesson. The lesson pages you do not have to read will have a message at the top that looks like this:<br>
            <br>
            <img src="https://${domain}/codeExtra/images/mastery_of_skills.adf7d157.jpg" height="428" width="561" alt="Shows the message to expect on the lesson pages as 'You showed master of the skills taught on this page in your lesson pretest. You may move to the next page of the lesson.'">
            <br>
            You can still read and interact with these pages if you wish. If you don&apos;t see a message at the top of the page, you should read it and complete all the interactives and practice problems. If the name of the lesson&apos;s assessment is in the list above, you do not need to complete it. If you would like to take the assessment, please contact your instructor to have it opened for you.<br>
            <br>
            <strong>Will I be tested on these skills in the future?</strong><br>
            <br>
            Yes. Even if you show mastery of the lesson skills on the pretest, you should still expect to use the same skills in your module and segment exams. Your instructor may also evaluate your mastery of the skills during your Discussion Based Assessments (DBAs). If your instructor believes you will benefit from reviewing these skills again, they may require you to complete the lesson pages and assessment.<br>
            <br>
            <strong>What if I have questions?</strong><br>
            <br>
            Please contact your instructor if you have questions regarding your pretest or mastered content.<br>
            <br>
            Keep up the excellent work!<br>
            </p>`;
            //send email logic
        }
    }
}