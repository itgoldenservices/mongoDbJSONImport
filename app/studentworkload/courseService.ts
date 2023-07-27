import { FileService } from "../services/file.service";
import { CommonParams } from "../interfaces/common-params.interface";
import { CourseHistory, WidgetPreset } from '../interfaces'
import { BaseService, MdbBaseInterface } from "./base.service";
import { Course } from "../classes/course.class";
import { Roles, MongoUpdateStatus, } from "../enums";
import { Logger } from './logger.service'
import { CacheResponse, CacheNamespaces, TimeConstants } from '@educator-ng/common';
import { ComplexResults, } from "@educator-ng/common";
import { MdbSelector, MdbHistoryInterface } from "@educator-ng/common";
import { MongoDB, MemcachedService } from "@educator-ng/database";
import { CourseInformation, CourseStudentEnrollment, getRosterSize, WorkloadService } from '@educator-ng/common';
import * as legacyFFService from "@educator-ng/common";
import { UtilitiesService } from './utilities.service';
import { TransactionOptions } from "mongodb";
import * as _ from "lodash";

const util = require("util");
const exec = util.promisify(require("child_process").exec);

export interface CourseListParams {
    includeArchivedCourses?: boolean;
    includeInstructorCourseList?: boolean;
    includeStudentAndTaCourses?: boolean;
    onlyArchivedCourses?: boolean;
    includeRosterSize?: boolean;
    includeCourseWorkload?: boolean;
    includedCoursesWithNoStudentAccess?: boolean;
    typesOfUser?: Roles[];
}
export interface CourseSegmentInterface {
    foreign_id: number;
    segment: number;
}

export interface MdbModifyCourseInterface extends MdbBaseInterface {
    _id?: string; // Object ID - should be changed?
    status: "Active" | "Archived";
    cid: string;
    title: string;
    rule?: string;
    history?: {
        [index: number]: MdbHistoryInterface;
    };
    instructor: {
        user_idfk?: string;
        foreign_id?: number;
        lname?: string;
        fname?: string;
        mname?: string;
        username: string;
        last_signed_in?: {
            ip: string;
            date_time: Date;
        };
    };
    av_tools_active?: boolean;
    thread_viewing?: boolean;
    credit_hours?: number;
    enrollment_settings?: {
        mode: string;
        instructor_can_access: boolean;
        students_can_access: boolean;
        registration_door?: string;
    };
    timezone_offset_from_eastern?: number;
    segments?: {
        [index: number]: CourseSegmentInterface;
    };
    version?: number;
    widgets?: any;
}

export enum COURSE_ERROR_CODES {
    UNKNOWN_COURSE_ERROR = "COURSE_UNKNOWN_COURSE_ERROR",
    BAD_INSERT = "COURSE_BAD_INSERT",
    GOOD_INSERT = "COURSE_GOOD_INSERT",
    SEGMENT_ADDED = "COURSE_SEGMENT_ADDED",
    UPDATED = "COURSE_UPDATED",
    INITIAL_UPDATE_FAILED = "COURSE_INITIAL_UPDATE_FAILED",
    SECONDARY_UPDATE_FAILED = "COURSE_SECONDARY_UPDATE_FAILED",
    CID_MISSING = "COURSES_CID_MISSING",
    TITLE_MISSING = "COURSES_TITLE_MISSING",
    USERNAME_MISSING = "COURSES_USERNAME_MISSING",
    NOTHING_CHANGED_ON_UPDATE = "COURSES_NOTHING_CHANGED_ON_UPDATE",
    TRANSACTION_ABORTED = "COURSES_TRANSACTION_ABORTED",
    COPY_FROM_MASTER_ATTEMPTED = "COURSES_COPY_FROM_MASTER_ATTEMPTED",
    EVENT_OUT_OF_ORDER = "COURSES_EVENT_OUT_OF_ORDER",
    ERROR_REMOVING_CLASSROOM_ID = "COURSES_ERROR_REMOVING_CLASSROOM_ID",
    INDEX_TO_REMOVE_NOT_FOUND = "COURSES_INDEX_TO_REMOVE_NOT_FOUND",
    CLASSROOM_SWITCHED_CIDS = "COURSES_CLASSROOM_SWITCHED_CIDS",
    CLASSROOM_ID_REMOVED = "COURSES_CLASSROOM_ID_REMOVED",

    COURSE_ADDED_MANUALLY = "COURSES_COURSE_ADDED_MANUALLY",
    ERROR_ADDING_COURSE_MANUALLY = "COURSES_ERROR_ADDING_COURSE_MANUALLY",
}

export interface CourseListEntry {
    courseid: string;
    courseTitle: string;
    instructorName: string;
    typeOfUser: Roles;
    instructorUsername: string;
}

export class CourseService extends BaseService {

    // A function to check and see if we should be writing courses to MongoDB.
    shouldWriteCoursesToDB = () => {
        console.log("Writing to DB allowed:", process.env.MDB_COURSES_SHOULD_WRITE_TO_DB);
        return (process.env.MDB_COURSES_SHOULD_WRITE_TO_DB === '1')
    }

    async coursePathExists(params: CommonParams): Promise<boolean> {
        return FileService.fileExists(`${FileService.getCoursePath(params)}`)
    }

    async renameCourseIdDirectories(params: CommonParams, newCourseId: string): Promise<Error | void> {
        await FileService.renameDirectory(
            FileService.getCoursePath(params),
            FileService.getCoursePath({ ...params, courseid: newCourseId }),
            false
        );

        await FileService.renameDirectory(
            FileService.getCourseTempPath(params),
            FileService.getCourseTempPath({ ...params, courseid: newCourseId }),
            false
        );
    }

