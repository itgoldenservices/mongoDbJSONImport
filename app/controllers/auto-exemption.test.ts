//import { CommonParams, FileService, AutoExemptionService, } from '@educator-ng/common';
import { mock } from 'node:test';
import Lessons from './Lessons';
import { CommonParams, FileService, AutoExemptionService, MongoDB } from './services';
// describe('Auto Exemption Service', () => {
//   let requestParams: CommonParams = {
//     shellroot: '',
//     dir: '',
//   };

//   beforeEach(() => {

//     requestParams = {
//       shellroot: 'e1',
//       dir: 'dev_test',
//       instructor: 'a_teacher',
//       courseid: '1234',
//       username: 'a_student',
//     };
//   });

//   afterEach(() => {
//     jest.clearAllMocks();
//   })

//   describe.skip('getExemptedLessons', () => {
//     it('should return an array of strings', async () => {
//       const exemptedPages: string = '{"exempted_pages":{"module01/01_01_01.htm":1,"module01/01_03_01.htm":1,"module01/01_06_01.htm":1,"module03/03_02_01.htm":1}}'
//       const expectedResult: string[] = [
//         'module01/01_01_01.htm',
//         'module01/01_03_01.htm',
//         'module01/01_06_01.htm',
//         'module03/03_02_01.htm',
//       ];
//       jest.spyOn(FileService, 'getFileContents').mockImplementation(async () => exemptedPages);
//       const result: string[] = await AutoExemptionService.getExemptedLessons(requestParams);

//       expect(typeof result).toBe('object');
//       expect(result).toEqual(expectedResult);
//     });

//     it('should return empty array for bad JSON', async () => {
//       const exemptedPages: string = '{"exempted_page"';
//       const expectedResult: string[] = [];

//       jest.spyOn(FileService, 'getFileContents').mockImplementation(async () => exemptedPages);
//       const result: string[] = await AutoExemptionService.getExemptedLessons(requestParams);

//       expect(typeof result).toBe('object');
//       expect(result).toEqual(expectedResult);
//     });

//     it('should empty array for existing but empty file', async () => {
//       const exemptedPages: string = '{}';
//       const expectedResult: string[] = [];

//       jest.spyOn(FileService, 'getFileContents').mockImplementation(async () => exemptedPages);
//       const result: string[] = await AutoExemptionService.getExemptedLessons(requestParams);

//       expect(typeof result).toBe('object');
//       expect(result).toEqual(expectedResult);
//     });

//     it('should empty array for non-existant file', async () => {
//       const expectedResult: string[] = [];
//       const result: string[] = await AutoExemptionService.getExemptedLessons(requestParams);

//       expect(typeof result).toBe('object');
//       expect(result).toEqual(expectedResult);
//     });


//   });
// });

const mockSetAssessmentIsExempt = jest.fn();
const mockGetSubmission = jest.fn().mockResolvedValue({ "Q1": 7, "Q2": 5, "Q3": 0 });

jest.mock('./assessment.controller', () => {
  return {
    AssessmentService: jest.fn().mockImplementation(() => {
      return {
        setAssessmentIsExempt: mockSetAssessmentIsExempt,
        getSubmission: mockGetSubmission
      }
    }),
  }
});

