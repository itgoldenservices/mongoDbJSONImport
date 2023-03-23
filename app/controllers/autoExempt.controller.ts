// import { CommonParams } from '../interfaces';
// import { FileService } from './file.service';
// import { MongoDB } from "@educator-ng/database";
import { title } from 'process';
import { AssessmentService } from './assessment.controller';
import { CommonParams, FileService, MongoDB, BaseService } from './services';
const fs = require("fs");

interface ExemptedPages {
    exempted_pages?: any
}

interface Instructor {
    instructor_foreign_id: string,
    username: string,
    instructor_idfk: string,
    lname: string,
    mname: string,
    fname: string,
}

interface Owner {
    owner_foreign_id: string,
    username: string,
    owner_idfk: string,
    lname: string,
    mname: string,
    fname: string,
}

interface Course {
    title: string,
    cid: string
    vsa_course_id: string,
    vsa_classroom_id: string
    course_idfk: string
}

interface Lessons {
    role: string,
    status: string
    lastUpdatedFromVSA: string
    course: Course
    instructor: Instructor,
    owner: Owner,
    exemptedLessons: any
}

export class AutoExemptionService {
    private assessService: AssessmentService;
    constructor() {
        this.assessService = new AssessmentService();
    }

    createInstructor(instructor_foreign_id: string,
        username: string,
        instructor_idfk: string,
        lname: string,
        mname: string,
        fname: string) {
        return {
            instructor_foreign_id,
            username,
            instructor_idfk,
            lname,
            mname,
            fname,
        }
    }

    createOwner(owner_foreign_id: string,
        username: string,
        owner_idfk: string,
        lname: string,
        mname: string,
        fname: string) {
        return {
            owner_foreign_id,
            username,
            owner_idfk,
            lname,
            mname,
            fname,
        }
    }

    createObjectToStore(title: string, cid: string, vsa_course_id: string, vsa_classroom_id: string, instructor: Instructor, owner: Owner, exemptedLessons: any): Lessons {
        return {
            "role": "student",
            "status": "archived",
            "lastUpdatedFromVSA": new Date().toISOString(),
            "course": {
                title,
                cid,
                vsa_course_id,
                vsa_classroom_id,
                "course_idfk": ''
            },
            "instructor": instructor,
            "owner": owner,
            "exemptedLessons": exemptedLessons,
        }
    }

    static async getExemptedLessons(params: CommonParams): Promise<string[]> {
        const exemptedLessons: string[] = [];

        try {
            const tempExemptedLessons = JSON.parse(await FileService.getFileContents(`${FileService.getStudentCoursePath(params)}/exemptedlesssons_json.txt`, false, false) || '{}');
            if (tempExemptedLessons && tempExemptedLessons.exempted_pages) {
                for (const [lesson, _isExemptedInt] of Object.entries(tempExemptedLessons.exempted_pages)) {
                    exemptedLessons.push(lesson);
                }
            }
        } catch (err) {
            console.error(err);
        }

        return exemptedLessons;
    }

    async readDataFromDB(entry: any, data: any, type: string) {
        try {
            // MongoDB.connect(process.env.MDB_ADDRESS, async (err: Error) => {
            MongoDB.connect('process.env.MDB_ADDRESS', async (err: Error) => {
                if (err) {
                    // console.log('\n===============================================');
                    // console.log(`\nUnable to connect to database server ( ${process.env.MDB_ADDRESS} )\n`);
                    // console.log('=================================================');
                    process.exit(1)
                } else {
                    const client = MongoDB.get()
                    const database = client.db(type === 'definitions' ? 'e1 general' : 'enrollments');
                    const config_collection = database.collection(type === 'definitions' ? 'definitions' : 'lessons');
                    
                    //commenting for now

                    // config_collection.findById(data.id).then((dataFromDB) => {
                    //     entry.lessons_to_skip.forEach((lessonToSkip: string) => {
                    //         dataFromDB.exemptedLessons[lessonToSkip] = 1;
                    //     })
                    //     dataFromDB.exemptedLessons = dataFromDB.exempted_pages;
                    //     if (dataFromDB) {
                    //         this.writeDataToDB(dataFromDB, 'lessons')
                    //     }
                    //  })

                    //process.exit(0);
                }
            });

        } catch (e) {

            process.exit(1);

        }
    }

