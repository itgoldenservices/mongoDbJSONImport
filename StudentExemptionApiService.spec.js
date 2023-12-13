import { TestBed, inject } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StudentExemptionApiService, StudenExemptionData, AppContext } from './your-service-file'; // Replace with the correct path

describe('StudentExemptionApiService', () => {
  let service: StudentExemptionApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StudentExemptionApiService],
    });

    service = TestBed.inject(StudentExemptionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send a POST request to the correct endpoint with the provided data', () => {
    const appContext: AppContext = {
      role: 'student',
      instructor: 'john_doe',
      courseId: 'course123',
    };

    const exemptionData: StudenExemptionData = {
      student: 'student123',
      data: {
        reason: 'some reason',
        key1: 'value1',
        key2: 42,
      },
    };

    service.setExemptionRules(appContext, exemptionData);

    const req = httpMock.expectOne(`/app/${appContext.role}/${appContext.instructor}/${appContext.courseId}/studentExemption`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(exemptionData);

    req.flush({}); // Simulate a successful response
  });

  it('should log the response on a successful request', inject([StudentExemptionApiService], (apiService: StudentExemptionApiService) => {
    spyOn(console, 'log'); // Spy on console.log to check if it's called

    const appContext: AppContext = {
      role: 'instructor',
      instructor: 'jane_doe',
      courseId: 'course456',
    };

    const exemptionData: StudenExemptionData = {
      student: 'student789',
      data: {
        reason: 'another reason',
        key3: 'value3',
        key4: 99,
      },
    };

    apiService.setExemptionRules(appContext, exemptionData);

    const req = httpMock.expectOne(`/app/${appContext.role}/${appContext.instructor}/${appContext.courseId}/studentExemption`);
    req.flush({ success: true }); // Simulate a successful response

    expect(console.log).toHaveBeenCalledWith({ success: true });
  }));
});
