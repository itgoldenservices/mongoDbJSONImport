
import { MdbSelector, MdbHistoryInterface } from "@educator-ng/common";
import { MongoDB, MemcachedService } from "@educator-ng/database";
import { BaseService, MdbBaseInterface } from "./base.service";

interface ExemptionRule {
    ruleName: string;
    reasonForExemption: string;
    exemptionCondition: string;
    assessments: string[];
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
    exemptionRules: ExemptionRule[]
}

export class AutoExemptionService extends BaseService {
    async function updateExemptions(inputParams: {
        courseId: string;
        dbSelector: MdbSelector;
        exemptions: ExemptionRule[];
    }): Promise<void> {
        const tempClient = MongoDB.get();
        const mdb = tempClient.db(`${inputParams.dbSelector.shellRoot}_${inputParams.dbSelector.dir}`);
        const courseCollection = mdb.collection<MdbModifyCourseInterface>("courses");
    
        const { courseId, dbSelector, exemptions } = inputParams;
    
        try {
            await courseCollection.updateOne(
                { _id: courseId },
                { $set: { exemptions: exemptions } }
            );
        } catch (error) {
            // Handle the error here, such as logging or throwing an exception.
            // For example:
            console.error(`Error updating exemptions for courseId ${courseId}:`, error);
            throw error;
        }
    }
    
    async function getExemptionRules(inputParams: { courseId: string; dbSelector: MdbSelector }): Promise<ExemptionRule[] | null> {
    const tempClient = MongoDB.get();
    const mdb = tempClient.db(`${inputParams.dbSelector.shellRoot}_${inputParams.dbSelector.dir}`);
    const courseCollection = mdb.collection("courses");

    const course = await courseCollection.findOne({ _id: inputParams.courseId });

    if (course && course.exemptions && Array.isArray(course.exemptions)) {
        return course.exemptions;
    } else {
        return null; // No exemptions found or course not found with the given courseId
    }
    }
}