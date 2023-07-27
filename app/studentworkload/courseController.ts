import { Request, Response } from "express";
import { 
    CommonParams, 
    getRoster,
    Roles,
    UserService, EnrollmentManager,
    CourseSettings,
    SyllabusService, Syllabus,
    CourseService, GlobalCourseListEntry, CourseMeetingTimeInterval,
    CourseHistory, CourseMeetingTimesService, HasRole, AllowMultipleLoginsTypes, FranchiseConfigService
} from '@educator-ng/common';
import { UserObjectService } from 'libs/common/src/lib/services/user-object.service';

export class CourseSettingsController {

    async getCourseSettings(requestData: CommonParams) {
        console.log("getting ocurse settings");
        const franchiseConfig = await (new FranchiseConfigService()).getFranchiseConfig(requestData);

        const courseService = new CourseService();
        const syllabusService = new SyllabusService();
        const courseHistory: CourseHistory = await courseService.getCourseHistory(requestData);
        let courseTimeLimit: string | undefined;
        if (franchiseConfig?.course_settings?.student_enrollment?.course_length?.visible === true
            && franchiseConfig?.course_settings?.student_enrollment?.visible === true) {
            courseTimeLimit = await courseService.getCourseTimeLimit(requestData);
        }
        const enrollmentType: string = await courseService.getEnrollmentType(requestData);

        const courseMeetingTimes: CourseMeetingTimeInterval[] | undefined = await (new CourseMeetingTimesService())
            .getMeetingTimes(requestData, true);
        const prerequisites: string[] | undefined = await courseService.getPrerequisites(requestData);
        let registrationDoor: string;
        if (franchiseConfig?.course_settings?.student_enrollment?.registration_door?.visible === true
            && franchiseConfig?.course_settings?.student_enrollment?.visible === true) {
            registrationDoor = await courseService.getRegistrationDoor(requestData);
        }
        const studentAccess: string = await courseService.getStudentAccess(requestData);
        const syllabus: Syllabus = await syllabusService.getSyllabus(requestData);
        const courseTimeZone: string = await courseService.getTimeZone(requestData);
        const activateAudioVideo: boolean = await courseService
            .getAudioVideoRecordingCapabilities(requestData);

        const userService = new UserService();
        const enrollmentManager: EnrollmentManager = await userService.getEnrollmentManager(requestData);

        let noCrypt: AllowMultipleLoginsTypes;
        if (franchiseConfig?.course_settings?.security?.allow_multiple_logins?.visible === true
            && franchiseConfig?.course_settings?.security?.visible === true) {
                noCrypt = await userService.getNoCrypt(requestData);
        }

        const courseSettings: CourseSettings = {
            audioVideo: {
                activateAudioVideo
            },
            courseInformation: {
                courseId: courseHistory.courseTitle,
                courseName: courseHistory.courseName,
                courseTimeZone,
                creditHours: syllabus.credits,
                prerequisites
            },
            courseMeetingTimes,
            enrollmentManager,
            security: {
                allowMultipleLogins: noCrypt
            },
            studentEnrollment: {
                courseTimeLimit,
                enrollmentType,
                registrationDoor,
                studentAccess
            }
        };

        return { courseSettings }
    }

