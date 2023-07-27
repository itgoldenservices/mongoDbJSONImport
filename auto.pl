 se JSON;
use Data::Dumper;
use MIME::QuotedPrint;
use MongoDB;
use MongoDB::OID;
use Packages::E1::E1MongoCacheProxy;
use Packages::E1::E1MongoCacheProxy::EnrollmentCacheProxy;

require "/subroutines/gradebookUtils.pl";


sub getDomain {
    return $ENV{'HTTP_HOST'};
}

sub getBasicAssessmentName {
    my (%data) = @_;

    open(FILE2, $data{path});
    my @lines = <FILE2>;
    close FILE2;

    my @fields = split(/\*/, $lines[0]);
    return $fields[0];

}

sub getStudentInfo {
    my (%data) = @_;

    #my $studentName = getStudentName(netapp => $netapp, dir => $netappDir, instructor => $instructor, cid => $cid, learner =>$learner);
    open(STUPROFILE, "/$data{netapp}/$data{dir}/educator/$data{instructor}/$data{cid}/students/$data{learner}/profile.txt");
    my @lines = <STUPROFILE>;
    close STUPROFILE;

    my $returnValue;

    my @fields = split(/\*/, $lines[0]);

    $returnValue->{fname} = $fields[1];
    $returnValue->{email} = $data{learner} . '@' . getDomain();

    return $returnValue;

}

sub autoExemotionsTurnedOn {
    my (%data) = @_;

    my $usage = $data{usage};

    return 0 if (!$usage->{active});

    if ($usage->{mode} eq 'restrict') {

        # courses are restricted - only the ones specified will be allowed in
        my $allow = 0;
        if (defined($usage->{dir_exceptions})) {
            return 0 if (!defined($usage->{dir_exceptions}->{ $data{dir} }));
            $allow = 1;
        }
        if (defined($usage->{instructor_exceptions})) {
            return 0 if (!defined($usage->{instructor_exceptions}->{ $data{instructor} }));
            $allow = 1;
        }
        return $allow;

    } elsif ($usage->{mode} eq 'open') {

        # courses are open - only the ones specified will be restricted

        my $allow = 1;
        if (defined($usage->{dir_exceptions})) {
            if (defined($usage->{dir_exceptions}->{ $data{dir} })) {
                $allow = 0;
            } else {
                return 1;
            }
        }

        if (defined($usage->{instructor_exceptions})) {
            if (defined($usage->{instructor_exceptions}->{ $data{instructor} })) {
                $allow = 0;
            } else {
                $allow = 1;
            }
        }
        return $allow;
    } else {
        return 1;
    }
    return 0;

}

sub getAllGroups {
    my (%data) = @_;

    my $correctGroups;
    my $assessmentMap;

    foreach my $questionInfo (@{ $data{template} }) {
        my ($questionID, $format, $group, $points) = split(/\*/, $questionInfo);

        $assessmentMap->{$questionID}->{group}  = $group;
        $assessmentMap->{$questionID}->{points} = $points;
    }

    foreach my $key (keys(%{ $data{result} })) {
        my $resultEntry = $data{result}->{$key};

        if (exists($assessmentMap->{$key})) {
            my $assessmentMapEntry = $assessmentMap->{$key};

            # we have found the question number in the template
            if (exists($correctGroups->{ $assessmentMapEntry->{group} })) {
                my $groupEntry = $correctGroups->{ $assessmentMap->{$key}->{group} };

                # there is already an entry in the correctGroups hash - we may need to modify it

                # if the entry we are testing has less points than possible we always
                # set the entry to 0

                if ($groupEntry > 0) {
                    if ($resultEntry < $assessmentMapEntry->{points}) {
                        $correctGroups->{ $assessmentMap->{$key}->{group} } = 0;
                    }
                }
            } else {

                # there is no entry for this yet - we need to create one
                if ($resultEntry < $assessmentMapEntry->{points}) {
                    $correctGroups->{ $assessmentMapEntry->{group} } = 0;
                } else {
                    $correctGroups->{ $assessmentMapEntry->{group} } = 1;
                }
            }

        }

    }

    return $correctGroups;

}

