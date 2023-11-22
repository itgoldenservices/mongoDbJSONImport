const fs = require('fs');
const path = require('path');

let debugMC = 0;
let useMC = 1;
let localServerMC = 0;
let io;
let includeLinks = 1; // this should be passed in as a param in the future

let mpos;
let spos;
let theSLT;

let assTypeIndexes = { exams: 0, assignments: 1, worksheets: 2, quizzes: 3 };
let assTypes = ["exams", "assignments", "worksheets", "quizzes"];
let assTypePrefixes = ["exam", "assignment", "worksheet", "quiz"];

let feedbackFiles = ["examform.cgi", "assignmentfeedback.cgi", "worksheetsetup.cgi", "quizform.cgi"];

// require "/subroutines/mcheader.cgi";
// require "/subroutines/gradebook.cgi";

function getAssessmentDirectory(index) {
    if (index < assTypes.length) {
        return assTypes[index];
    } else {
        return "";
    }
}


async function getStudentRosterHash(netapp, theDir, instructor, cid) {
    let returnHash = {};
    let fullName = "";
    let sortedNameArray = [];
    let sortFormattedName;

    let pathToRoster = `/${netapp}/${theDir}/educator/${instructor}/${cid}/roster.txt`;

    let roster = fs.readFileSync(pathToRoster, 'utf8').split('\n');
    fullName = "";

    for (let rosterEntry of roster) {
        let rosterField = rosterEntry.trim().split('*');

        let accountName = rosterField[0];

        fullName += rosterField[5] ? rosterField[5] + ", " : "";
        fullName += rosterField[2] ? rosterField[2] + " " : "";
        fullName += rosterField[3] ? rosterField[3] + " " : "";
        fullName += rosterField[4] ? rosterField[4] : "";

        sortFormattedName = (fullName.toLowerCase()) + "*" + rosterField[0];
        sortedNameArray.push(sortFormattedName);

        let pathToProfile = `/${netapp}/${theDir}/educator/${instructor}/${cid}/students/${accountName}/profile.txt`;
        let profile = fs.readFileSync(pathToProfile, 'utf8').split('\n');
        let profileField = profile[0].trim().split('*');

        if (profileField[11] === "1") {
            fullName += " (H)";
        }

        returnHash[rosterField[0]] = {
            name: fullName, // You need to replace this with a function that does the same as Perl's encode_entities
            honors: profileField[11]
        };

        // You need to replace this with a function that does the same as Perl's getStudentSegmentString
        returnHash[rosterField[0]].semester = getStudentSegmentString({
            shellRoot: netapp,
            dir: theDir,
            instructorId: instructor,
            courseId: cid,
            username: accountName
        });

        sortedNameArray.sort();

        fullName = "";
    }

    return { returnHash, sortedNameArray };
}

function getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
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

async function _getAssessment(path) {
    let data = await readFile(path, 'utf8');
    return data.split('\n');
}

async function _setAssessment(path, lines) {
    let data = lines.join('\n');
    await writeFile(path, data);
    await chmod(path, '0660');
}

async function _setExamInstructorComments(path, comment) {
    let dataHash;
    if (fs.existsSync(path)) {
        let rawJSONData = await readFile(path, 'utf8');
        dataHash = JSON.parse(rawJSONData);
    }

    if (comment === 'DELETE ME-UCOMPASS') {
        delete dataHash.instructorComments;
    } else {
        dataHash.instructorComments = comment;
    }

    let json_text = JSON.stringify(dataHash);
    await writeFile(path, json_text);
    await chmod(path, '0660');
}

async function exemptAllStudentAssessmentInCourse(netapp, theDir, instructor, cid, student) {
    let gbArray = await getGradeBuilderArray(netapp, theDir, instructor, cid);
    let objectIDs = await getObjectIDHash(netapp, theDir, instructor, cid);

    for (let gradebuilderItem of gbArray) {
        if (objectIDs[gradebuilderItem.objectID]) {
            let object = objectIDs[gradebuilderItem.objectID];
            let theAssType = assTypes[object.type];

            await setAssessmentIsExempt(netapp, theDir, instructor, cid, theAssType, object.itemIndex, student, 1, "AutoeEX all student's assessments", 1);
        } else {
            console.error(`Cannot find object : ${netapp}, ${theDir}, ${instructor}, ${cid}, ${gradebuilderItem.objectID}`);
        }
    }
}