    static async tryUpdateOne(passedData: { collection: any, filter: any, data: any, session: any }): Promise<any> {
        try {
            let updateResult = await passedData.collection.updateOne(passedData.filter, passedData.data, { session: passedData.session });
            return updateResult;
        } catch (error) {
            if (error.errorLabels && error.errorLabels.indexOf("UnknownTransactionCommitResult") >= 0) {
                console.log("UnknownTransactionCommitResult, retrying commit operation ...");
                await CourseService.tryUpdateOne(passedData);
            } else {
                console.log("Error during commit ...");
                throw error;
            }
        }
    }

    static async clearClassroomIDFromCourse(passedData: { clientCollection: any, session: any, instructorUsername: string, cid: string, classroomForeignID: number, results: ComplexResults }) {

        const returnCourse = await passedData.clientCollection.findOne({ "segments.foreign_id": passedData.classroomForeignID }, { projection: { segments: 1, 'instructor.username': 1, cid: 1 }, session: passedData.session });

        if (returnCourse && returnCourse.instructor.username !== passedData.instructorUsername) {
            if (returnCourse.cid !== passedData.cid) {
                // the new section is not only under a new instructor but also under a new CID.
                // this is very odd and should be notted but not necessarily illegal
                passedData.results.addLogEvent({
                    code: COURSE_ERROR_CODES.CLASSROOM_SWITCHED_CIDS,
                    description: `Classroom switch teachers AND cids ${passedData.instructorUsername}/${passedData.cid}/${returnCourse.cid}/${passedData.classroomForeignID}`,
                });

            }
            if (returnCourse.segments) {

                const indexToRemove = returnCourse.segments.findIndex(element => element.foreign_id === passedData.classroomForeignID);
                if (indexToRemove > -1) {


                    let update = {};
                    update['$unset'] = {}
                    update['$unset'].segments = {}
                    update['$unset'].segments[String(indexToRemove)] = 1

                    try {
                        const updateResult = await CourseService.tryUpdateOne({ collection: passedData.clientCollection, filter: { _id: returnCourse._id }, data: update, session: passedData.session })

                        if (updateResult.modifiedCount === 1) {
                            passedData.results.addLogEvent({
                                code: COURSE_ERROR_CODES.CLASSROOM_ID_REMOVED,
                                description: `Classroom ID removed from course ${returnCourse.instructor.username}/${returnCourse.cid}/${passedData.classroomForeignID}`,
                            });
                        }
                    } catch (error) {
                        passedData.results.addCriticalError({
                            code: COURSE_ERROR_CODES.ERROR_REMOVING_CLASSROOM_ID,
                            description: `Failed to remove classroom id from existing course ${passedData.instructorUsername}/${passedData.cid}/${passedData.classroomForeignID} - ${error}`,
                        });
                    }
                } else {
                    passedData.results.addCriticalError({
                        code: COURSE_ERROR_CODES.INDEX_TO_REMOVE_NOT_FOUND,
                        description: `Cound not find index to remove ${passedData.instructorUsername}/${passedData.cid}/${passedData.classroomForeignID}`,
                    });
                }
            }
        }
    }