const mockLessons = {
  "_id": "6410bdc9d538405d1a6793d8",
  "role": "student",
  "status": "archived",
  "lastUpdatedFromVSA": "2023-03-14T13:30:00.876-0500",
  "course": {
    "title": "Algebra I v17 - Level 1",
    "cid": "3939",
    "vsa_course_id": 3940,
    "vsa_classroom_id": 480260,
    "course_idfk": "5ec591f722bf7cc24b4a3360"
  },
  "instructor": {
    "instructor_foreign_id": 3786236,
    "username": "m_slippert",
    "instructor_idfk": "5e30b10f83cfd55260b93ae8",
    "lname": "Lippert",
    "mname": "James",
    "fname": "Steve"
  },
  "owner": {
    "owner_idfk": "6410bdc8d538405d1a6793d6",
    "owner_foreign_id": 79453897,
    "username": "cathy33",
    "lname": "McDermott",
    "fname": "Cathy",
    "mname": "Maude"
  },
  "exemptedLessons": [
    { "module01/01_01_01.htm": 1 },
    { "module01/01_05_01.htm": 1 },
    { "linked-mj_pre_algebra_1658322790758.json": 1 },
    { "linked-mj_pre_algebra_1658322777423.json": 1 },
    { "linked-mj_pre_algebra_1658322793410.json": 1 },
    { "linked-mj_pre_algebra_1658322779196.json": 1 },
    { "mj_pre_algebra_1658167535542.json": 1 }
  ]
};