async function setAssessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student, shouldExempt, comment, ignoreIfSubmissionExists) {
    if (comment.length) {
        comment = comment.replace(/\+/g, ' ');
        comment = decodeURIComponent(comment);
        comment = comment.replace(/<!--(.|\n)*-->/g, '');
        comment = comment.replace(/\*/g, '&#42;');
        comment = comment.replace(/\%/g, '&#37;');
        comment = comment.replace(/\~/g, '&#126;');
    }

    let pathToAssessment = await getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

    let lines = [];
    let headers = [];
    let curTime = Date.now();
    let updateGradesChanged = 0;
    let debug = 0;
    let domain = process.env['HTTP_HOST'];

    if (typeIndex === "exams") {
        if (shouldExempt === 1) {
            if (fs.existsSync(pathToAssessment)) {
                if (!await assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) &&
                    !await assessmentIsManuallyGraded(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) &&
                    (ignoreIfSubmissionExists === 0 || !await assessmentHasBeenAccessed(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student))) {

                    lines = await _getAssessment(pathToAssessment);
                    headers = lines[0].split('*');

                    headers[0] = 'Submission';
                    headers[4] = 'ex';
                    headers[5] = curTime;

                    lines[0] = headers.join('*');
                    await _setAssessment(pathToAssessment, lines);
                    updateGradesChanged = 1;
                    if (debug) console.error(`Exempting: ${pathToAssessment}`);
                }
            } else {
                lines[0] = `Submission****ex*${curTime}**\n`;
                await _setAssessment(pathToAssessment, lines);
                updateGradesChanged = 1;
                if (debug) console.error(`Exempting: ${pathToAssessment}`);
            }
            let pathToJSON = pathToAssessment.replace(/\.txt$/m, '.json');
            await _setExamInstructorComments(pathToJSON, comment);
        }
        else {
            // we want to remove the ex ONLY if the submission already exists and
            // the submission currently has an "ex" in it.
            if (await assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)) {
                if (debug) console.error(`Unexempting: ${pathToAssessment}`);

                lines = await _getAssessment(pathToAssessment);
                if (lines.length > 1) {
                    headers = lines[0].split('*');

                    headers[0] = 'Submission';
                    headers[4] = '';
                    headers[5] = "";

                    lines[0] = headers.join('*');
                    await _setAssessment(pathToAssessment, lines);
                    updateGradesChanged = 1;
                } else {
                    // NEW FLVS GRADEBOOK API
                    if (((!/(fatdec|tolland)/.test(domain)) && (/flvs\.net/.test(domain)) || (/dev\.educator\.flvs\.net$/.test(domain)) || (/testlearn\.educator\.flvs\.net$/.test(domain))) && (cid > 0)) {
                        const integrationAPI = require("/subroutines/flvsexport/integrationAPI.pl");
                        await recordEvent({
                            path: pathToAssessment,
                            event: "ASSESSMENT_RESET"
                        });
                    }
                    // END FLVS GRADEBOOK API

                    await unlink(pathToAssessment);
                    updateGradesChanged = 1;
                }
                let pathToJSON = pathToAssessment.replace(/\.txt$/m, '.json');
                await _setExamInstructorComments(pathToJSON, 'DELETE ME-UCOMPASS');
            }
        }
    } else if (typeIndex === "assignments") {
        if (shouldExempt === 1) {
            if (!assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)
                && !assessmentIsManuallyGraded(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)
                && (ignoreIfSubmissionExists === 0 || !assessmentHasBeenAccessed(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student))) {

                // need to find out if there are rubrics
                let pathToAssignmentDefinition = `/${netapp}/${theDir}/educator/${instructor}/${cid}/assignments/${assessmentIndex}.txt`;
                let lines = fs.readFileSync(pathToAssignmentDefinition, 'utf-8').split('\n');
                let fields = lines[0].split('*');
                let rubCatCount = fields[7];
                if (rubCatCount === "") {
                    rubCatCount = 0;
                }

                let rubricSpecs = "";
                for (let i = 1; i <= rubCatCount; i++) {
                    rubricSpecs += '%~~' + i;
                }
                if (rubricSpecs !== "") {
                    rubricSpecs += '%~~%';
                }

                if (fs.existsSync(pathToAssessment)) {
                    lines = _getAssessment(pathToAssessment);
                    let headers = lines[0].split('*');
                    headers[0] = 'ex' + rubricSpecs;

                    if (comment.length) {
                        let tempStr = headers[1];
                        tempStr += "<br>" + comment;
                        headers[1] = tempStr;
                    }

                    lines[0] = headers.join('*');
                } else {
                    lines[0] = `ex${rubricSpecs}*${comment}**\n`;
                }
                _setAssessment(pathToAssessment, lines);
                if (debug) console.error(`Exempting: ${pathToAssessment}`);
                updateGradesChanged = 1;
            }

        } else {
            if (await assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)) {
                if (debug) console.error(`Unexempting: ${pathToAssessment}`);

                let lines = await _getAssessment(pathToAssessment);
                let headers = lines[0].split('*');

                if (headers[3].trim() === 'yes') {
                    // if the student did submit for grading we just want to remove the manual grade
                    // and leave everything else alone
                    headers[0] = headers[0].replace(/^ex/, '');
                    lines[0] = headers.join('*');
                    await _setAssessment(pathToAssessment, lines);
                    updateGradesChanged = 1;
                } else {
                    // otherwise if the student did not submit for
                    // grading just remove the submission record

                    // NEW FLVS GRADEBOOK API
                    if (((!/(fatdec|tolland)/.test(domain)) && (/flvs\.net/.test(domain)) || (/dev\.educator\.flvs\.net$/.test(domain))) && (cid > 0)) {
                        const integrationAPI = require("/subroutines/flvsexport/integrationAPI.pl");
                        await recordEvent({
                            path: pathToAssessment,
                            event: "ASSESSMENT_RESET"
                        });
                    }
                    // END FLVS GRADEBOOK API

                    await fs.promises.unlink(pathToAssessment);
                    updateGradesChanged = 1;
                }
            }
        }
    } else if (typeIndex === "worksheets") {
        if (shouldExempt === 1) {
            if (fs.existsSync(pathToAssessment)) {
                if (!assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)
                    && !assessmentIsManuallyGraded(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)
                    && (ignoreIfSubmissionExists === 0 || !assessmentHasBeenAccessed(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student))) {

                    let lines = _getAssessment(pathToAssessment);
                    let headers = lines[0].split('*');

                    headers[0] = 'final';
                    headers[3] = 'ex';

                    if (headers[1] === "") {
                        headers[1] = curTime;
                    }
                    lines[0] = headers.join('*');

                    lines[0] = lines[0].trim() + "\n";
                    _setAssessment(pathToAssessment, lines);
                    updateGradesChanged = 1;
                    if (debug) console.error(`Exempting: ${pathToAssessment}`);
                }
            } else {
                lines[0] = `final*${curTime}**ex\n`;

                _setAssessment(pathToAssessment, lines);
                updateGradesChanged = 1;
                if (debug) console.error(`Exempting: ${pathToAssessment}`);
            }
        }
        else {
            if (assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student)) {
                let lines = _getAssessment(pathToAssessment);

                let shouldRemove = true;
                let storedLine = lines[0];
                let tempLines = lines.slice(1);

                for (let line of tempLines) {
                    line = line.replace(/\*/g, '').replace(/\s/g, '');
                    if (line !== "") {
                        shouldRemove = false;
                    }
                }

                if (!shouldRemove) {
                    let headers = storedLine.split('*');
                    headers[3] = '';

                    lines[0] = headers.join('*') + "\n";
                    _setAssessment(pathToAssessment, lines);
                    updateGradesChanged = 1;
                } else {
                    if (((!/(fatdec|tolland)/.test(domain)) && (/flvs\.net/.test(domain)) || (/dev\.educator\.flvs\.net$/.test(domain))) && (cid > 0)) {
                        const integrationAPI = require("/subroutines/flvsexport/integrationAPI.pl");
                        recordEvent({
                            path: pathToAssessment,
                            event: "ASSESSMENT_RESET"
                        });
                    }

                    fs.unlinkSync(pathToAssessment);

                    let pathToFeedback = pathToAssessment.replace(/\.txt$/, '.feedback');
                    fs.unlinkSync(pathToFeedback);
                    updateGradesChanged = 1;
                }

                if (debug) console.error(`Unexempting: ${pathToAssessment}`);
            }
        }
    }
    else if (typeIndex === "quizzes") {

    }

    if (((!/(fatdec|tolland)/.test(domain)) && (/flvs\.net/.test(domain)) || (/dev\.educator\.flvs\.net$/.test(domain))) && (cid > 0) && (updateGradesChanged)) {
        const integrationAPI = require("/subroutines/flvsexport/integrationAPI.pl");

        recordEvent({
            path: pathToAssessment,
            event: "ASSESSMENT_GRADED"
        });
    }
}