    static async upsertCourse(passedData: {
        dbSelector: MdbSelector;
        course: MdbModifyCourseInterface;
        DataSource: "VSA" | "APP";
        skipFF?: boolean;
        existingResults: ComplexResults;
    }): Promise<ComplexResults> {
        let result: ComplexResults;
        let dataToWrtie: MdbModifyCourseInterface;

        let dbSelector: MdbSelector = passedData.dbSelector;
        let course: MdbModifyCourseInterface = passedData.course;
        let DataSource: "VSA" | "APP" = passedData.DataSource;
        let existingResults: ComplexResults = passedData.existingResults;

        if (existingResults) result = existingResults;
        else result = new ComplexResults();

        let courseDefaultValues = {
            av_tools_active: true,
            credit_hours: 3,
            timezone_offset_from_eastern: 0,
            enrollment_settings: {
                mode: "controlled",
                instructor_can_access: true,
                students_can_access: true,
            },
        };

        const tempclient = MongoDB.get();
        const mdb = tempclient.db(`${dbSelector.shellRoot}_${dbSelector.dir}`);

        const session = tempclient.startSession();
        const transactionOptions: TransactionOptions = {
            readPreference: "primary",
            readConcern: { level: "local" },
            writeConcern: { w: "majority" },
            // retryWrites : true
        };

        try {
            if (!course.cid) {
                result.addCriticalError(
                    {
                        code: COURSE_ERROR_CODES.CID_MISSING,
                        description: `CID Missing in course params`,
                    },
                    true
                );
                throw "CID Missing in course params";
            }
            if (!course.title) {
                result.addCriticalError(
                    {
                        code: COURSE_ERROR_CODES.TITLE_MISSING,
                        description: `Title Missing in course params ${course.cid}`,
                    },
                    true
                );
                throw `Title Missing in course params ${course.cid}`;
            }
            if (!course.instructor?.username) {
                result.addCriticalError({
                    code: COURSE_ERROR_CODES.USERNAME_MISSING,
                    description: `Instructor username missing in course params ${course.cid}`,
                }); // not a VSA error since this is basically impossible via VSA
                throw `Instructor username missing in course params ${course.cid}`;
            }
            await session.startTransaction(transactionOptions);

            const courseCollection = mdb.collection("courses");
            let needToAddSegmentLogItem = false;
            let courseAdded: boolean = false;
            if (DataSource === "VSA") {
                // first, check to see if the ClassroomId (segments.foreign_id) exits in a different course already.
                // this woould indicate that the course section has been moved to a new instructor. If we find one
                // clear out that segment array entry 


                await CourseService.clearClassroomIDFromCourse({ clientCollection: courseCollection, session: session, instructorUsername: course.instructor.username, cid: course.cid, classroomForeignID: course.segments[0].foreign_id, results: result })



                // see if the course already exists - look up by cid, techer
                const existingCourse = await courseCollection.findOne({ cid: course.cid, "instructor.username": course.instructor.username }, { projection: { gradebuilder: 0 }, session });
                if (existingCourse?._id) {
                    // there is an already an existing course - figure out if we need to
                    // and a foreign_id/segment or not. ALso, we will not update anything
                    // except the data passed in from VSA since everything else is set
                    // by Educator itself.

                    // make sure the new record is "newer" than the old. Checking
                    // for out of order messages here.

                    if (course.lastUpdatedFromVSA < existingCourse.lastUpdatedFromVSA) {
                        result.addCriticalError({
                            code: COURSE_ERROR_CODES.EVENT_OUT_OF_ORDER,
                            description: `Course package arived out of order (${course.lastUpdatedFromVSA.toString()})`,
                        });
                        throw `Course package arived out of order (${course.lastUpdatedFromVSA.toString()})`;
                    }

                    let updateData: any = {};
                    let courseSegemntData: any = {};
                    if (existingCourse.segments?.some((segment) => segment.foreign_id === course.segments[0].foreign_id)) {
                        // the foreign_id already exists - update everything else
                        delete course.segments;
                        updateData = {
                            $set: course,
                        };
                    } else {
                        // the foreign_id does not exist in the system - update everything and push the segment up
                        courseSegemntData = course.segments[0];
                        delete course.segments;
                        updateData = {
                            $set: course,
                            $push: {
                                segments: courseSegemntData,
                            },
                        };
                        needToAddSegmentLogItem = true;
                    }

                    let updateResult: any;
                    try {
                        // updateResult = await courseCollection.updateOne({ cid: course.cid, "instructor.username": course.instructor.username }, updateData, { session });
                        updateResult = await CourseService.tryUpdateOne({ collection: courseCollection, filter: { cid: course.cid, "instructor.username": course.instructor.username }, data: updateData, session: session })
                    } catch (error) {
                        result.addCriticalError({
                            code: COURSE_ERROR_CODES.INITIAL_UPDATE_FAILED,
                            description: `${course.cid} Initial course modified including CSID - ${error}`,
                        });
                        throw "Initial course record update failed";
                    }

                    // check to see if something actually changed, if it did make
                    // mkae note of it in the history
                    if (updateResult.modifiedCount === 1) {
                        let newHistory = {};
                        // if a segment was added make special note of that
                        if (needToAddSegmentLogItem) {
                            newHistory = {
                                date: new Date(),
                                action: `Course modified including CSID ${courseSegemntData.foreign_id} (segment ${courseSegemntData.segment}) added to course`,
                            };
                            result.dataChanged = true;

                            result.addLogEvent({
                                code: COURSE_ERROR_CODES.SEGMENT_ADDED,
                                description: `${course.cid} Course modified including CSID`,
                            });
                        } else {
                            newHistory = {
                                date: new Date(),
                                action: `Course modified from VSA`,
                            };

                            result.addLogEvent({
                                code: COURSE_ERROR_CODES.UPDATED,
                                description: `${course.cid} Course updated`,
                            });
                        }
                        let updateHistory = {
                            $push: {
                                history: newHistory,
                            },
                        };
                        try {
                            await CourseService.tryUpdateOne({ collection: courseCollection, filter: { cid: course.cid, "instructor.username": course.instructor.username }, data: updateHistory, session: session })
                        } catch (error) {
                            result.addCriticalError({
                                code: COURSE_ERROR_CODES.SECONDARY_UPDATE_FAILED,
                                description: `${course.cid} Secondary ourse record update failed - ${error}`,
                            });
                            throw "Secondary course record update failed";
                        }
                    } else if (updateResult.modifiedCount === 0) {
                        result.addLogEvent({
                            code: COURSE_ERROR_CODES.NOTHING_CHANGED_ON_UPDATE,
                        });
                    }
                } else {
                    // there is no existing course - add a new one

                    //add the deafult data to the data passed in
                    dataToWrtie = { ...course, ...courseDefaultValues };
                    dataToWrtie.history = [
                        {
                            date: new Date(),
                            action: `Course added from VSA ${dataToWrtie.segments[0].foreign_id} (segment ${dataToWrtie.segments[0].segment})`,
                        },
                    ];
                    let insertResult: any;
                    try {
                        insertResult = await courseCollection.insertOne(dataToWrtie, { session });
                        courseAdded = true;
                    } catch (error) {
                        console.log(dataToWrtie)
                        result.addCriticalError({
                            code: COURSE_ERROR_CODES.BAD_INSERT,
                            description: `${course.cid} Course record insert failed ${error}`,
                        });
                        throw `${course.cid} Course record insert failed ${error}`;
                    }
                    if (insertResult.insertedCount > 0) {
                        result.addLogEvent({
                            code: COURSE_ERROR_CODES.GOOD_INSERT,
                            description: `${dataToWrtie.cid} Course record inserted successfully`,
                        });
                        result.dataChanged = true;
                        result.newRecordAdded = true;

                    } else {
                        result.addCriticalError({
                            code: COURSE_ERROR_CODES.BAD_INSERT,
                            description: `${dataToWrtie.cid} Course record insert failed - unexpected insert count`,
                        });
                        throw "Bad insert - unexpected insert count";
                    }
                }
                if (result.successful) {
                    if (courseAdded) {
                        // if the course was actually added and
                        // nothing went wrong we add it to the flat file as well
                        if (!passedData.skipFF) {
                            await legacyFFService.formCourse(dbSelector, dataToWrtie, "VSA", result);
                            if (!result.successful) throw "Course FF Errors";

                            let syncCommand: string = `${process.env.PATH_TO_SUDO} -u root -E ${process.env.INT_SYNC_APP} ${process.env.FLVS840_NETAPP} content master${dataToWrtie.cid} `;
                            syncCommand += `master${dataToWrtie.cid} ${dbSelector.shellRoot} ${dbSelector.dir} ${dataToWrtie.instructor.username} ${dataToWrtie.cid} 1 0 0`;
                            const execResult = await exec(syncCommand);
                            existingResults.addLogEvent({ code: COURSE_ERROR_CODES.COPY_FROM_MASTER_ATTEMPTED, description: `${syncCommand} :: ${execResult.stdout} - ${execResult.stderr}` });
                        }
                    }
                    await CourseService.commitWithRetry(session);
                }
            } else if (DataSource === "APP") {


                let appCourseData: MdbModifyCourseInterface = <MdbModifyCourseInterface>passedData.course;
                let savedCourseUpdateData: MdbModifyCourseInterface = _.cloneDeep(appCourseData);


                try {
                    const insertResult = await courseCollection.insertOne(appCourseData);
                    if (insertResult.insertedCount > 0) {

                        const filter = {
                            'instructor.username': appCourseData.instructor.username,
                            'cid': appCourseData.cid,
                        }

                        const newHistory: MdbHistoryInterface = {
                            date: new Date(),
                            action: `Added Course through app`,
                        };
                        await courseCollection.updateOne(filter, { $push: { history: newHistory, } });

                        result.addLogEvent({
                            code: COURSE_ERROR_CODES.COURSE_ADDED_MANUALLY,
                        });
                    }

                } catch (error) {
                    if (error.code === 11000) {
                        result.addLogEvent({
                            description: "Course already exists - updating existing Course",
                        });

                        const filter = {
                            'instructor.username': savedCourseUpdateData.instructor.username,
                            'cid': savedCourseUpdateData.cid,
                        }

                        delete savedCourseUpdateData.instructor;
                        delete savedCourseUpdateData.cid;
                        delete savedCourseUpdateData.history;

                        try {

                            const updateResult = await courseCollection.updateOne(filter, { '$set': savedCourseUpdateData })
                            if (updateResult.modifiedCount === 1) {
                                result.addLogEvent({
                                    description: "Course record updated",
                                });


                            } else {
                                result.addLogEvent({
                                    description: "No changes - Course was not updated",
                                });

                            }

                        } catch (updateErr) {
                            console.log(updateErr)
                            result.addCriticalError({
                                code: COURSE_ERROR_CODES.ERROR_ADDING_COURSE_MANUALLY,
                            });
                        }

                    }
                }
                if (result.successful && !passedData.skipFF) {
                    result.dataChanged = true;
                    await legacyFFService.formCourse(dbSelector, appCourseData, "APP", result);

                }

            }
        } catch (error) {
            if (session) {
                console.log(error);
                await session.abortTransaction();
                result.addLogEvent({
                    code: COURSE_ERROR_CODES.TRANSACTION_ABORTED,
                });
            }
            console.log(error);
        } finally {
            if (session) {
                await session.endSession();
            }
        }

        return result;
    }

