import { AutoExemption, ExemptionRule, CommonParams } from './autoExemption'; // Adjust the import path as needed
import { MongoDB } from '@educator-ng/database'; // Import necessary dependencies
import { MdbModifyCourseInterface } from '@educator-ng/common';

// Mock MongoDB methods
jest.mock('@educator-ng/database', () => {
  const mockMongoDB = {
    get: jest.fn(() => ({
      db: jest.fn(() => ({
        collection: jest.fn(() => ({
          updateOne: jest.fn(),
          findOne: jest.fn(),
        })),
      })),
    })),
  };
  return { MongoDB: mockMongoDB };
});

// Mock FileService
jest.mock('./file.service', () => ({
  getFileContents: jest.fn(),
}));

describe('AutoExemption', () => {
  let autoExemption: AutoExemption;

  beforeEach(() => {
    autoExemption = new AutoExemption();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should update exemptions', async () => {
    // Mock MongoDB updateOne method
    const updateOneMock = MongoDB.get().db().collection().updateOne as jest.Mock;
    updateOneMock.mockResolvedValue({});

    const inputParams: CommonParams = {
      shellroot: 'exampleShellRoot',
      dir: 'exampleDir',
      courseid: 'exampleCourseId',
    };
    const exemption: ExemptionRule = {
      ruleName: 'exampleRuleName',
      reasonForExemption: 'Example Reason',
      exemptionCondition: ExemptionCondition.Honors,
      assessments: ['Assessment 1', 'Assessment 2'],
    };

    const result = await autoExemption.updateExemptions(inputParams, exemption);

    expect(result).toEqual(exemption);
    expect(updateOneMock).toHaveBeenCalledWith(
      { cid: inputParams.courseid },
      {
        $set: {
          [`exemptions.${exemption.ruleName}`]: exemption,
        },
      }
    );
  });

  it('should delete exemptions', async () => {
    // Mock MongoDB updateOne method
    const updateOneMock = MongoDB.get().db().collection().updateOne as jest.Mock;
    updateOneMock.mockResolvedValue({});

    const inputParams: CommonParams = {
      shellroot: 'exampleShellRoot',
      dir: 'exampleDir',
      courseid: 'exampleCourseId',
    };
    const exemptionRuleName = 'exampleRuleName';

    const result = await autoExemption.deleteExemption(inputParams, exemptionRuleName);

    expect(result).toEqual(`${exemptionRuleName} got deleted`);
    expect(updateOneMock).toHaveBeenCalledWith(
      { cid: inputParams.courseid },
      {
        $unset: {
          [`exemptions.${exemptionRuleName}`]: 1,
        },
      }
    );
  });

  it('should get exemption rules', async () => {
    const inputParams: CommonParams = {
      shellroot: 'exampleShellRoot',
      dir: 'exampleDir',
      courseid: 'exampleCourseId',
    };
    const exemptionRules: ExemptionRule[] = [
      {
        ruleName: 'Rule1',
        reasonForExemption: 'Reason1',
        exemptionCondition: ExemptionCondition.Honors,
        assessments: ['Assessment 1', 'Assessment 2'],
      },
      // Add more exemption rules as needed
    ];

    const findOneMock = MongoDB.get().db().collection().findOne as jest.Mock;
    findOneMock.mockResolvedValue({ exemptions: exemptionRules });

    const result = await autoExemption.getExemptionRules(inputParams);

    expect(result).toEqual(expect.objectContaining(exemptionRules));
  });

  it('should get exempted lessons', async () => {
    // Mock FileService.getFileContents to return JSON data
    const getFileContentsMock = require('./file.service').getFileContents as jest.Mock;
    getFileContentsMock.mockResolvedValue(JSON.stringify({ exempted_pages: { Lesson1: true, Lesson2: true } }));

    const inputParams: CommonParams = {
      shellroot: 'exampleShellRoot',
      dir: 'exampleDir',
      courseid: 'exampleCourseId',
    };

    const result = await AutoExemption.getExemptedLessons(inputParams);

    expect(result).toEqual(['Lesson1', 'Lesson2']);
  });
});