const mockData: any = {
  "version": "2.0",
  "usage": {
    "active": 1,
    "mode": "restrict",
    "dir_exceptions": {
      "content": true
    },
    "instructor_exceptions": {
      "jarnstein1": false
    }
  },

  "exam_0001": {
    "exemption_data": {
      "2a12d202a844ed979d2b25895f34304fd3d5c6c3": {
        "exam_group_requirements": [
          {
            "group": "16",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.1"
        ],
        "lessons_to_skip": [
          "module01/01_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0002",
            "name": "01.00 Module One Pretest",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "98d6aaaf3f5b1f0264722194cc2209a20c6bcb5e": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          },
          {
            "group": "2",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.1",
          "SS.912.W.3.2"
        ],
        "lessons_to_skip": [
          "module01/01_02_01.htm"
        ],
        "assessments_to_ex": [

        ]
      },
      "b33d3f39635580cf2d4c086af5adeac61a657ed2": {
        "exam_group_requirements": [
          {
            "group": "3",
            "required": "all"
          },
          {
            "group": "4",
            "required": "all"
          },
          {
            "group": "5",
            "required": "all"
          },
          {
            "group": "6",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.3",
          "SS.912.G.4.3",
          "SS.912.W.3.7",
          "SS.912.W.3.4"
        ],
        "lessons_to_skip": [
          "module01/01_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0004",
            "name": "01.03 The Expansion of Islam",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "65bb116e8cbfb41d760704dc8d798a7148b39e90": {
        "exam_group_requirements": [
          {
            "group": "10",
            "required": "all"
          },
          {
            "group": "11",
            "required": "all"
          },
          {
            "group": "12",
            "required": "all"
          },
          {
            "group": "13",
            "required": "all"
          },
          {
            "group": "15",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.6",
          "SS.912.W.2.4",
          "SS.912.W.2.3",
          "SS.912.W.2.2",
          "SS.912.W.2.9"
        ],
        "lessons_to_skip": [
          "module01/01_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0006",
            "name": "01.05 The Byzantines",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "c1258debfcae40702301e006d8a1dddec07733b4": {
        "exam_group_requirements": [
          {
            "group": "14",
            "required": "all"
          },
          {
            "group": "16",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.5",
          "SS.912.W.2.1"
        ],
        "lessons_to_skip": [
          "module01/01_06_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0007",
            "name": "01.06 Byzantine Empire: Achievement and Expansion",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "52913152b191a2528169953b6711b2dba5f4719a": {
        "exam_group_requirements": [
          {
            "group": "7",
            "required": "all"
          },
          {
            "group": "8",
            "required": "all"
          },
          {
            "group": "9",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.5",
          "SS.912.W.3.6",
          "SS.912.W.1.3",
          ""
        ],
        "lessons_to_skip": [
          "module01/01_04_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0005",
            "name": "01.00 Module One Pretest",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "01.00 Module One Pretest"
  },
  "assignment_0001": {
    "exemption_data": {
      "2a12d202a844ed979d2b25895f34304fd3d5c6c3": {
        "assignment_total_requirement": 5,
        "standards": [
          "SS.912.W.2.1"
        ],
        "lessons_to_skip": [
          "module01/01_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0002",
            "name": "01.00 Module One Pretest",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "98d6aaaf3f5b1f0264722194cc2209a20c6bcb5e": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          },
          {
            "group": "2",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.1",
          "SS.912.W.3.2"
        ],
        "lessons_to_skip": [
          "module01/01_02_01.htm"
        ],
        "assessments_to_ex": [

        ]
      },
      "b33d3f39635580cf2d4c086af5adeac61a657ed2": {
        "exam_group_requirements": [
          {
            "group": "3",
            "required": "all"
          },
          {
            "group": "4",
            "required": "all"
          },
          {
            "group": "5",
            "required": "all"
          },
          {
            "group": "6",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.3",
          "SS.912.G.4.3",
          "SS.912.W.3.7",
          "SS.912.W.3.4"
        ],
        "lessons_to_skip": [
          "module01/01_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0004",
            "name": "01.03 The Expansion of Islam",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "65bb116e8cbfb41d760704dc8d798a7148b39e90": {
        "exam_group_requirements": [
          {
            "group": "10",
            "required": "all"
          },
          {
            "group": "11",
            "required": "all"
          },
          {
            "group": "12",
            "required": "all"
          },
          {
            "group": "13",
            "required": "all"
          },
          {
            "group": "15",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.6",
          "SS.912.W.2.4",
          "SS.912.W.2.3",
          "SS.912.W.2.2",
          "SS.912.W.2.9"
        ],
        "lessons_to_skip": [
          "module01/01_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0006",
            "name": "01.05 The Byzantines",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "c1258debfcae40702301e006d8a1dddec07733b4": {
        "exam_group_requirements": [
          {
            "group": "14",
            "required": "all"
          },
          {
            "group": "16",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.5",
          "SS.912.W.2.1"
        ],
        "lessons_to_skip": [
          "module01/01_06_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0007",
            "name": "01.06 Byzantine Empire: Achievement and Expansion",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "52913152b191a2528169953b6711b2dba5f4719a": {
        "exam_group_requirements": [
          {
            "group": "7",
            "required": "all"
          },
          {
            "group": "8",
            "required": "all"
          },
          {
            "group": "9",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.5",
          "SS.912.W.3.6",
          "SS.912.W.1.3",
          ""
        ],
        "lessons_to_skip": [
          "module01/01_04_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0005",
            "name": "01.00 Module One Pretest",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "01.00 Module One Pretest"
  },
  "exam_0009": {
    "exemption_data": {
      "e7f8ba8c6197dc82f58b8e3b7d5761e160911693": {
        "exam_group_requirements": [
          {
            "group": "9",
            "required": "all"
          },
          {
            "group": "10",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.16, SS.912.W.2.18"
        ],
        "lessons_to_skip": [
          "module02/02_06_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0015",
            "name": "02.06 Developing a National Identity",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "93aefc01a60a6c33ad5a9123a27fbd12beda5d64": {
        "exam_group_requirements": [
          {
            "group": "11",
            "required": "all"
          },
          {
            "group": "12",
            "required": "all"
          },
          {
            "group": "13",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.19",
          "SS.912.W.2.20",
          "SS.912.W.2.22"
        ],
        "lessons_to_skip": [
          "module02/02_07_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0016",
            "name": "02.07 East Asia",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "8927365e138bcabe2856792895da8437b1037268": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.10"
        ],
        "lessons_to_skip": [
          "module02/02_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0010",
            "name": "02.01 Medieval Hierarchy",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "c9f6cc26bdb86f25bf94c38124d3a587ab937b91": {
        "exam_group_requirements": [
          {
            "group": "2",
            "required": "all"
          },
          {
            "group": "3",
            "required": "all"
          },
          {
            "group": "4",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.11",
          "SS.912.W.2.13",
          "SS.912.W.2.12"
        ],
        "lessons_to_skip": [
          "module02/02_02_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0011",
            "name": "02.02 Rulers and Robes",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "4f9df2028997f36cda83738e611141e6db7bd855": {
        "exam_group_requirements": [
          {
            "group": "5",
            "required": "all"
          },
          {
            "group": "6",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.8",
          "SS.912.G.1.2"
        ],
        "lessons_to_skip": [
          "module02/02_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0012",
            "name": "02.03 The Crusades",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "163ce4e44375da344ba306c2b4faeea5ce206c13": {
        "exam_group_requirements": [
          {
            "group": "7",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.17 "
        ],
        "lessons_to_skip": [
          "module02/02_04_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0013",
            "name": "02.04 Medieval Arts and Literature",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "47b5c7e53c4131604660d25cdd79f18244d7df95": {
        "exam_group_requirements": [
          {
            "group": "8",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.2.15"
        ],
        "lessons_to_skip": [
          "module02/02_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0014",
            "name": "02.05 Guilds and a Changing Economy",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "02.00 Module Two Pretest"
  },
  "exam_0018": {
    "exemption_data": {
      "e8b96008a310b8cc2f0af558a1f53bd19c953137": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          },
          {
            "group": "2",
            "required": "all"
          },
          {
            "group": "3",
            "required": "all"
          },
          {
            "group": "4",
            "required": "all"
          },
          {
            "group": "5",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.10",
          "SS.912.W.3.11",
          "SS.912.W.3.12",
          "SS.912.W.3.14",
          "SS.912.G.1.3"
        ],
        "lessons_to_skip": [
          "module03/03_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0019",
            "name": "03.01 West African Kingdoms",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "0f66ae32957e84ae5c8c6c4e09055bf5d2b1cade": {
        "exam_group_requirements": [
          {
            "group": "6",
            "required": "all"
          },
          {
            "group": "7",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.9",
          "SS.912.W.3.13"
        ],
        "lessons_to_skip": [
          "module03/03_02_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0020",
            "name": "03.02 Big Picture Africa",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "1ba98791ece334ec64a08dbe096fca24451e9387": {
        "exam_group_requirements": [
          {
            "group": "8",
            "required": "all"
          },
          {
            "group": "9",
            "required": "all"
          },
          {
            "group": "10",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.H.1.3",
          "SS.912.W.3.16",
          "SS.912.W.3.15"
        ],
        "lessons_to_skip": [
          "module03/03_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0021",
            "name": "03.03 Early Mesoamerican Civilizations",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "c5468b7c555f0952278260c86f54459cb7a6883d": {
        "exam_group_requirements": [
          {
            "group": "11",
            "required": "all"
          },
          {
            "group": "12",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.3.18",
          "SS.912.W.3.19"
        ],
        "lessons_to_skip": [
          "module03/03_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0022",
            "name": "03.05 Comparing and Contrasting Early American Civilizations",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "03.00 Module Three Pretest"
  },
  "exam_0024": {
    "exemption_data": {
      "0e9b2bc71b1ff8d4fbc8a15d6a989b7817aa4f2d": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          },
          {
            "group": "2",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.9.5,",
          "SS.912.W.2.14"
        ],
        "lessons_to_skip": [
          "module04/04_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0025",
            "name": "04.01 Science and Rebirth",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "ac2365ef71c5e0a7ad6b317b256da0dd49af7608": {
        "exam_group_requirements": [
          {
            "group": "3",
            "required": "all"
          },
          {
            "group": "4",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.4.1",
          "SS.912.G.1.1"
        ],
        "lessons_to_skip": [
          "module04/04_02_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0026",
            "name": "04.02 Italian City-States",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "8e43fba06b0e8de12533006f03faadbb67acc765": {
        "exam_group_requirements": [
          {
            "group": "5",
            "required": "all"
          },
          {
            "group": "6",
            "required": "all"
          },
          {
            "group": "7",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.4.2",
          "SS.912.W.4.3",
          "SS.912.W.4.4"
        ],
        "lessons_to_skip": [
          "module04/04_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0027",
            "name": " 04.03 Renaissance Humanities and Fine Arts",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "b4da80bc8474f1b13a5a00297794af7e4aa41f22": {
        "exam_group_requirements": [
          {
            "group": "8",
            "required": "all"
          },
          {
            "group": "9",
            "required": "all"
          },
          {
            "group": "10",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.4.7",
          "SS.912.W.4.8",
          "SS.912.W.4.9"
        ],
        "lessons_to_skip": [
          "module04/04_04_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0028",
            "name": "04.04 The Reformation and Counter-Reformation",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "53270d681d66a820a65e33e1d164fd56b52c9923": {
        "exam_group_requirements": [
          {
            "group": "11",
            "required": "all"
          },
          {
            "group": "12",
            "required": "all"
          },
          {
            "group": "13",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.4.11",
          "SS.912.H.3.1",
          "SS.912.G.4.2"
        ],
        "lessons_to_skip": [
          "module04/04_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0029",
            "name": "04.05 Age of Discovery",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "d833fe9f555692f2afd3724230cf9d2367728ca1": {
        "exam_group_requirements": [
          {
            "group": "14",
            "required": "all"
          },
          {
            "group": "15",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.4.14",
          "SS.912.W.4.15"
        ],
        "lessons_to_skip": [
          "module04/04_07_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0030",
            "name": "04.07 Slavery",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "04.00 Module Four Pretest"
  },
  "exam_0033": {
    "exemption_data": {
      "fb9d7d781b211bc675a8fbb854361c84d532e941": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          },
          {
            "group": "2",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.G.2.1",
          "SS.912.G.4.1"
        ],
        "lessons_to_skip": [
          "module05/05_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0034",
            "name": "05.01 European Geography",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "c06631be57170b2c02539775d4ee7e112bb0c2c1": {
        "exam_group_requirements": [
          {
            "group": "3",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.5.1"
        ],
        "lessons_to_skip": [
          "module05/05_02_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0035",
            "name": " 05.02 Constitutional versus Absolute Monarchies",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "c7065b44b33a839f84c4996961d21ca16df99e76": {
        "exam_group_requirements": [
          {
            "group": "4",
            "required": "all"
          },
          {
            "group": "5",
            "required": "all"
          },
          {
            "group": "6",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.4.5",
          "SS.912.W.4.6",
          "SS.912.W.4.10"
        ],
        "lessons_to_skip": [
          "module05/05_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0036",
            "name": "05.03 The Scientific Revolution",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "fd51e7b7fa23df69031ab587e589da6e9dfb9df5": {
        "exam_group_requirements": [
          {
            "group": "7",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.9.1"
        ],
        "lessons_to_skip": [
          "module05/05_04_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0037",
            "name": "05.04 Modern Science",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "a1100bcd89adcd15019ac3df00351ff2f795e6ba": {
        "exam_group_requirements": [
          {
            "group": "8",
            "required": "all"
          },
          {
            "group": "9",
            "required": "all"
          },
          {
            "group": "10",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.5.2",
          "SS.912.W.5.3",
          "SS.912.W.5.4"
        ],
        "lessons_to_skip": [
          "module05/05_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0038",
            "name": "05.05 The Age of Enlightenment",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "05.00 Module Five Pretest"
  },
  "exam_0040": {
    "exemption_data": {
      "40f04e7d65703dbeb6f7e5a882e2d1fee33553a2": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.5.7"
        ],
        "lessons_to_skip": [
          "module06/06_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0041",
            "name": "06.01 Independence and Reform",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "aee81640c4da53e56b6ad374990902ab41d88562": {
        "exam_group_requirements": [
          {
            "group": "2",
            "required": "all"
          },
          {
            "group": "3",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.6.1",
          "SS.912.W.6.2"
        ],
        "lessons_to_skip": [
          "module06/06_02_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0042",
            "name": "06.02 The Industrial Revolution",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "27e72d0347f6f71095e94a7594d5c2a8a8b5411c": {
        "exam_group_requirements": [
          {
            "group": "4",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.6.3"
        ],
        "lessons_to_skip": [
          "module06/06_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0043",
            "name": "06.03 Political and Economic Ideologies",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "2118a17b214b48b1dc1304ff4d3a5c6e3817cc82": {
        "exam_group_requirements": [
          {
            "group": "5",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.6.5"
        ],
        "lessons_to_skip": [
          "module06/06_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0044",
            "name": "06.05 Italian and German Unification",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "7e1dd31175285447204b7171bfd97598a4376381": {
        "exam_group_requirements": [
          {
            "group": "6",
            "required": "all"
          },
          {
            "group": "7",
            "required": "all"
          },
          {
            "group": "8",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.8.7",
          "SS.912.W.8.9",
          "SS.912.W.6.4"
        ],
        "lessons_to_skip": [
          "module06/06_06_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0045",
            "name": "06.06 Modern Reform and Independence",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "06.00 Module Six Pretest"
  },
  "exam_0047": {
    "exemption_data": {
      "f7073ab3c9072ffcf5ac264db1b6e88d568cf3b4": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.7.1"
        ],
        "lessons_to_skip": [
          "module07/07_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0048",
            "name": "07.01 Allies and Enemies: World War I",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "79df038f70ff6bb4baaec2b069abaa7e7af1cdb1": {
        "exam_group_requirements": [
          {
            "group": "2",
            "required": "all"
          },
          {
            "group": "3",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.7.2",
          "SS.912.W.7.3"
        ],
        "lessons_to_skip": [
          "module07/07_02_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0049",
            "name": "07.02 Modern Warfare and Its Legacy ",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "8e6846457c51fafb42c19e7ce55c67f6fca6ffd3": {
        "exam_group_requirements": [
          {
            "group": "4",
            "required": "all"
          },
          {
            "group": "5",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.7.4",
          "SS.912.W.7.5"
        ],
        "lessons_to_skip": [
          "module07/07_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0050",
            "name": "07.03 Between the Fires",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "5ec0bdf35066c8c1e4afb36696c1a83d9dd1e4a6": {
        "exam_group_requirements": [
          {
            "group": "6",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.7.7"
        ],
        "lessons_to_skip": [
          "module07/07_04_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0051",
            "name": "07.04 The Spark and Fire",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "0b3fdfda992721d8da6411a0d4c327257ca3b753": {
        "exam_group_requirements": [
          {
            "group": "7",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.7.10"
        ],
        "lessons_to_skip": [
          "module07/07_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0052",
            "name": "07.05 Dropping the Atomic Bomb",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "31faf414370ee85319ad534ae46831639122579d": {
        "exam_group_requirements": [
          {
            "group": "8",
            "required": "all"
          },
          {
            "group": "9",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.7.11",
          "SS.912.W.7.9"
        ],
        "lessons_to_skip": [
          "module07/07_07_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0053",
            "name": "07.07 Impact of World War II",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "07.00 Module Seven Pretest"
  },
  "exam_0055": {
    "exemption_data": {
      "e9cf56c09a0bcb159cee0cd8497551ca4c8bcad4": {
        "exam_group_requirements": [
          {
            "group": "1",
            "required": "all"
          },
          {
            "group": "2",
            "required": "all"
          },
          {
            "group": "3",
            "required": "all"
          },
          {
            "group": "4",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.8.1",
          "SS.912.G.4.9",
          "SS.912.W.1.5",
          "SS.912.W.8.2"
        ],
        "lessons_to_skip": [
          "module08/08_01_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0056",
            "name": "08.01 The Roots of the Cold War",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "069e38333c1b3d829a428bd34b31a45bbd960cb6": {
        "exam_group_requirements": [
          {
            "group": "6",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.8.4"
        ],
        "lessons_to_skip": [
          "module08/08_03_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0058",
            "name": "08.03 Proxy Wars",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "857033fb178c8d388d770462f18b1e86a5bf006a": {
        "exam_group_requirements": [
          {
            "group": "5",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.8.3"
        ],
        "lessons_to_skip": [
          "module08/08_02_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0057",
            "name": "08.02 Modern China",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "33571f1d5dba9fb3bb920787054072e9c1f2b429": {
        "exam_group_requirements": [
          {
            "group": "7",
            "required": "all"
          },
          {
            "group": "8",
            "required": "all"
          },
          {
            "group": "9",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.8.6",
          "SS.912.W.8.8",
          "SS.912.W.9.4"
        ],
        "lessons_to_skip": [
          "module08/08_05_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0059",
            "name": "08.05 New Nationalism",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "3c313ce6ead6fff7ce5a061eecf9ae853f49b905": {
        "exam_group_requirements": [
          {
            "group": "10",
            "required": "all"
          },
          {
            "group": "11",
            "required": "all"
          },
          {
            "group": "12",
            "required": "all"
          },
          {
            "group": "13",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.9.2",
          "SS.912.G.4.7",
          "SS.912.W.9.6",
          "SS.912.G.2.2"
        ],
        "lessons_to_skip": [
          "module08/08_06_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0060",
            "name": "08.06 Globalization",
            "path": "exams",
            "type": "exam"
          }
        ]
      },
      "8caaf5ee7010474208d8fc6fce002fdc3fbf2644": {
        "exam_group_requirements": [
          {
            "group": "14",
            "required": "all"
          },
          {
            "group": "15",
            "required": "all"
          },
          {
            "group": "16",
            "required": "all"
          }
        ],
        "standards": [
          "SS.912.W.9.7",
          "SS.912.W.8.10",
          "SS.912.G.2.3"
        ],
        "lessons_to_skip": [
          "module08/08_07_01.htm"
        ],
        "assessments_to_ex": [
          {
            "index": "0045",
            "name": "06.06 Modern Reform and Independence",
            "path": "exams",
            "type": "exam"
          },
          {
            "index": "0061",
            "name": "08.07 Invisible Warfare",
            "path": "exams",
            "type": "exam"
          }
        ]
      }
    },
    "pretest_name": "08.00 Module Eight Pretest"
  }
};


const mockUpdateDB = jest.fn().mockResolvedValue(true);
describe('checkExam', () => {
  beforeEach(() => {
    
    jest.spyOn(MongoDB, 'get').mockReturnValue({
      db: (type: string) => {
        return {
          collection: (col: string) => {
            return {
              insertMany: (data: any) => {
                return Promise.resolve(true);
              },
              updateOne: mockUpdateDB,
              find: (data: any) => {
                return Promise.resolve(mockData);
              },
              findOne: (data: any) => {
                console.log(col);
                if (col === "enrollments")
                  return Promise.resolve(mockLessons);
                else
                  return Promise.resolve(mockData);
              },
            }
          }
        }
      }
    });
    jest.spyOn(FileService, 'getFileContents').mockImplementation((file: string, _arg2?: boolean, _arg3?: boolean) => {
      if (file.endsWith('exemptedlesssons_json.txt'))
        return Promise.resolve({ exempted_pages: {} });
      else if (file.endsWith('submittedIndex.txt'))
        return Promise.resolve(["01.00 Module One Pretest*"]);
      else
        return Promise.resolve(["01.00 Module One Pretest*", "Q1*essay*group1*10", "Q2*mcq*group1*5", "Q3*mcq*group2*5"]);
    });
  })
  test('should return when file is not in active courses', async () => {
    const pathToFile = '/inactive/1234/educator/sampleuser/3333/exam.txt';
    const event = '';
    const result = await new AutoExemptionService().checkExam(pathToFile, event);
    expect(result).toBe(undefined);
  });

  test('should return when an invalid assessment', async () => {
    const pathToFile = '/flvs840/content/educator/master3333/master3333/exam.txt';
    const event = '';
    const result = await new AutoExemptionService().checkExam(pathToFile, event);
    expect(result).toBe(undefined);
  });

  test('should return when file is not in exemption data', async () => {
    const pathToFile = '/flvs840/content/educator/master3333/master3333/exam.txt';
    const event = '';
    const result = await new AutoExemptionService().checkExam(pathToFile, event);
    expect(result).toBe(undefined);
  });

  test('should not call getStudentInfo, getDomain, or send email when no exemptions found', async () => {
    const pathToFile = '/flvs840/content/educator/teacher1/3921/exam.txt';
    const event = '';
    const result = await new AutoExemptionService().checkExam(pathToFile, event);
    expect(result).toBe(undefined);
  });

  test('should call getStudentInfo, getDomain, and send expected email when exemptions found', async () => {
    const pathToFile = '/flvs840/content/educator/teacher1/3921/exam.txt';
    const event = 'ASSESSMENT_RESET';
    const result = await new AutoExemptionService().checkExam(pathToFile, event);
    expect(result).toBe(undefined);
  });


  test('should handle exemption if event is Assessment reset', async () => {
    const pathToFile = '/flvs840/content/educator/jarnstein1/3921/dummy2/m_slippert/exam0001.txt';
    const event = 'ASSESSMENT_RESET';
    const result = await new AutoExemptionService().checkExam(pathToFile, event);
    expect(mockSetAssessmentIsExempt).toHaveBeenCalled();
    expect(mockSetAssessmentIsExempt).toHaveBeenCalled();
    expect(mockUpdateDB).toHaveBeenCalled();
    const lessons = mockUpdateDB.mock.calls[0][1]['$set'].exemptedLessons;
    const lesson = Object.keys(lessons[lessons.length - 1])[0];
    expect(lessons[lessons.length - 1][lesson]).toBe(0);
  });

  test('should handle exemption if event is not Assessment reset for assessment type is exam', async () => {
    const pathToFile = '/flvs840/content/educator/jarnstein1/3921/dummy2/m_slippert/exam0001.txt';
    const event = 'ASSESSMENT_SET';
    const result = await new AutoExemptionService().checkExam(pathToFile, event);
    expect(mockSetAssessmentIsExempt).toHaveBeenCalled();
    expect(mockUpdateDB).toHaveBeenCalled();
    const lessons = mockUpdateDB.mock.calls[0][1]['$set'].exemptedLessons;
    const lesson = Object.keys(lessons[lessons.length - 1])[0];
    expect(lessons[lessons.length - 1][lesson]).toBe(1);
  });

  test('should handle exemption if event is not Assessment reset for assessment type is assignment', async () => {
    const pathToFile = '/flvs840/content/educator/jarnstein1/3921/dummy2/m_slippert/assignment0001.txt';
    const event = 'ASSESSMENT_SET';
    mockGetSubmission.mockResolvedValue({
      manual_score: 10,
      rubrics: {
        "rubric1": 5,
        "rubric2": 8
      },
      rawAnsweredQuestions: [
        { "question1": "answer" },
        { "question2": "answer" }
      ]
    });
    const result = await new AutoExemptionService().checkExam(pathToFile, event);
    expect(mockSetAssessmentIsExempt).toHaveBeenCalled();
    expect(mockUpdateDB).toHaveBeenCalled();
    const lessons = mockUpdateDB.mock.calls[0][1]['$set'].exemptedLessons;
    const lesson = Object.keys(lessons[lessons.length - 1])[0];
    expect(lessons[lessons.length - 1][lesson]).toBe(1);
  });
});