    async getGlobalCourseList(params: CommonParams): Promise<GlobalCourseListEntry[]> {
        let courses: string[] = await FileService.readLines(
            `${FileService.getEducatorPath(params)}/courselist.txt`,
            undefined,
            false
        );
        return courses.map((course) => {
            const [
                lastName,
                firstName,
                title,
                username,
                school,
                courseTitle,
                courseId,
                deprecatedCourseId,
                courseName,
                deprecatedCourseName
            ] = course.split('*');

            return {
                courseId,
                courseName,
                courseTitle,
                firstName,
                lastName,
                title,
                username,
                school,
                deprecatedCourseId,
                deprecatedCourseName
            };
        });
    }

    async setGlobalCourseList(params: CommonParams, courseList: GlobalCourseListEntry[]): Promise<Error | void> {
        const courses = courseList.map((course) => {
            const {
                courseId,
                courseName,
                courseTitle,
                firstName,
                lastName,
                title,
                username,
                school,
                deprecatedCourseId,
                deprecatedCourseName
            } = course;

            return [
                lastName,
                firstName,
                title,
                username,
                school,
                ...(typeof courseTitle !== 'undefined' ? [courseTitle] : []),
                ...(typeof courseId !== 'undefined' ? [courseId] : []),
                ...(typeof deprecatedCourseId !== 'undefined' ? [deprecatedCourseId] : []),
                ...(typeof courseName !== 'undefined' ? [courseName] : []),
                ...(typeof deprecatedCourseName !== 'undefined' ? [deprecatedCourseName] : [])
            ].join('*');
        });

        await FileService.writeFile(`${FileService.getEducatorPath(params)}/courselist.txt`, courses.join('\n') + '\n', { mode: 0o660 });
    }

    async getCourse(params: CommonParams): Promise<Course> {
        const course = new Course();
        try {
            await course.init(params);
        } catch (e) {
            throw e;
        }

        return course;
    }