function assessmentIsExempt(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
    let pathToAssessment = getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

    if (typeIndex === "exams") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            if (headers[4].toLowerCase() === 'ex') {
                return 1;
            }
        }
    } else if (typeIndex === "assignments") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[0] = headers[0].toLowerCase();
            if (headers[0].startsWith('ex')) {
                return 1;
            }
        }
    } else if (typeIndex === "worksheets") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[3] = headers[3].trim();
            if (headers[3].toLowerCase() === 'ex') {
                return 1;
            }
        }
    } else if (typeIndex === "quizzes") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[4] = headers[4].trim();
            if (headers[4].toLowerCase() === 'ex') {
                return 1;
            }
        }
    }

    return 0;
}

function assessmentIsTempZero() {
    return 0;
}

function setAssessmentIsTempZero() {
    return 1;
}

function assessmentHasBeenAccessed(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
    let pathToAssessment = getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

    if (fs.existsSync(pathToAssessment)) {
        return 1;
    }

    return 0;
}

function assessmentIsManuallyGraded(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
    let pathToAssessment = getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

    if (typeIndex === "exams") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            if (headers[4].toLowerCase() !== '') {
                return 1;
            }
        }
    } else if (typeIndex === "assignments") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[0] = headers[0].toLowerCase();
            if (headers[0] !== '') {
                return 1;
            }
        }
    } else if (typeIndex === "worksheets") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[3] = headers[3].trim();
            if (headers[3].toLowerCase() !== '') {
                return 1;
            }
        }
    } else if (typeIndex === "quizzes") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[4] = headers[4].trim();
            if (headers[4].toLowerCase() !== '') {
                return 1;
            }
        }
    }

    return 0;
}