    async writeDataToDB(data: any, type: string) {
        try {
            // MongoDB.connect(process.env.MDB_ADDRESS, async (err: Error) => {
            MongoDB.connect('process.env.MDB_ADDRESS', async (err: Error) => {
                if (err) {
                    // console.log('\n===============================================');
                    // console.log(`\nUnable to connect to database server ( ${process.env.MDB_ADDRESS} )\n`);
                    // console.log('=================================================');
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
        const fields = lines[0].split('*');

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

    autoExemptionsTurnedOn(usage: any, dir: string, instructor: string) {

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
        const correctGroups: any = {};
        const assessmentMap: any = {};

        for (const questionInfo of template) {
            const [questionID, format, group, points] = questionInfo.split("*");
            assessmentMap[questionID] = { group, points };
        }

        for (const key of Object.keys(result)) {
            const resultEntry = result[key];
            const assessmentMapEntry = assessmentMap[key];

            if (!assessmentMapEntry) continue;

            let groupEntry = correctGroups[assessmentMapEntry.group][key].group;

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
        const correctGroups: any = {};
        const assessmentMap: any = {};
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

    handleExemptions(entry: any, pathToFile: string, pretest_name: string, data: Lessons) {
        const assessmentsExemted: string[] = [];
        const [, netapp, netappDir, , instructor, cid, , learner, assessment] = pathToFile.split('/');
        const pathToCourse = `/${netapp}/${netappDir}/educator/instructor/${cid}`;
        entry.assessments_to_ex.forEach((item: any) => {

            const thePath = `/${netapp}/${netappDir}/educator/instructor/${cid}/${item.path}/${item.index}.txt`;
            const nameOfAssessmentInCourse = this.getBasicAssessmentName(thePath || ''); // get definition
            if (item.name === nameOfAssessmentInCourse) {
                console.warn(`should exempt: ${item.name} ${pretest_name}`);
                assessmentsExemted.push(item.name);
                this.assessService.setAssessmentIsExempt(netapp, netappDir, instructor, cid, item.path, item.index, learner, 1, "Mastery of content and skills were demonstrated on pretestName", 1);
            } else {
                console.warn(`Assessment names do not match for list of assessments to ex: ${thePath} - ${item.name} - ${nameOfAssessmentInCourse}`);
            }
        });

        // read in existing data
        if (entry.assessments_to_ex.length == 0 && entry.lessons_to_skip) {
            this.readDataFromDB(entry, data, 'definitions');
            
        }
        return assessmentsExemted;
    }


    async checkExam(pathToFile: string, event: string) {
        let assessmentsExemted: any = [], storedPretestName, studentPageNames: string[] = [];

        const activeCourses = [
            'jarnstein1_3921',
            'sking222_4028',
            'amacy3_3803',
            'arobinson143_2489'
        ];

        const [, netapp, netappDir, dummy, instructor, cid, dummy2, learner, assessment] = pathToFile.split('/');
        if (!activeCourses.includes(instructor + '_' + cid))
            return;
        if (assessment.startsWith('exam') || assessment.startsWith('assignment')) {

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
                    if (!this.autoExemptionsTurnedOn(exemptionData.usage, netappDir, instructor)) {

                        console.warn(" --. auto exemptions off! <--- ");
                        return;
                    }

                    let submittedIndex = assessment;

                    let assessmentType = "";

                    assessmentType = "exam";
                    if (submittedIndex.startsWith("exam")) {
                        submittedIndex = submittedIndex.replace(/^exam/, "");
                    } else if (submittedIndex.startsWith("assignment")) {
                        assessmentType = "assignment";
                        submittedIndex = submittedIndex.replace(/^assignment/, "");
                    }
                    submittedIndex = submittedIndex.replace(/\.txt$/, "").replace(/\.feedback$/, "");

                    let pathToExamTemplate = '';
                    let examTemplate: any = [];

                    const JSONSubmittedIndex = `${assessmentType}_${submittedIndex}`;
                    console.log(JSONSubmittedIndex);
                    if (exemptionData[JSONSubmittedIndex]) {
                        console.warn("assessment in pretest list:", pathToFile, assessmentType);

                        // now read in the assessment design...
                        if (assessmentType === "exam") {
                            pathToExamTemplate = `${pathToCourse}/exams/submittedIndex.txt`;
                            examTemplate = fs.readFileSync(pathToExamTemplate);
                        } else if (assessmentType === "assignment") {
                            pathToExamTemplate = `${pathToCourse}/assignments/submittedIndex.txt`;
                            examTemplate = fs.readFileSync(pathToExamTemplate);
                        } else {
                            console.warn("Invalid assessment type sent to checkExam: assessmentType");
                            return;
                        }
                        console.log(this.getBasicAssessmentName(pathToExamTemplate), exemptionData[JSONSubmittedIndex]['pretest_name'])
                        if (this.getBasicAssessmentName(pathToExamTemplate) === exemptionData[JSONSubmittedIndex]['pretest_name'])
                            if (event === 'ASSESSMENT_RESET') {
                                for (const key in exemptionData[JSONSubmittedIndex].exemption_data) {
                                    const entry = exemptionData[JSONSubmittedIndex].exemption_data[key];
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
                                                    this.assessService.setAssessmentIsExempt(netapp, netappDir, instructor, cid, exAssessmentEntry.path, exAssessmentEntry.index, learner, 0, "Exemption Removed", 1);
                                                } else {
                                                    console.warn("Assessment names do not match for list of assessments to un-ex:", exAssessmentEntry.name, "-", nameOfAssessmentInCourse);
                                                }

                                            });

                                            // read in existing data

                                            if (entry['lessons_to_skip']) {
                                                try {

                                                    const instructorName = instructor.split('_');
                                                    const learnerName = learner.split('_');

                                                    const instructorObj = this.createInstructor('', instructor, '', instructorName[2], instructorName[1], instructorName[0])
                                                    const ownerObj = this.createOwner('', learner, '', learnerName[2], learnerName[1], learnerName[0])
                                                    const data = this.createObjectToStore(title, cid, '', '', instructorObj, ownerObj, {});

                                                     this.readDataFromDB(entry, data, 'lessons')

                                                } catch (err) {
                                                    console.error('Error:', err);
                                                }
                                            }
                                        }
                                        else {
                                            console.warn("Assessment names do not match for removal of auto exemptions: $assessmentName - exemptionData.JSONSubmittedIndex}.pretest_name}");
                                        }

                                    }
                                }
                            } else {
                                // now we know it is a pretest - we need to read
                                // in all the question answers
                                // left off here!

                                if (assessmentType === "exam") {
                                    const data = fs.readFileSync(pathToFile);
                                    var rawAnsweredQuestions = data.toString().split('\n');

                                    // pop off the date time stuff
                                    rawAnsweredQuestions.shift();

                                    examTemplate.shift();

                                    var examResults = [];

                                    //my @correctGroups = getCorrectGroups(submission => \@rawAnsweredQuestions, template => \@examTemplate);


                                    var quell, shellRoot, dir, username, student, courseid, type, key,
                                        realscore, maxscore, manualscore, gradebuilderstuff, sizegradebuilderstuff,
                                        gradebuildercontribution, contribution, extracredit, honors, assessmentstatus,
                                        workiscompleted, myTerm, timesubmitted, requestgrade;

                                    shellRoot = netapp;
                                    dir = netappDir;
                                    quell = instructor;
                                    username = instructor;
                                    student = learner;
                                    courseid = cid;
                                    type = 'exam';
                                    key = submittedIndex;
                                    realscore = 0;

                                    //this calls the old getscore routine from the gradebook.pl lib

                                    examResults = await this.assessService.getSubmission(assessmentType, username, key, {
                                        shellRoot, dir,
                                        instructor,
                                        courseid,
                                        username
                                    }, true);



                                    var correctGroups = this.getCorrectGroups(examTemplate, examResults);
                                    // now check for exemption triggers
                                    Object.keys(exemptionData[JSONSubmittedIndex].exemption_data).forEach((key) => {
                                        var entry = exemptionData[JSONSubmittedIndex].exemption_data[key];
                                        // check the group requirements
                                        var shouldExempt = true;
                                        entry.exam_group_requirements.forEach((groupRequirement: any) => {
                                            if (groupRequirement.group && correctGroups[groupRequirement.group]) {
                                                if (groupRequirement.required === 'all') {
                                                    if (correctGroups[groupRequirement.group].all_correct !== 1) {
                                                        shouldExempt = false;
                                                    }
                                                } else {
                                                    if (correctGroups[groupRequirement.group].correct_count < groupRequirement.required) {
                                                        shouldExempt = false;
                                                    }
                                                }
                                            }
                                        });

                                        //now actually do the exemption
                                        if (shouldExempt) {
                                            const instructorName = instructor.split('_');
                                            const learnerName = learner.split('_');

                                            const instructorObj = this.createInstructor('', instructor, '', instructorName[2], instructorName[1], instructorName[0])
                                            const ownerObj = this.createOwner('', learner, '', learnerName[2], learnerName[1], learnerName[0])
                                            const data = this.createObjectToStore(title, cid, '', '', instructorObj, ownerObj, {});
                                            assessmentsExemted.push(...this.handleExemptions(entry, pathToFile, exemptionData[JSONSubmittedIndex].pretest_name, data));
                                            storedPretestName = exemptionData[JSONSubmittedIndex].pretest_name;
                                            entry.standards.forEach((studentPageName: string) => {
                                                studentPageNames.push(studentPageName);
                                            });

                                        }

                                    });

                                }
                                else if (assessmentType === "assignment") {
                                    let assignmentresults;
                                    let shouldExempt = 0;

                                    // const correctGroups = getCorrectGroups(submission => rawAnsweredQuestions, template => examTemplate);



                                    const quell = "";
                                    let shellRoot;
                                    let dir;
                                    const username = "instructor";
                                    const student = "learner";
                                    const courseid = "cid";
                                    const type = 'assignment';
                                    const key = submittedIndex;
                                    let realscore = 0;
                                    const gradebuilderstuff = [];
                                    let sizegradebuilderstuff;
                                    let gradebuildercontribution;
                                    let contribution;
                                    let extracredit;
                                    let honors;
                                    let assessmentstatus;
                                    let workiscompleted;
                                    let myTerm;
                                    let timesubmitted;
                                    let requestgrade;

                                    shellRoot = netapp;
                                    dir = netappDir;

                                    assignmentresults = await this.assessService.getSubmission(assessmentType, username, key, {
                                        shellRoot, dir,
                                        instructor,
                                        courseid,
                                        username
                                    }, true);



                                    // const @correctGroups = getCorrectGroups(submission.\@rawAnsweredQuestions, template.\examTemplate);
                                    const examData = exemptionData[JSONSubmittedIndex]['exemption_data'];
                                    const { manual_score, rubrics } = assignmentresults;

                                    Object.keys(examData).forEach(key => {
                                        const entry = examData[key];
                                        let shouldExempt = 0;

                                        if (manual_score && entry.assignment_total_requirement > 0 && manual_score >= entry.assignment_total_requirement) {
                                            shouldExempt = 1;

                                        } else if (entry.rubric_requirements) {
                                            entry.rubric_requirements.forEach((rubricRequirement: any) => {
                                                if (rubrics[rubricRequirement.rubric_name] >= rubricRequirement.required) {
                                                    shouldExempt = 1;
                                                }
                                            });
                                        }

                                        if (shouldExempt) {
                                            const instructorName = instructor.split('_');
                                            const learnerName = learner.split('_');

                                            const instructorObj = this.createInstructor('', instructor, '', instructorName[2], instructorName[1], instructorName[0])
                                            const ownerObj = this.createOwner('', learner, '', learnerName[2], learnerName[1], learnerName[0])
                                            const data = this.createObjectToStore(title, cid, '', '', instructorObj, ownerObj, {});
                                            const assessmentsToBeExemted = this.handleExemptions(entry, pathToFile, exemptionData[JSONSubmittedIndex].pretest_name, data);

                                            if (assessmentsToBeExemted.length > 0)
                                                assessmentsExemted.push(...assessmentsToBeExemted);
                                            storedPretestName = exemptionData.JSONSubmittedIndex.pretest_name;
                                            const studentPageNamesTemp = [...entry.standards];
                                            studentPageNames.push(...studentPageNamesTemp);
                                            //assessService.setAssessmentIsExempt(netapp, netappDir, instructor, cid, assessment.path, assessment.index, learner, 1, "Auto Exempted based on work done in exemptionData.submittedIndex}.pretest_name}", 1);
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
            let studentInfo = this.getStudentInfo(netapp, netappDir, instructor, cid, learner);
            let alltests = '';

            assessmentsExemted.sort().forEach((exempted: string) => {
                alltests += exempted + '<br>';
            });

            if (studentPageNames.length > 0) {
                studentPageNames.sort().forEach((studentPageName) => {
                    alltests += studentPageName + '<br>';
                });
            }

            const domain = this.getDomain();
            const emailText = `<p>
            Dear ${studentInfo.fname},<br>
            <br>
            Nice work on the ${storedPretestName}!<br>
            <br>
            Your results show that you have already mastered the content on the following lesson page(s) and assessment:<br>
            <br>
            ${alltests}
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