    async getCourseList(params: CommonParams, crsListParams: CourseListParams = {}): Promise<CourseListEntry[]> {
        const courseListParams = {
            onlyArchivedCourses: false,
            includeArchivedCourses: false,
            includeInstructorCourseList: true,
            includeStudentAndTaCourses: true,
            includeRosterSize: false,
            includeCourseWorkload: false,
            includedCoursesWithNoStudentAccess: true,
            ...crsListParams
        };

        // Arrays to store our getCourse Promises
        const instructorCoursePromises: Promise<Course>[] = [];
        const studentCoursePromises: Promise<Course>[] = [];
        const mailboxDirectory = FileService.getMailboxPath(params);

        // Get our list of courses where this user is a Teacher
        let instructorCourseList = [];
        let studentCourseList = [];
        try {
            if (courseListParams.includeInstructorCourseList === true) {
                instructorCourseList = await FileService.readLines(`${mailboxDirectory}/instructorlist.txt`);
            }
        } catch (e) { }

        try {
            if (courseListParams.includeStudentAndTaCourses === true) {
                studentCourseList = await FileService.readLines(`${mailboxDirectory}/courselist.txt`);
            }
        } catch (e) { }

        instructorCourseList.filter(Boolean).forEach((courseid) => {
            let p: CommonParams = {
                ...params,
                courseid: courseid,
                instructor: params.username,
            };

            instructorCoursePromises.push(this.getCourse(p));
        });

        // Get our list of courses where this user is a student or ta
        studentCourseList.filter(Boolean).forEach((line) => {
            let [instructor, courseid] = line.split("*");

            let p: CommonParams = {
                ...params,
                courseid: courseid,
                instructor,
            };

            studentCoursePromises.push(this.getCourse(p));
        });

        // Send our our promises and resolve them
        let instructorCourses = [];

        for (let promise of instructorCoursePromises) {
            try {
                instructorCourses.push(await promise);
            } catch (e) {
                console.log(e);
                continue;
            }
        }

        let studentCourses = [];

        for (let promise of studentCoursePromises) {
            try {
                studentCourses.push(await promise);
            } catch (e) {
                console.log(e);
                continue;
            }
        }

        let order = 0;
        instructorCourses.forEach((course) => {
            course.order = order++;
        });

        studentCourses.forEach((course) => {
            course.order = order++;
        });

        if (courseListParams.onlyArchivedCourses === true) {
            instructorCourses = instructorCourses.filter(course => course.isArchived());
            studentCourses = studentCourses.filter(course => course.isArchived());
        }
        // Filter out any courses that may be archived
        else if (courseListParams.includeArchivedCourses === false) {
            instructorCourses = instructorCourses.filter(course => !course.isArchived());
            studentCourses = studentCourses.filter(course => !course.isArchived());
        }

        if (courseListParams.includedCoursesWithNoStudentAccess === false) {
            studentCourses = studentCourses.filter(course => course.isStudentAccessOn());
        }

        let courseList: CourseListEntry[] = [];

        instructorCourses.forEach((course) => {
            courseList.push({
                courseid: String(course.courseId),
                courseTitle: course.courseTitle,
                instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
                instructorUsername: course.instructor.username,
                typeOfUser: Roles.Teacher,
                order: course.order,
                isArchived: course.isArchived(),
                isStudentAccessOn: course.isStudentAccessOn()
            });
        });

        studentCourses.forEach((course) => {
            courseList.push({
                courseid: String(course.courseId),
                courseTitle: course.courseTitle,
                instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
                instructorUsername: course.instructor.username,
                typeOfUser: course.isUserTA(params.username) ? Roles.Ta : Roles.Student,
                order: course.order,
                isArchived: course.isArchived(),
                isStudentAccessOn: course.isStudentAccessOn()
            });
        });

        if (crsListParams.typesOfUser) {
            courseList = courseList.filter((course) => crsListParams.typesOfUser.includes(course.typeOfUser));
        }

        if (crsListParams.includeRosterSize) {
            for (let i = 0; i < courseList.length; i++) {
                const rosterSize = await getRosterSize({
                    shellroot: params.shellroot,
                    dir: params.dir,
                    instructor: courseList[i].instructorUsername,
                    courseid: courseList[i].courseid
                });

                courseList[i].rosterSize = rosterSize;
            }
        }

        if (crsListParams.includeCourseWorkload) {
            for (let i = 0; i < courseList.length; i++) {
                // if user is a ta, get instructor's workload instead
                const courseWorkload = await (new WorkloadService()).getWorkloadCount({
                    ...params,
                    username: courseList[i].typeOfUser === Roles.Ta
                        ? courseList[i].instructorUsername
                        : params.username,
                    instructor: courseList[i].instructorUsername,
                    courseid: courseList[i].courseid
                });

                courseList[i].courseWorkload = courseWorkload;
            }
        }

        return courseList;
    }

    async getInstructorEntireCourseList(params: CommonParams): Promise<CourseListEntry[]> {
        return this.getCourseList(params, {
            includeArchivedCourses: true,
            includeInstructorCourseList: true,
            includeStudentAndTaCourses: false
        });
    }

    async getStudentAndTaEntireCourseList(params: CommonParams): Promise<CourseListEntry[]> {
        return this.getCourseList(params, {
            includeArchivedCourses: true,
            includeInstructorCourseList: false,
            includeStudentAndTaCourses: true
        });
    }

    async getDefaultCourse(params: CommonParams): Promise<string> {
        const educatorPath = FileService.getEducatorPath(params);
        const dirs: string[] = await FileService.readdir(`${educatorPath}/${params.instructor}`);
        for (const directory of dirs) {
            if (await FileService.fileExists(`${educatorPath}/${params.instructor}/${directory}/default.txt`)) {
                return directory;
            }
        }

        return undefined
    }

    async setDefaultCourse(params: CommonParams, defaultCourse: string): Promise<Error | void> {
        const educatorPath = FileService.getEducatorPath(params);
        const dirs: string[] = await FileService.readdir(`${educatorPath}/${params.instructor}`);
        for (const directory of dirs) {
            if (await FileService.fileExists(`${educatorPath}/${params.instructor}/${directory}/default.txt`)) {
                await FileService.deleteFile(`${educatorPath}/${params.instructor}/${directory}/default.txt`);
            }
        }
        // set the new default course
        if (defaultCourse !== null) {
            await FileService.writeFile(`${educatorPath}/${params.instructor}/${defaultCourse}/default.txt`, defaultCourse, { mode: 0o660 });
        }
    }


    async deleteDefaultCourse(params: CommonParams): Promise<Error | void> {
        const educatorPath = FileService.getEducatorPath(params);
        const defaultCourse = await this.getDefaultCourse(params);
        await FileService.deleteFile(`${educatorPath}/${params.instructor}/${defaultCourse}/default.txt`);
    }




    async setCourseList(
        params: CommonParams,
        isInstructor: boolean,
        courses: { courseid: string, instructorUsername?: string }[]
    ): Promise<Error | void> {
        let courseListFile: string = 'courselist.txt';
        let courseList: string[] = courses.map((course) => `${course.instructorUsername}*${course.courseid}`);

        if (isInstructor) {
            courseListFile = 'instructorlist.txt';
            courseList = courses.map((course) => course.courseid);
        }

        await FileService.writeFile(`${FileService.getMailboxPath(params)}/${courseListFile}`, courseList.join('\n') + '\n');
    }

    async isCourseArchived(params: CommonParams): Promise<boolean> {
        return await FileService.fileExists(`${FileService.getCoursePath(params)}/archive.txt`);
    }