sub getCorrectGroups {
    my (%data) = @_;

    my $correctGroups;
    my $assessmentMap;

    # turn template into data we can use
    #

    foreach my $questionInfo (@{ $data{template} }) {
        my ($questionID, $format, $group, $points) = split(/\*/, $questionInfo);

        $assessmentMap->{$questionID}->{group}  = $group;
        $assessmentMap->{$questionID}->{points} = $points;
    }

    foreach my $key (keys(%{ $data{result} })) {
        my $resultEntry = $data{result}->{$key};

        if (exists($assessmentMap->{$key})) {
            my $assessmentMapEntry = $assessmentMap->{$key};

            # we have found the question number in the template
            if (exists($correctGroups->{ $assessmentMapEntry->{group} })) {
                my $groupEntry = $correctGroups->{ $assessmentMap->{$key}->{group} };

                # there is already an entry in the correctGroups hash - we may need to modify it

                # if the entry we are testing has less points than possible we always
                # set the entry to 0

                if ($groupEntry > 0) {
                    if ($resultEntry < $assessmentMapEntry->{points}) {

                        #warn("found bad -$assessmentMapEntry->{group}");
                        $correctGroups->{ $assessmentMapEntry->{group} }->{all_correct} = 0;
                    } else {
                        $correctGroups->{ $assessmentMapEntry->{group} }->{correct_count}++;

                        #warn("found good - $a$assessmentMapEntry->{group} - $correctGroups->{ $assessmentMapEntry->{group} }->{correct_count}");
                    }
                }
            } else {

                # there is no entry for this yet - we need to create one
                if ($resultEntry < $assessmentMapEntry->{points}) {
                    $correctGroups->{ $assessmentMapEntry->{group} }->{correct_count} = 0;
                    $correctGroups->{ $assessmentMapEntry->{group} }->{all_correct}   = 0;

                    # warn("initial bad - $assessmentMapEntry->{group}");
                } else {
                    $correctGroups->{ $assessmentMapEntry->{group} }->{correct_count} = 1;
                    $correctGroups->{ $assessmentMapEntry->{group} }->{all_correct}   = 1;

                    # warn("initial good - $assessmentMapEntry->{group}");
                }
            }

        }

    }

    return $correctGroups;

}