    async patchCourseSettings(requestData: CommonParams, courseSettings: CourseSettings) {
        const activateAudioVideo = courseSettings?.audioVideo?.activateAudioVideo;
        const courseMeetingTimes: CourseMeetingTimeInterval[] = courseSettings?.courseMeetingTimes;
        const studentAccess = courseSettings?.studentEnrollment?.studentAccess;
        const courseTimeLimit = courseSettings?.studentEnrollment?.courseTimeLimit;
        const creditHours = courseSettings?.courseInformation?.creditHours;
        const courseTimeZone = courseSettings?.courseInformation?.courseTimeZone;
        const registrationDoor = courseSettings?.studentEnrollment?.registrationDoor;
        const enrollmentType = courseSettings?.studentEnrollment?.enrollmentType;
        const courseName = courseSettings?.courseInformation?.courseName;
        const courseId = courseSettings?.courseInformation?.courseId
            ?.toLowerCase()
            ?.replace(/\s/g,'')
            ?.replace(/\*/g,'');
        const allowMultipleLogins = courseSettings?.security?.allowMultipleLogins;

        const requestDataForInstructor = {
            ...requestData,
            username: requestData.instructor
        };

        const courseService = new CourseService();
        const syllabusService = new SyllabusService();
        const userObjectService = new UserObjectService();
        const userService = new UserService();

        // if user tries to change any of these, make sure they have permission
        if (typeof courseTimeLimit !== 'undefined'
            || typeof registrationDoor !== 'undefined'
            || typeof allowMultipleLogins !== 'undefined'
        ) {
            const franchiseConfig = await (new FranchiseConfigService()).getFranchiseConfig(requestData);

            if (typeof allowMultipleLogins !== 'undefined' 
            && (franchiseConfig?.course_settings?.security?.allow_multiple_logins?.enabled === false 
                || franchiseConfig?.course_settings?.security?.allow_multiple_logins?.visible === false 
                || franchiseConfig?.course_settings?.security?.visible === false)) {
                throw new Error("You can't change allow multiple logins");
            }

            if (typeof courseTimeLimit !== 'undefined' 
            && (franchiseConfig?.course_settings?.student_enrollment?.course_length?.enabled === false
                || franchiseConfig?.course_settings?.student_enrollment?.course_length?.visible === false 
                || franchiseConfig?.course_settings?.student_enrollment?.visible === false)) {
                throw new Error("You can't change course length");
            }

            if (typeof registrationDoor !== 'undefined' 
            && (franchiseConfig?.course_settings?.student_enrollment?.registration_door?.enabled === false
                || franchiseConfig?.course_settings?.student_enrollment?.registration_door?.visible === false
                || franchiseConfig?.course_settings?.student_enrollment?.visible === false)) {
                throw new Error("You can't change registration door");
            }
        }

        const enrollmentManager: EnrollmentManager = await userService.getEnrollmentManager(
            requestData
        );

        if (enrollmentManager.instructorsChangeCourseIds?.toLowerCase() === 'no' && typeof courseId !== 'undefined') {
            throw new Error('You don\'t have permission to change course id');
        }

        if (enrollmentManager.instructorsChangeEnrollmentOptions?.toLowerCase() === 'no' && typeof enrollmentType !== 'undefined') {
            throw new Error('You don\'t have permission to change enrollment type');
        }

        if (enrollmentManager.instructorsChangeEnrollmentOptions?.toLowerCase() === 'no' && typeof enrollmentType !== 'undefined') {
            throw new Error('You don\'t have permission to change enrollment type');
        }

        if (enrollmentManager.controlStudentAccess?.toLowerCase() === 'no' && typeof studentAccess !== 'undefined') {
            throw new Error('You don\'t have permission to change student access');
        }

        const syllabus: Syllabus = await syllabusService.getSyllabus(requestData);

        // update course syllabus
        if (typeof creditHours !== 'undefined'
            || typeof enrollmentType !== 'undefined'
            || typeof courseName !== 'undefined'
            || typeof courseId !== 'undefined') {
            await syllabusService.setSyllabus(requestData, {
                ...syllabus,
                courseId: courseId ?? syllabus.courseId,
                courseName: courseName ?? syllabus.courseName,
                credits: creditHours ?? syllabus.credits,
                enrollmentOption: enrollmentType ?? syllabus.enrollmentOption
            });
        }

        // update course timezone
        if (typeof courseTimeZone !== 'undefined') {
            await courseService.setTimeZone(requestData, courseTimeZone);
        }

        // update course prerequisites
        if (typeof courseSettings?.courseInformation?.prerequisites !== 'undefined') {
            await courseService.setPrerequisites(
                requestData, 
                courseSettings.courseInformation.prerequisites
                    .filter((prerequisite: string) => prerequisite !== '')
            );
        }

        // update nocrypt for either ta or instructor submitting this form
        if (typeof courseSettings?.security?.allowMultipleLogins !== 'undefined') {
            await userService.setNoCrypt(
                requestData, 
                courseSettings.security.allowMultipleLogins
            );
        }

        // update number of days a student has to complete course once they start
        if (typeof courseSettings?.studentEnrollment?.courseTimeLimit !== 'undefined') {
            if (courseSettings?.studentEnrollment?.courseTimeLimit !== null) {
                await courseService.setCourseTimeLimit(requestData, String(courseTimeLimit));
            } else {
                await courseService.deleteCourseTimeLimit(requestData);
            }
        }

        // update course visibility on course regitration and course catalog pages
        if (typeof registrationDoor !== 'undefined') {
            await courseService.setRegistrationDoor(requestData, registrationDoor);
        }

        // update whether or not students can enroll in course at any time
        if (typeof enrollmentType !== 'undefined') {
            await courseService.setEnrollmentType(requestData, enrollmentType);
        }

        if (typeof studentAccess !== 'undefined') {
            // delete student IP block list if user changes student access to On or ''
            const studentAccessBeforeChange: string = await courseService.getStudentAccess(requestData);
            if (studentAccess?.toLowerCase() !== 'off' && studentAccessBeforeChange?.toLowerCase() === 'off') {
                await courseService.deleteStudentIPList(requestData);
            }

            await courseService.setCourseStudentAccess(studentAccess, requestData);
        }

        // update whether or not audio/video files can be uploaded in course assignments
        if (typeof activateAudioVideo !== 'undefined') {
            await courseService.setAudioVideoRecordingCapabilities(requestData, activateAudioVideo);
        }

        // update course meeting times displayed on syllabus
        if (typeof courseMeetingTimes !== 'undefined') {
            await (new CourseMeetingTimesService()).setMeetingTimes(requestData, courseMeetingTimes);
        }

        if (courseService.shouldWriteCoursesToDB()) {
            await courseService.updateCourseInDB(
                requestData, 
                courseSettings?.courseInformation, 
                courseSettings?.studentEnrollment
            );

            await courseService.clearCourseCache(requestData);
        }

        // update course history log
        const userFullName = `${syllabus.title} ${syllabus.firstName} ${syllabus.middleName} ${syllabus.lastName}`;
        const courseHistory: CourseHistory = {
            username: requestData.instructor,
            name: userFullName,
            school: syllabus.school,
            courseName: courseName ?? syllabus.courseName,
            courseTitle: courseId ?? syllabus.courseId,
            password: syllabus.password,
            email: syllabus.email,
            phoneNumber: syllabus.phoneNumber
        };
        await courseService.setCourseHistory(requestData, courseHistory);

        // go through entire course list and update course name/id if user changes either
        if (typeof courseName !== 'undefined' || typeof courseId !== 'undefined') {
            const globalCourseList: GlobalCourseListEntry[] = await courseService.getGlobalCourseList(
                requestData
            );
            const modifiedGlobalCourseList = globalCourseList.map((course) => {
                return course.username === requestData.username && course.courseId === requestData.courseid
                    ? {
                        ...course,
                        courseName: courseName ?? course.courseName,
                        courseId: courseId?.replace(/ \+/g,' ') ?? course.courseId
                      }
                    : course;
            });
            await courseService.setGlobalCourseList(requestData, modifiedGlobalCourseList);
        }

        // if user changes course id, we need to update directory names and all instances of
        // the old course id with the new course id
        if (typeof courseId !== 'undefined') {

            if (await courseService.coursePathExists({ ...requestData, courseid: courseId })) {
                throw new Error('Invalid course id. Course id already exists.');
            }

            // go through instructor objects and replace all instances of old course id with new course id
            const instructorObjects = await userObjectService.getObjects(requestDataForInstructor);
            await userObjectService.setObjects(
                requestDataForInstructor, 
                instructorObjects.map((instructorObject) => {
                    if (instructorObject.courseId === requestData.courseid) {
                        return { ...instructorObject, courseId };
                    }

                    return instructorObject;
                })
            );

            // get a list of all students and tas enrolled in this course
            const roster = await getRoster({
                shellroot: requestData.shellroot,
                dir: requestData.dir,
                instructor: requestData.instructor,
                courseid: requestData.courseid
            });

            // go through course lists for all students and tas, and replace all instances of
            // the old course id with the new course id
            for (const user of roster) {
                const requestDataForRosterUser = {
                    ...requestData,
                    username: user.username
                };
                const courseList = await courseService.getStudentAndTaEntireCourseList(
                    requestDataForRosterUser
                );

                await courseService.setCourseList(
                    requestDataForRosterUser, 
                    false, 
                    courseList.map((course) => {
                        if (course.courseid === requestData.courseid 
                            && course.instructorUsername === requestData.instructor) {
                            return { ...course, courseid: courseId };
                        }

                        return course;
                    })
                );
            }

            // go through the course instructor's entire course list and replace the old course
            // id with the new course id
            const instructorCourseList = await courseService.getInstructorEntireCourseList(
                requestDataForInstructor
            );

            await courseService.setCourseList(
                requestDataForInstructor, 
                true, 
                instructorCourseList.map((course) => {
                    if (course.courseid === requestData.courseid) {
                        return { ...course, courseid: courseId };
                    }

                    return course;
                })
            );

            // a couple of directories have the old course id as the name, so we need to rename those
            // to the new course id
            await courseService.renameCourseIdDirectories(requestData, courseId);
        }
    }
}