    async setCourseArchived(params: CommonParams, archive: boolean): Promise<Error | void> {
        if (archive === true) {
            await FileService.writeFile(`${FileService.getCoursePath(params)}/archive.txt`, '', { mode: 0o660 });
        } else {
            await FileService.deleteFile(`${FileService.getCoursePath(params)}/archive.txt`);
        }
    }

    async getCourseName(params: CommonParams) {
        let fileData = await FileService.getFileContents(`${FileService.getCoursePath(params)}/history.txt`);
        return fileData.match(/Course\s+name:\s+(.+)\n/)[1];
    }

    async getCourseStudentAccess(params: CommonParams): Promise<boolean> {
        let courseActive = true;
        const courseDirectory = FileService.getCoursePath(params);

        try {
            const courseStatus = await FileService.getFileContents(`/${courseDirectory}/studentaccess.txt`);

            if (courseStatus.toLowerCase() === "off") {
                courseActive = false;
            }
        } catch (err) {
            // Catch block intentionally left blank. This file may not exist and we don't want to generate errors for that condition.
        }

        return Promise.resolve(courseActive);
    }

    async setCourseStudentAccess(status: string, params: CommonParams): Promise<Error | void> {
        const courseDirectory = FileService.getCoursePath(params);

        try {
            await FileService.writeFile(`/${courseDirectory}/studentaccess.txt`, status, { mode: 0o660 });
        } catch (err) {
            return Promise.reject(err);
        }

        return Promise.resolve();
    }

    async deleteStudentIPList(params: CommonParams): Promise<Error | void> {
        await FileService.deleteFile(`${FileService.getCoursePath(params)}/student.ip`);
    }

    async getCourseTeacherAccess(params: CommonParams): Promise<boolean> {
        let courseActive = true
        const courseDirectory = FileService.getCoursePath(params)

        try {
            const courseStatus = await FileService.getFileContents(`/${courseDirectory}/instructoraccess.txt`)

            if (courseStatus.toLowerCase() === 'off') {
                courseActive = false
            }
        }
        catch (err) {
            // Only log if the error isn't "File not found".
            if (err?.code !== 'ENOENT') {
                Logger.error(err)
            }
        }

        return Promise.resolve(courseActive)
    }

    async getDBCourse(inputParams: { foreignID?: number; _id?: any; courseInfo?: { username: string; cid: string }; dbSelector: MdbSelector; projection?: any }): Promise<MdbModifyCourseInterface> {
        let returnCourse: MdbModifyCourseInterface;

        const tempclient = MongoDB.get();
        const mdb = tempclient.db(`${inputParams.dbSelector.shellRoot}_${inputParams.dbSelector.dir}`);
        const courseCollection = mdb.collection("courses");

        if (inputParams.courseInfo) {
            returnCourse = await courseCollection.findOne({ cid: inputParams.courseInfo.cid, "instructor.username": inputParams.courseInfo.username }, { projection: inputParams.projection });
        } else if (inputParams._id) {
            returnCourse = await courseCollection.findOne({ _id: inputParams._id }, { projection: inputParams.projection });
        } else if (inputParams.foreignID) {
            //db.<collectionName>.find({groups:{ "id" : 152, "name" : "hi" }})
            returnCourse = await courseCollection.findOne({ "segments.foreign_id": inputParams.foreignID }, { projection: inputParams.projection });
        }

        return returnCourse;
    }


    async getSessionCountAndLength(logPath: string) {
        let logContents: string[] = []
        let sessions = 0
        let sesssionSeconds = 0

        try {
            logContents = await FileService.readLines(logPath)
        }
        catch (err) {
            // Catch block intentionally left blank. This file may not exist and we don't want to generate errors for that condition.
        }

        logContents.forEach((entry, index) => {
            const [action, unixTimeString] = entry.split('*')
            const unixTime = parseInt(unixTimeString, 10)

            if (action === 'In') {
                const nextLine = logContents[index + 1]

                if (nextLine) {
                    const [nextAction, nextTimeString] = nextLine.split('*')

                    if (nextAction === 'Out') {
                        const nextTime = parseInt(nextTimeString, 10)
                        sesssionSeconds += nextTime - unixTime
                    } else {
                        sesssionSeconds += TimeConstants.fiveMinutesInSeconds
                    }
                }

                sessions++
            }
        })

        return { sessions: sessions, sesssionSeconds: sesssionSeconds }
    }

    async getEnrollmentType(params: CommonParams): Promise<string> {
        return FileService.getFileContents(`${FileService.getCoursePath(params)}/enrollment.txt`, undefined, false);
    }

    async setEnrollmentType(params: CommonParams, enrollmentType: string): Promise<void> {
        return FileService.writeFile(`${FileService.getCoursePath(params)}/enrollment.txt`, enrollmentType, { mode: 0o660 });
    }

    async getInstructorLabel(params: CommonParams): Promise<string> {
        let instructorLabel;

        try {
            instructorLabel = await FileService.getFileContents(`${FileService.getCoursePath(params)}/instructorLabel.txt`);
        } catch (err) {
            if (err?.code === 'ENOENT') {
                // default to Instructor if file isn't found
                instructorLabel = 'Instructor';
            } else {
                // Only log if the error isn't "File not found".
                Logger.error(err);
            }
        }

        return instructorLabel;
    }

    async setInstructorLabel(params: CommonParams, instructorLabel: string): Promise<Error | void> {
        if (instructorLabel === 'Instructor') {
            await FileService.deleteFile(`${FileService.getCoursePath(params)}/instructorLabel.txt`);
        } else {
            await FileService.writeFile(`${FileService.getCoursePath(params)}/instructorLabel.txt`, instructorLabel, { mode: 0o660 });
        }
    }

    async getTimeZone(params: CommonParams): Promise<string> {
        return FileService.getFileContents(
            `${FileService.getCoursePath(params)}/timezone.txt`,
            undefined,
            false
        );
    }