sub handleExemptions {
    my ($data) = @_;

    my ($dummy, $netapp, $netappDir, $dummy, $instructor, $cid, $dummy2, $learner, $assessment) = split(/\//, $data->{pathToFile});
    my $pretestName  = $data->{pretest_name};
    my $pathToCourse = "/$netapp/$netappDir/educator/$instructor/$cid";

    my $assessmentsExemted = $data->{assessments_exempted};
    my $exemptedSuccessfully = 0;

warn("handleException, ", $assessmentsExemted);
    my $entry = $data->{entry};

    foreach my $assessment (@{ $entry->{assessments_to_ex} }) {

        my $thePath = "/$netapp/$netappDir/educator/$instructor/$cid/$assessment->{path}/$assessment->{index}.txt";
        my $nameOfAssessmentInCourse = getBasicAssessmentName(path => $thePath);

        if ($assessment->{name} eq $nameOfAssessmentInCourse) {

            #warn "should exempt: $assessment->{name}";
            push(@$assessmentsExemted, $assessment->{name});
            setAssessmentIsExempt($netapp, $netappDir, $instructor, $cid, $assessment->{path}, $assessment->{index}, $learner, 1, "Mastery of content and skills were demonstrated on $pretestName", 1);
            $exemptedSuccessfully = 1;
        } else {
            warn "Assessment names do not match for list of assessments to ex: $thePath - $assessment->{name} - $nameOfAssessmentInCourse";
        }

    }

    # read in existing data

    if ( ($exemptedSuccessfully || scalar @{ $entry->{assessments_to_ex} } == 0 ) && ($entry->{lessons_to_skip})) {
        my $exemptedPagesStruc;
        my $enrollments = Packages::E1::E1MongoObject::Enrollments->new(netapp => $netapp, dir => $netappDir);
        $enrollments->direct_connect();
    
        # First, query the enrollment document from your collection
        my $enrollment  = $enrollments->find_enrollment(instructor => $instructor, cid => $cid, student => $learner);
        # Check if the enrollment exists in the collection
        warn($enrollment);
        if ($enrollment) {
            # Get the exempted lessons json string from the enrollment document
            $exemptedPagesStruc = $enrollment->{exemptedLessons};
             warn("exemptedPagesStruc", $exemptedPagesStruc);
            if ($@) {
                warn("cannot decode JSON string for enrollment: $cid, $instructor, $learner");
                # return;
            }

            # Copy ignored lessons into existing structure
            foreach my $lessonToSkip (@{ $entry->{lessons_to_skip} }) {
                $exemptedPagesStruc->{$lessonToSkip} = 1;
            }

            # Write out updated lessons to exempt to the enrollment document
            if ($exemptedPagesStruc) {
                enrollments->add_exempted_lessons( instructor => $instructor, cid => $cid, student => $learner, exemptedLessons=> $exemptedPagesStruc );
                                                   
            }
        }
    }
    
    return $assessmentsExemted;
}

sub checkExam {
    my (%data) = @_;

    my $pathToFile = $data{path};
    my $event      = $data{event};
    my $assessmentsExemted;
    my $storedPretestName;
    my @studentPageNames;

    my %activeCourses = (
        'jarnstein1_3921'   => 1,
        'sking222_4028'     => 1,
        'amacy3_3803'       => 1,
        'arobinson143_2489' => 1,    # <-- remove this before rollout
    );

    my ($dummy, $netapp, $netappDir, $dummy, $instructor, $cid, $dummy2, $learner, $assessment) = split(/\//, $pathToFile);
    my $rules_proxy = Packages::E1::E1MongoCacheProxy->new( netapp => $ENV{GENERAL_MDB_PREFIX}, dir => 'general', collection => 'auto_exemption_rules' );
    #return if ($activeCourses{ $instructor . '_' . $cid } != 1);
    
    if (($assessment =~ /^exam/) || ($assessment =~ /^assignment/)) {

        my $pathToCourse        = "/$netapp/$netappDir/educator/$instructor/$cid";
        warn("Path:", $pathToCourse, $cid);
        my $exemption_data = $rules_proxy->queue_read_query_json( condition => {courseId => $cid }, method => 'find_one', projection => {'_id' => 0, 'courseId' => 0, 'updatedOn' => 0,} );

        warn($exemption_data);
        if ($exemption_data) {

            if ($@) {
                warn("cannot read auto exemption json:  $cid");
                return;

                # error reading JSON
            } else {

                # first check to see if submitted exam is pretest in structure
                # strip out the extra data and get to the index
                warn("CHECK:", autoExemotionsTurnedOn(usage => $exemption_data->{usage}, dir => $netappDir, instructor => $instructor));
                if (!autoExemotionsTurnedOn(usage => $exemption_data->{usage}, dir => $netappDir, instructor => $instructor)) {

                    # warn (" ---> auto exemptions off! <--- ");
                    return;
                }

                my $submittedIndex = $assessment;

                my $assessmentType = "";

                $assessmentType = "exam" if ($submittedIndex =~ s/^exam//);
                $submittedIndex =~ s/\.txt$//;

                $assessmentType = "assignment" if ($submittedIndex =~ s/^assignment//);
                $submittedIndex =~ s/\.feedback$//;

                my $pathToExamTemplate;
                my @examTemplate;

                my $JSONSubmittedIndex = $assessmentType . '_' . $submittedIndex;
                warn($JSONSubmittedIndex);
                if (exists($exemption_data->{$JSONSubmittedIndex})) {

                    #warn("assessment in pretest list: $pathToFile");

                    # now read in the assessment design...

                    if ($assessmentType eq "exam") {

                        $pathToExamTemplate = "$pathToCourse/exams/$submittedIndex.txt";
                        open(FILE, $pathToExamTemplate);
                        @examTemplate = <FILE>;
                        close(FILE);

                    } elsif ($assessmentType eq "assignment") {

                        $pathToExamTemplate = "$pathToCourse/assignments/$submittedIndex.txt";
                        open(FILE, $pathToExamTemplate);
                        @examTemplate = <FILE>;
                        close(FILE);

                    } else {
                        warn("Invalid assessment type sent to checkExam: $assessmentType");
                        return;
                    }
                    warn(getBasicAssessmentName(path => $pathToExamTemplate));
                    warn($event);
                    if (getBasicAssessmentName(path => $pathToExamTemplate) eq $exemption_data->{$JSONSubmittedIndex}->{pretest_name}) {
                        if ($event eq 'ASSESSMENT_RESET') {

                            # this is a reset - remove exetion if they exist
                            # for all associated assessments

                            #foreach my $entry (@{ $exemption_data->{$JSONSubmittedIndex}->{exemption_data} }) {
                            foreach my $key (keys %{ $exemption_data->{$JSONSubmittedIndex}->{exemption_data} }) {
                                my $entry = $exemption_data->{$JSONSubmittedIndex}->{exemption_data}->{$key};

                                my $pathToAssessment = $pathToExamTemplate;

                                # my $pathToAssessment = "/$netapp/$netappDir/educator/$instructor/$cid/$assessmentType" . 's' . "$assessment->{index}.txt";
                                my $assessmentName = getBasicAssessmentName(path => $pathToAssessment);

                                # make sure the pretest (or assignment) name stored in the auto exempt json matches
                                # what is expected for that particular assessment index in the course shell.
                                # if not we don't want to change anything as the assessments are misaligned
                                # relative to the master

                                if ($assessmentName eq $exemption_data->{$JSONSubmittedIndex}->{pretest_name}) {

                                    # check the group requirements
                                    my $shouldExempt = 1;

                                    #now actually do the exemption
                                    if ($shouldExempt) {
                                        foreach my $exAssessmentEntry (@{ $entry->{assessments_to_ex} }) {

                                            # Check names of assessments to be un-exempted.  Make sure the
                                            # names stored in the JSON file match what is expected.  If not
                                            # there is a misalignment

                                            my $thePath = "/$netapp/$netappDir/educator/$instructor/$cid/$exAssessmentEntry->{path}/$exAssessmentEntry->{index}.txt";
                                            my $nameOfAssessmentInCourse = getBasicAssessmentName(path => $thePath);

                                            if ($exAssessmentEntry->{name} eq $nameOfAssessmentInCourse) {

                                                # warn "removing exemption exempt: $assessment->{name}";
                                                setAssessmentIsExempt($netapp, $netappDir, $instructor, $cid, $exAssessmentEntry->{path}, $exAssessmentEntry->{index}, $learner, 0, "Exemption Removed", 1);
                                                
                                            } else {
                                                warn "Assessment names do not match for list of assessments to un-ex: $exAssessmentEntry->{name} - $nameOfAssessmentInCourse";
                                            }

                                        }

                                        # read in existing data
                                        my $exemptedPagesStruc;
                                        if ($entry->{lessons_to_skip}) {
                                             # First, query the enrollment document from your collection
                                            my $enrollments = Packages::E1::E1MongoObject::Enrollments->new(netapp => $params{netapp}, dir => $params{dir});
                                            $enrollments->direct_connect();
    
                                            # First, query the enrollment document from your collection
                                            my $enrollment  = $enrollments->find_enrollment( instructor => $instructor, cid => $cid, student => $learner );
                                        
                                            if ($enrollment) {
                                                $exemptedPagesStruc = $enrollment->{exemptedLessons};
                                                if ($@) {
                                                    warn("cannot read enrollment for:", $cid, $instructor, $learner);

                                                    # return;

                                                }

                                            }

                                            #copy ignored lessons into existing struc

                                            foreach my $lessonToSkip (@{ $entry->{lessons_to_skip} }) {
                                                $exemptedPagesStruc->{$lessonToSkip} = 0;
                                            }

                                            # write out lessons to exempt
                                            if ($exemptedPagesStruc) {
                                                enrollments->add_exempted_lessons( instructor => $instructor, cid => $cid, student => $learner, exemptedLessons=> $exemptedPagesStruc );
                                                    
                                            }

                                        }
                                    }

                                } else {
                                    warn "Assessment names do not match for removal of auto exemptions: $assessmentName - $exemption_data->{$JSONSubmittedIndex}->{pretest_name}";
                                }

                            }
                        } else {

                            # now we know it is a pretest - we need to read
                            # in all the question answers
                            # left off here!

                            

                            if ($assessmentType eq "exam") {

                                open(FILE, $pathToFile);
                                my @rawAnsweredQuestions = <FILE>;
                                close(FILE);

                                # pop off the date time stuff
                                shift(@rawAnsweredQuestions);

                                shift(@examTemplate);

                                my $examResults;

                                #my @correctGroups = getCorrectGroups(submission => \@rawAnsweredQuestions, template => \@examTemplate);

                                {
                                    no strict 'vars';

                                    require "/subroutines/questionanswerdata.pl";

                                    local ($quell, $shellRoot, $dir, $username, $student, $courseid, $type, $key, $realscore, $maxscore, $manualscore, @gradebuilderstuff, $sizegradebuilderstuff, $gradebuildercontribution, $contribution, $extracredit, $honors, $assessmentstatus, $workiscompleted, $myTerm, $timesubmitted, $requestgrade);

                                    $shellRoot = $netapp;
                                    $dir       = $netappDir;
                                    $quell     = $instructor;
                                    $username  = $instructor;
                                    $student   = $learner;
                                    $courseid  = $cid;
                                    $type      = 'exam';
                                    $key       = $submittedIndex;
                                    $realscore = 0;

                                    #this calls the old getscore routine from the gradebook.pl lib

                                    $examResults = getscore();

                                }

                                my $correctGroups = getCorrectGroups(result => $examResults, template => \@examTemplate);
                                warn Dumper $correctGroups;
                                # now check for exemption triggers

                                # foreach my $entry (@{ $exemption_data->{$JSONSubmittedIndex}->{exemption_data} }) {
                                foreach my $key (keys %{ $exemption_data->{$JSONSubmittedIndex}->{exemption_data} }) {
                                    my $entry = $exemption_data->{$JSONSubmittedIndex}->{exemption_data}->{$key};
                                   
                                    # check the group requirements
                                    my $shouldExempt = 1;
                                    foreach my $groupRequirement (@{ $entry->{exam_group_requirements} }) {
                                        if ($groupRequirement->{required} eq 'all') {
                                            if ($correctGroups->{ $groupRequirement->{group} }->{all_correct} != 1) {
                                                 warn("IF");

                                                $shouldExempt = 0;
                                            }
                                        } else {
                                                 warn("ELSE", $correctGroups->{ $groupRequirement->{group} }->{correct_count}, $groupRequirement->{required});

                                            if ($correctGroups->{ $groupRequirement->{group} }->{correct_count} < $groupRequirement->{required}) {
                                                $shouldExempt = 0;
                                            }
                                        }
                                    }

                                    #now actually do the exemption
                                    if ($shouldExempt) {
                                        $assessmentsExemted = handleExemptions({ entry => $entry, pathToFile => $pathToFile, pretest_name => $exemption_data->{$JSONSubmittedIndex}->{pretest_name}, assessments_exempted=>$assessmentsExemted});
                                        $storedPretestName = $exemption_data->{$JSONSubmittedIndex}->{pretest_name};

                                        foreach my $studentPageName (@{ $entry->{standards} }) {
                                            push(@studentPageNames, $studentPageName);
                                        }
                                        #push(@$assessmentsExemted, $exemption_data->{$JSONSubmittedIndex}->{pretest_name}); warn ("added2: $exemption_data->{$JSONSubmittedIndex}->{pretest_name}");
                                    }

                                }
                            } elsif ($assessmentType eq "assignment") {

                                my $assignmentresults;
                                my $shouldExempt = 0;

                                #my @correctGroups = getCorrectGroups(submission => \@rawAnsweredQuestions, template => \@examTemplate);

                                {
                                    no strict 'vars';

                                    require "/subroutines/questionanswerdata.pl";

                                    local ($quell, $shellRoot, $dir, $username, $student, $courseid, $type, $key, $realscore, $maxscore, $manualscore, @gradebuilderstuff, $sizegradebuilderstuff, $gradebuildercontribution, $contribution, $extracredit, $honors, $assessmentstatus, $workiscompleted, $myTerm, $timesubmitted, $requestgrade);

                                    $shellRoot = $netapp;
                                    $dir       = $netappDir;
                                    $quell     = $instructor;
                                    $username  = $instructor;
                                    $student   = $learner;
                                    $courseid  = $cid;
                                    $type      = 'assignment';
                                    $key       = $submittedIndex;
                                    $realscore = 0;

                                    #this calls the old getscore routine from the gradebook.pl lib

                                    $assignmentresults = getscore();

                                    #warn Dumper $assignmentresults;

                                }

                                #foreach my $entry (@{ $exemption_data->{$JSONSubmittedIndex}->{exemption_data} }) {
                                foreach my $key (keys %{ $exemption_data->{$JSONSubmittedIndex}->{exemption_data} }) {
                                    my $entry = $exemption_data->{$JSONSubmittedIndex}->{exemption_data}->{$key};
                                    if (defined($assignmentresults->{manual_score}) && defined($entry->{assignment_total_requirement}) && $entry->{assignment_total_requirement} > 0) {
                                        if ($assignmentresults->{manual_score} >= $entry->{assignment_total_requirement}) {
                                            $shouldExempt = 1;
                                        }

                                    } elsif (defined($entry->{rubric_requirements})) {
                                        foreach my $rubricRequirement (@{ $entry->{rubric_requirements} }) {

                                            # warn("Comparing: $assignmentresults->{rubrics}->{ $rubricRequirement->{rubric_name} }, $rubricRequirement->{required}");

                                            if ($assignmentresults->{rubrics}->{ $rubricRequirement->{rubric_name} } >= $rubricRequirement->{required}) {
                                                $shouldExempt = 1;
                                            } else {
                                                $shouldExempt = 0;
                                                last;
                                            }
                                        }
                                    } else {

                                        #                                         warn("nowhere");
                                        #                                         warn "damn index: $JSONSubmittedIndex";
                                        #                                         warn Dumper $entry->{rubric_requirements};
                                        #                                         warn Dumper $assignmentresults;
                                    }

                                    if ($shouldExempt) {
                                        $assessmentsExemted = handleExemptions({ entry => $entry, pathToFile => $pathToFile, pretest_name => $exemption_data->{$JSONSubmittedIndex}->{pretest_name}, assessments_exempted=>$assessmentsExemted});
                                         $storedPretestName = $exemption_data->{$JSONSubmittedIndex}->{pretest_name};

                                        foreach my $studentPageName (@{ $entry->{standards} }) {
                                            push(@studentPageNames, $studentPageName);
                                        }
                                        #warn("Exmpting: $entry->{name}");

                                        #                                warn(Dumper $assignmentresults);
                                        #push(@$assessmentsExemted, $assessment->{name}); warn ("added: $assessment->{name}");
                                        #push(@$assessmentsExemted, $exemption_data->{$JSONSubmittedIndex}->{pretest_name}); warn ("added: $exemption_data->{$JSONSubmittedIndex}->{pretest_name}");

                                        #                                 setAssessmentIsExempt($netapp, $netappDir, $instructor, $cid, $assessment->{path}, $assessment->{index}, $learner, 1, "Auto Exempted based on work done in $exemption_data->{$submittedIndex}->{pretest_name}", 1);
                                    } else {

                                        #warn("NOT Exmpting:  $entry->{name}");
                                    }
                                }

                            } else {
                                warn("Invalid assessment type sent to checkExam for setting grade: $assessmentType");
                                return;
                            }

                        }
                    } else {
                        warn("pretest name does not match file template $pathToExamTemplate - " . getBasicAssessmentName(path => $pathToExamTemplate) . ' - ' . $exemption_data->{$JSONSubmittedIndex}->{pretest_name});
                    }
                } else {

                   warn("assessment not in pretest list: $submittedIndex");
                }

            }

        } else {

            # there is no json file - - no need to check further
            return;
        }
    } else {

        # the submitted item was NOT an exam - no need to check further
        return;

    }

    if ($assessmentsExemted || scalar @studentPageNames > 0 ) {
       # my $pretestName = getBasicAssessmentName(path => $pathToExamTemplate);
        my $studentInfo = getStudentInfo(netapp => $netapp, dir => $netappDir, instructor => $instructor, cid => $cid, learner => $learner);
        my $alltests;


        foreach my $exempted (sort @$assessmentsExemted) {
            $alltests .= "$exempted<br>";
        }

        if (scalar(@studentPageNames) > 0) {
            foreach my $studentPageName (sort @studentPageNames) {
                $alltests .= "$studentPageName<br>";
            }
        }

        my $domain = getDomain();
        my $emailText = <<emailText;
<p>
Dear $studentInfo->{fname},<br>
<br>
Nice work on the $storedPretestName!<br>
<br>
Your results show that you have already mastered the content on the following lesson page(s) and assessment:<br>
<br>
$alltests
<br>
<strong>What do my pretest results mean?</strong><br>
<br>
You successfully answered several questions on your pretest. This shows that you already have some or all the skills taught in the lesson. The lesson pages you do not have to read will have a message at the top that looks like this:<br>
<br>
<img src="https://$domain/codeExtra/images/mastery_of_skills.adf7d157.jpg" height="428" width="561" alt="Shows the message to expect on the lesson pages as 'You showed master of the skills taught on this page in your lesson pretest. You may move to the next page of the lesson.'">
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
</p>
emailText

$emailText = encode_qp($emailText);

        open(MAIL, "| /usr/sbin/sendmail -t");
        print MAIL "From: donotreply\@" . getDomain() . "\n";
        print MAIL "Subject: $storedPretestName: Eligible Exemptions\n";
        print MAIL "Content-Type: text/html; charset=ISO-8859-1\n";
        print MAIL "Content-Transfer-Encoding: quoted-printable\n";
        print MAIL "MIME-Version: 1.0\n";
        print MAIL "To: $studentInfo->{email}";
        print MAIL "\n";
        print MAIL "$emailText\n";
        close(MAIL);
    }
}