unction assessmentIsTempZero() {
    return 0;
}

function setAssessmentIsTempZero() {
    return 1;
}

function assessmentHasBeenAccessed(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
    let pathToAssessment = getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

    if (fs.existsSync(pathToAssessment)) {
        return 1;
    }

    return 0;
}

function assessmentIsManuallyGraded(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student) {
    let pathToAssessment = getPathToAssessment(netapp, theDir, instructor, cid, typeIndex, assessmentIndex, student);

    if (typeIndex === "exams") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            if (headers[4].toLowerCase() !== '') {
                return 1;
            }
        }
    } else if (typeIndex === "assignments") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[0] = headers[0].toLowerCase();
            if (headers[0] !== '') {
                return 1;
            }
        }
    } else if (typeIndex === "worksheets") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[3] = headers[3].trim();
            if (headers[3].toLowerCase() !== '') {
                return 1;
            }
        }
    } else if (typeIndex === "quizzes") {
        if (fs.existsSync(pathToAssessment)) {
            let lines = fs.readFileSync(pathToAssessment, 'utf-8').split('\n');
            let headers = lines[0].split('*');
            headers[4] = headers[4].trim();
            if (headers[4].toLowerCase() !== '') {
                return 1;
            }
        }
    }

    return 0;
}

function getAssessmentNameFromIndex(netapp, theDir, instructor, cid, folderString, assessmentIndex) {
    let realIndex = assTypeIndexes[folderString];

    return getAssessmentName(netapp, theDir, instructor, cid, realIndex, assessmentIndex);
}

function getAssessmentName(netapp, theDir, instructor, cid, typeIndex, assessmentIndex) {
    let fullPathToTemplate = `/${netapp}/${theDir}/educator/${instructor}/${cid}/${assTypes[typeIndex]}/${assessmentIndex}.txt`;

    if (fs.existsSync(fullPathToTemplate)) {
        let assessmentTemplate = fs.readFileSync(fullPathToTemplate, 'utf-8').split('\n');

        let firstLine = assessmentTemplate[0];
        let fields = firstLine.split('*');

        return entities.encode(fields[0]);
    } else {
        console.error(`GB Assessment does not exist ${fullPathToTemplate}`);

        return "Cannot find Name";
    }
}

function getGradeBuilderArray(netapp, theDir, instructor, cid) {
    let gbArray = [];

    let gradebuilderstuff = fs.readFileSync(`/${netapp}/${theDir}/educator/${instructor}/${cid}/gradebuilder.txt`, 'utf-8').split('\n');

    gradebuilderstuff.shift();    //first line is yes/no - we should ignore it

    for (let gbEntry of gradebuilderstuff) {
        gbEntry = gbEntry.trim();

        let fields = gbEntry.split(':');

        let gbHash = {};

        // 67:1:yes:2:1
        // obid, pts, extra credit, term, honors

        gbHash.objectID = fields[0];
        gbHash.points = fields[1];
        gbHash.extraCredit = fields[2];
        gbHash.term = fields[3];
        gbHash.honors = fields[4];
        gbArray.push(gbHash);
    }

    return gbArray;
}