    async setTimeZone(params: CommonParams, timeZone: string): Promise<void> {
        return FileService.writeFile(`${FileService.getCoursePath(params)}/timezone.txt`, timeZone, { mode: 0o660 });
    }

    async getPrerequisites(params: CommonParams): Promise<string[] | undefined> {
        return FileService.readLines(`${FileService.getCoursePath(params)}/prerequisites.txt`, false, false);
    }

    async setPrerequisites(params: CommonParams, prerequisites: string[]): Promise<void> {
        return FileService.writeFile(
            `${FileService.getCoursePath(params)}/prerequisites.txt`,
            prerequisites.join('\n'),
            { mode: 0o660 }
        );
    }

    async getRegistrationDoor(params: CommonParams): Promise<string> {
        let registrationDoor = await FileService.getFileContents(
            `${FileService.getCoursePath(params)}/registrationdoor.txt`,
            undefined,
            false
        );
        if (registrationDoor?.toLowerCase() != 'closed') {
            registrationDoor = 'Open';
        }

        return registrationDoor;
    }

    async setRegistrationDoor(params: CommonParams, registrationDoor: string): Promise<Error | void> {
        await FileService.writeFile(
            `${FileService.getCoursePath(params)}/registrationdoor.txt`,
            registrationDoor,
            { mode: 0o660 }
        );
    }

    async getCourseTimeLimit(params: CommonParams): Promise<string | undefined> {
        return FileService.getFileContents(
            `${FileService.getCoursePath(params)}/timelimit.txt`,
            undefined,
            false
        );
    }

    async setCourseTimeLimit(params: CommonParams, timeLimit: string): Promise<void | undefined> {
        return FileService.writeFile(`${FileService.getCoursePath(params)}/timelimit.txt`, timeLimit, { mode: 0o660 });
    }

    async deleteCourseTimeLimit(params: CommonParams): Promise<string | undefined> {
        return FileService.deleteFile(`${FileService.getCoursePath(params)}/timelimit.txt`);
    }

    async setEmail(params: CommonParams, email: string): Promise<void | undefined> {
        return FileService.writeFile(`${FileService.getCoursePath(params)}/emailaddress.txt`, email, { mode: 0o660 });
    }

    async getStudentAccess(params: CommonParams): Promise<string> {
        let studentAccess = await FileService.getFileContents(
            `${FileService.getCoursePath(params)}/studentaccess.txt`,
            undefined,
            false
        );
        if (studentAccess === '') {
            studentAccess = 'On';
        }

        return studentAccess;
    }

    async getIPAddressesRestrictOrAllowSettings(params: CommonParams): Promise<IPAddressesRestrictOrAllowSettings> {
        let restrictOrAllow, ipAddresses;
        const ipAddressesRestrictOrAllowSettings = await FileService.readLines(
            `${FileService.getCoursePath(params)}/ipAddresses.txt`,
            undefined,
            false
        );

        if (ipAddressesRestrictOrAllowSettings) {
            [restrictOrAllow, ...ipAddresses] = ipAddressesRestrictOrAllowSettings;
        }

        return {
            ipAddresses,
            restrictOrAllow
        };
    }

    async getAudioVideoRecordingCapabilities(params: CommonParams): Promise<boolean> {
        return FileService.fileExists(`${FileService.getCoursePath(params)}/audioVideo.txt`);
    }

    async setAudioVideoRecordingCapabilities(params: CommonParams, activate: boolean): Promise<Error | void> {
        if (activate === true) {
            await FileService.writeFile(
                `${FileService.getCoursePath(params)}/audioVideo.txt`,
                String(UtilitiesService.getEpochTime()),
                { mode: 0o660 }
            );
        } else {
            await FileService.deleteFile(`${FileService.getCoursePath(params)}/audioVideo.txt`);
        }
    }

    async getCourseHistory(params: CommonParams): Promise<CourseHistory> {
        const courseHistory = await FileService.readLines(
            `${FileService.getCoursePath(params)}/history.txt`,
            undefined,
            false
        );

        const courseHistoryMap = courseHistory.reduce((acc, cur) => {
            if (cur.startsWith('Course was formed ')) {
                acc['courseFormed'] = new Date(cur.replace('Course was formed ', ''));
                return acc;
            }

            const firstColonIndex = cur.indexOf(':');
            acc[cur.substring(0, firstColonIndex)] = cur.substring(firstColonIndex + 2);
            return acc;
        }, {} as any);

        const {
            courseFormed,
            'Username': username,
            'Name': name,
            'School': school,
            'Course name': courseName,
            'Course title': courseTitle,
            'E-mail': email,
            'Password': password
        } = courseHistoryMap;

        return {
            courseFormed,
            courseName,
            courseTitle,
            email,
            name,
            school,
            username,
            password
        };
    }

    async setCourseHistory(params: CommonParams, courseHistory: CourseHistory): Promise<Error | void> {
        const {
            username,
            name,
            school,
            courseName,
            courseTitle,
            password,
            email,
            syllabusLastModified,
            phoneNumber
        } = courseHistory;

        const timeZoneOffset = await (new CourseService()).getTimeZone(params);
        await FileService.writeFile(`${FileService.getCoursePath(params)}/history.txt`, [
            `Username: ${username}`,
            `Name: ${name}`,
            `School: ${school}`,
            `Course name: ${courseName}`,
            `Course title: ${courseTitle}`,
            `Password: ${password}`,
            `E-mail: ${email}`,
            `Syllabus was last modified ${syllabusLastModified ?? UtilitiesService.getLocalTime(timeZoneOffset)}`,
            ...(phoneNumber ? [phoneNumber] : [])
        ].join('\n') + '\n', { mode: 0o660 });
    }

    async getCourseUsageLog(params: CommonParams): Promise<CourseUsageLogEntry[]> {
        let courseUsageLogContents = await FileService.readLines(
            `${FileService.getCoursePath(params)}/log.txt`,
            undefined,
            false
        );

        const courseUsageLog = courseUsageLogContents.map((log) => {
            const [status, time, ip] = log.split('*');
            return { status, time, ip };
        });

        const logs = [];
        for (const [i, courseUsageLogItem] of courseUsageLog.entries()) {
            if (courseUsageLogItem.status?.toLowerCase() === 'out') {
                continue;
            }

            let signInTime = 'Session Reconnected';
            let signOutTime = 'Session Expired';
            let ipAddress = courseUsageLogItem.ip;

            if (UtilitiesService.isValidTimestamp(courseUsageLogItem.time)) {
                signInTime = courseUsageLogItem.time;
            }

            if (UtilitiesService.isValidTimestamp(courseUsageLog[i + 1]?.time)) {
                signOutTime = courseUsageLog[i + 1].time;
            }

            // user is marked as signed in if they recently signed in (within the past 1 hour and 1 minute) and this
            // is the last log entry
            if (i === courseUsageLog.length - 1 && UtilitiesService.getEpochTime() - Number(signInTime) < 3660) {
                signOutTime = 'Signed In';
            }

            logs.push({
                signInTime,
                signOutTime,
                ipAddress
            });
        }

        return [...logs].reverse();
    }

    async updateCourseInDB(
        params: CommonParams,
        courseInformation: CourseInformation | undefined,
        studentEnrollment: CourseStudentEnrollment | undefined
    ) {
        const studentAccess = studentEnrollment?.studentAccess;
        const courseTimeLimit = studentEnrollment?.courseTimeLimit;
        const creditHours = courseInformation?.creditHours;
        const courseTimeZone = courseInformation?.courseTimeZone;
        const registrationDoor = studentEnrollment?.registrationDoor;
        const enrollmentType = studentEnrollment?.enrollmentType;
        const courseName = courseInformation?.courseName;
        const courseId = courseInformation?.courseId
            ?.toLowerCase()
            ?.replace(/\s/g, '')
            ?.replace(/\*/g, '');

        await MongoDB.get()
            .db(`${params.shellroot}_${params.dir}`)
            .collection('courses')
            .updateOne({
                'instructor.username': params.instructor,
                cid: params.courseid
            }, {
                $set: {
                    ...(typeof creditHours !== 'undefined' && { credit_hours: Number(creditHours) }),
                    ...(typeof courseId !== 'undefined' && { cid: courseId }),
                    ...(typeof courseName !== 'undefined' && { title: courseName }),
                    ...(typeof courseTimeZone !== 'undefined' && { timezone_offset_from_eastern: Number(courseTimeZone) }),
                    ...(typeof registrationDoor !== 'undefined' && {
                        'enrollment_settings.registration_door': registrationDoor?.toLowerCase()
                    }),
                    ...(typeof enrollmentType !== 'undefined' && {
                        'enrollment_settings.mode': enrollmentType?.toLowerCase()
                    }),
                    ...(typeof courseTimeLimit !== 'undefined' && {
                        'enrollment_settings.course_length': Number(courseTimeLimit)
                    }),
                    ...(typeof studentAccess !== 'undefined' && {
                        'enrollment_settings.students_can_access': studentAccess === 'On'
                    })
                }
            });
    }

    clearCourseCache = async (params: CommonParams) => {
        const { shellroot, dir, instructor, courseid } = params;
        await MemcachedService.delete(
            `${CacheNamespaces.MDB2}:get_course_${shellroot}_${dir}_${instructor}_${courseid}instr_stu1`,
            true
        );
    }

    async getCourseWidgets(params: CommonParams): Promise<any> {
        const dbSelector: MdbSelector = await UtilitiesService.lookupFranchise(params.shellroot, params.dir);
        const courseWidgets: MdbModifyCourseInterface = await this.getDBCourse({
            courseInfo: {
                username: params.instructor,
                cid: params.courseid,
            },
            dbSelector: dbSelector,
            projection: { widgets: 1 },
        });

        return courseWidgets;
    }

    async setCourseWidgets(params: CommonParams, courseWidgets: WidgetPreset): Promise<MongoUpdateStatus> {
        let returnStatus: MongoUpdateStatus = MongoUpdateStatus.Success;
        const result = await MongoDB.get().db(`${params.shellroot}_${params.dir}`).collection('courses')
            .updateOne({
                'instructor.username': params.instructor,
                cid: params.courseid
            },
                {
                    $set: {
                        widgets: courseWidgets,
                    }
                });

        if (result.matchedCount === 0) {
            returnStatus = MongoUpdateStatus.NotFound;
        }

        return returnStatus;
    }

    async deleteCourseWidgets(params: CommonParams): Promise<MongoUpdateStatus> {
        let returnStatus: MongoUpdateStatus = MongoUpdateStatus.Success;
        const result = await MongoDB.get().db(`${params.shellroot}_${params.dir}`).collection('courses')
            .updateOne({
                'instructor.username': params.instructor,
                cid: params.courseid
            },
                {
                    $unset: {
                        widgets: "",
                    }
                });

        if (result.matchedCount === 0) {
            returnStatus = MongoUpdateStatus.NotFound;
        }

        return returnStatus;
    }
}

export interface CourseListEntry {
    courseid: string;
    courseTitle: string;
    instructorName: string;
    typeOfUser: Roles;
    instructorUsername: string;
    rosterSize?: number,
    courseWorkload?: number
    isArchived?: boolean,
    order?: number
    isStudentAccessOn?: boolean
}

export interface GlobalCourseListEntry {
    title: string;
    lastName: string;
    firstName: string;
    username: string;
    school: string;
    courseTitle: string;
    courseId: string;
    courseName: string;
    deprecatedCourseId?: string;
    deprecatedCourseName?: string;
}

export interface IPAddressesRestrictOrAllowSettings {
    ipAddresses?: string[];
    restrictOrAllow?: string;
};

export interface CourseUsageLogEntry {
    signInTime: string;
    signOutTime: string;
    ipAddress?: string;
};
