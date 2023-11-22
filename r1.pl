#!/usr/local/bin/perl

use strict;
use JSON;
use CGI;
use Data::Dumper;
use HTML::Entities;
use Packages::E1::MCHeader;
use Try::Tiny;
use Packages::E1::E1MongoCacheProxy::ProfileCacheProxy;
use Packages::TempZeroUtils;

#use Packages::E1::File::IO;
#use Time::HiRes qw( tv_interval  clock_gettime gettimeofday);

my $debugMC       = 0;
my $useMC         = 1;
my $localServerMC = 0;
my $io;
my $includeLinks = 1;    # this should be passed in as a param in the future

my $mpos;
my $spos;
my $theSLT;

my $assTypeIndexes = { exams => 0, assignments => 1, worksheets => 2, quizzes => 3 };
my @assTypes        = ( "exams", "assignments", "worksheets", "quizzes" );
my @assTypePrefixes = ( "exam",  "assignment",  "worksheet",  "quiz" );

#my @feedbackFiles=("examform.cgi","assignmentfeedback.cgi","worksheetsetup.cgi","quizform.cgi");
my @feedbackFiles = ( "examform.cgi", "assignmentfeedback.cgi", "worksheetsetup.cgi", "quizform.cgi" );

#require "/subroutines/mcheader.cgi";
require "/subroutines/gradebook.cgi";

sub getAssessmentDirectory {
    my $index = shift;

    if ( $index < scalar @assTypes ) {
        return $assTypes[$index];
    } else {
        return "";
    }

}
#convert below sub getStudentRosterHash to nodejs   
#sub getStudentRosterHash {
# gets hash of roster and honors Data

sub getStudentRosterHash {

    my ( $netapp, $theDir, $instructor, $cid ) = @_;
    my %returnHash;
    my $fullName;
    my @sortedNameArray;
    my $sortFormattedName;

    my $pathToRoster = "/$netapp/$theDir/educator/$instructor/$cid/roster.txt";

    my @roster = Packages::E1::MCHeader::GetFileData($pathToRoster);
    $fullName = "";

    foreach my $rosterEntry (@roster) {
        chomp($rosterEntry);
        my @rosterField = split( /\*/, $rosterEntry );

        # dmcmanamon1*dmcmanamon1**Danielle**McManamon

        my $accountName = $rosterField[0];

        $fullName .= $rosterField[5] . ", " if ( $rosterField[5] ne "" );
        $fullName .= $rosterField[2] . " "  if ( $rosterField[2] ne "" );
        $fullName .= $rosterField[3] . " "  if ( $rosterField[3] ne "" );
        $fullName .= $rosterField[4]        if ( $rosterField[4] ne "" );

        # need to create this sorted name array so the names go
        # back to the client in the correct order if they are
        # selecting a subset of accounts

        $sortFormattedName = lc($fullName) . "*" . $rosterField[0];
        push( @sortedNameArray, $sortFormattedName );

        my $pathToProfile = "/$netapp/$theDir/educator/$instructor/$cid/students/$accountName/profile.txt";
        my @profile       = Packages::E1::MCHeader::GetFileData($pathToProfile);
        my @profileField  = split( /\*/, $profile[0] );

        chomp(@profileField);

        #print STDERR "$pathToProfile\n";

        if ( $profileField[11] eq "1" ) {
            $fullName .= " (H)";
        }

        $returnHash{ $rosterField[0] }->{name}   = encode_entities($fullName);
        $returnHash{ $rosterField[0] }->{honors} = $profileField[11];            # include honors flag in data
                                                                                 #$returnHash{$rosterField[0]}->{semester}=$profileField[10]; # include segment in data

        # new semester calculation

        require "/subroutines/educator.pl";

        my %profileParams;

        $profileParams{shellRoot}    = $netapp;
        $profileParams{dir}          = $theDir;
        $profileParams{instructorId} = $instructor;
        $profileParams{courseId}     = $cid;
        $profileParams{username}     = $accountName;

        $returnHash{ $rosterField[0] }->{semester} = getStudentSegmentString( \%profileParams );

        #end semester calculation

        @sortedNameArray = sort(@sortedNameArray);

        $fullName = "";
    }

    return ( \%returnHash, \@sortedNameArray );

}

sub getPathToAssessment {
    my ( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) = @_;

    my $pathToAssessment = "/$netapp/$theDir/educator/$instructor/$cid/students/$student/";

    #print " pathToAssessment = $pathToAssessment\n";

    if ( $typeIndex eq "exams" ) {
        $pathToAssessment .= "exam" . $assessmentIndex . ".txt";
    } elsif ( $typeIndex eq "assignments" ) {
        $pathToAssessment .= "assignment" . $assessmentIndex . ".feedback";
    } elsif ( $typeIndex eq "worksheets" ) {
        $pathToAssessment .= "worksheet" . $assessmentIndex . ".txt";
    } elsif ( $typeIndex eq "quizzes" ) {
        $pathToAssessment .= "quiz" . $assessmentIndex . ".txt";
    } else {
        $pathToAssessment = "/dev/null/out.txt";
    }

    return $pathToAssessment;
}

sub _getAssessment {
    my ($path) = @_;

    open FILE, $path;
    my @lines = <FILE>;
    close FILE;

    return @lines;

}

sub _setAssessment {
    my ( $path, @lines ) = @_;

    open FILE, ">$path";
    foreach my $line (@lines) {
        print FILE "$line";

    }
    close FILE;
    chmod( 0660, $path );

}

sub _setExamInstructorComments {
    my ( $path, $comment ) = @_;
    my ( $JSON, $json_text, $dataHash );
    $JSON = new JSON;

    if ( -e $path ) {
        open my $fh, '<', $path;
        my $rawJSONData = do { local $/; <$fh> };
        eval { $dataHash = $JSON->decode($rawJSONData); };
        close $fh;
    }

    if ( $comment eq 'DELETE ME-UCOMPASS' ) {
        delete( $dataHash->{instructorComments} );
    } else {
        $dataHash->{instructorComments} = $comment;
    }

    $json_text = $JSON->shrink->encode($dataHash);

    open my $fh, ">" . $path;
    print $fh $json_text;
    close $fh;
    chmod( 0660, $path );
}

#Submission*1360846104*Scramble Grouped*1367510821*ex*1367510821**
#Submission*1360846104*Scramble Grouped**ex*1367510653**
#Submission*1360846104*Scramble Grouped*1367511078*ex*1367511078**

#$rubriccategories=$xx[7];
#rub test***Active*20*357**3*cat 1~10~1%cat 2~15~2%cat 3~20~3%*4*Unlimited*,
#45%~~1%~~2%~~3%~~%***

sub exemptAllStudentAssessmentInCourse {
    my ( $netapp, $theDir, $instructor, $cid, $student ) = @_;

    my $gbArray = getGradeBuilderArray( $netapp, $theDir, $instructor, $cid );
    my $objectIDs = getObjectIDHash( $netapp, $theDir, $instructor, $cid );

    #print Dumper $gbArray;
    #print Dumper $objectIDs;

    foreach my $gradebuilderItem (@$gbArray) {
        if ( exists( $objectIDs->{ $gradebuilderItem->{objectID} } ) ) {
            my $object     = $objectIDs->{ $gradebuilderItem->{objectID} };
            my $theAssType = $assTypes[ $object->{type} ];

            setAssessmentIsExempt( $netapp, $theDir, $instructor, $cid, $theAssType, $object->{itemIndex}, $student, 1, "AutoeEX all student's assessments", 1 );

        } else {
            print STDERR "Cannot find onject : $netapp, $theDir, $instructor,$cid, $gradebuilderItem->{objectID}\n";
        }

    }
}

##Sets any assessment to exempt
#Convert below code to nodejs   
sub setAssessmentIsExempt {
    my ( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student, $shouldExempt, $comment, $ignoreIfSubmissionExists ) = @_;

    if ( length($comment) ) {

        $comment =~ tr/+/ /;
        $comment =~ s/%([a-fA-F0-9][a-fA-F0-9])/pack("C",hex($1))/eg;
        $comment =~ s/<!--(.|\n)*-->//g;

        $comment =~ s/\*/\&\#42\;/g;
        $comment =~ s/\%/\&\#37\;/g;
        $comment =~ s/\~/\&\#126\;/g;
    }

    my $pathToAssessment = getPathToAssessment( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student );

    my @lines;
    my @headers;
    my $curTime             = time();
    my $updateGradesChanged = 0;
    my $debug               = 0;
    my $currtime            = time();
    my $domain              = $ENV{'HTTP_HOST'};

    if ( $typeIndex eq "exams" ) {
        if ( $shouldExempt == 1 ) {
            if ( -e $pathToAssessment ) {
                if (   ( !assessmentIsExempt( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) )
                    && ( !assessmentIsManuallyGraded( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) )
                    && ( ( $ignoreIfSubmissionExists == 0 ) || ( !assessmentHasBeenAccessed( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) ) ) )
                {
                    @lines = _getAssessment($pathToAssessment);
                    @headers = split( /\*/, $lines[0] );

                    $headers[0] = 'Submission';
                    $headers[4] = 'ex';
                    $headers[5] = $curTime;

                    $lines[0] = join( '*', @headers );
                    _setAssessment( $pathToAssessment, @lines );
                    $updateGradesChanged = 1;
                    print STDERR "Exempting: $pathToAssessment\n" if ($debug);

                }
            } else {
                $lines[0] = "Submission****ex*$curTime**\n";
                _setAssessment( $pathToAssessment, @lines );
                $updateGradesChanged = 1;
                print STDERR "Exempting: $pathToAssessment\n" if ($debug);

            }
            my $pathToJSON = $pathToAssessment;
            $pathToJSON =~ s/\.txt$/.json/m;
            _setExamInstructorComments( $pathToJSON, $comment );
        } else {

            # we want to remove the ex ONLY if the submission already exists and
            # the submission currently has an "ex" in it.
            if ( assessmentIsExempt( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) ) {
                print STDERR "Unexempting: $pathToAssessment\n" if ($debug);

                @lines = _getAssessment($pathToAssessment);
                if ( scalar @lines > 1 ) {
                    @headers = split( /\*/, $lines[0] );

                    $headers[0] = 'Submission';
                    $headers[4] = '';
                    $headers[5] = "";

                    $lines[0] = join( '*', @headers );
                    _setAssessment( $pathToAssessment, @lines );
                    $updateGradesChanged = 1;
                } else {

                    ### NEW FLVS GRADEBOOK API ###
                    if ( ( ( $domain !~ /^(fatdec|tolland)/ ) && ( $domain =~ /flvs\.net/ ) || ( $domain =~ /dev\.educator\.flvs\.net$/ ) || ( $domain =~ /testlearn\.educator\.flvs\.net$/ ) ) && ( $cid > 0 ) ) {
                        require "/subroutines/flvsexport/integrationAPI.pl";
                        recordEvent(
                            path  => $pathToAssessment,
                            event => "ASSESSMENT_RESET"
                        );

                    }
                    ### END FLVS GRADEBOOK API ###

                    unlink($pathToAssessment);
                    $updateGradesChanged = 1;
                }
                my $pathToJSON = $pathToAssessment;
                $pathToJSON =~ s/\.txt$/.json/m;
                _setExamInstructorComments( $pathToJSON, 'DELETE ME-UCOMPASS' );
            }
        }
    } elsif ( $typeIndex eq "assignments" ) {
        if ( $shouldExempt == 1 ) {
            if (   ( !assessmentIsExempt( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) )
                && ( !assessmentIsManuallyGraded( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) )
                && ( ( $ignoreIfSubmissionExists == 0 ) || ( !assessmentHasBeenAccessed( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) ) ) )
            {
                # need to find out if there are rubrics
                my $pathToAssignmentDefinition = "/$netapp/$theDir/educator/$instructor/$cid/assignments/$assessmentIndex.txt";
                open FILE, $pathToAssignmentDefinition;
                my @lines = <FILE>;
                close FILE;
                my @fields = split( /\*/, $lines[0] );
                my $rubCatCount = $fields[7];
                if ( $rubCatCount eq "" ) {
                    $rubCatCount = 0;
                }

                my $rubricSpecs = "";
                for ( my $i = 1; $i <= $rubCatCount; $i++ ) {
                    $rubricSpecs .= '%~~' . $i;
                }
                if ( $rubricSpecs ne "" ) {
                    $rubricSpecs .= '%~~%';
                }

                if ( -e $pathToAssessment ) {
                    @lines      = _getAssessment($pathToAssessment);
                    @headers    = split( /\*/, $lines[0] );
                    $headers[0] = 'ex' . $rubricSpecs;

                    if ( length($comment) ) {
                        my $tempStr;
                        $tempStr = $headers[1];
                        $tempStr .= "<br>$comment";

                        $headers[1] = $tempStr;
                    }

                    $lines[0] = join( '*', @headers );
                } else {
                    $lines[0] = "ex$rubricSpecs*$comment**\n";
                }
                _setAssessment( $pathToAssessment, @lines );
                print STDERR "Exempting: $pathToAssessment\n" if ($debug);
                $updateGradesChanged = 1;
            }
        } else {
            if ( assessmentIsExempt( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) ) {
                print STDERR "Unexempting: $pathToAssessment\n" if ($debug);
                @lines = _getAssessment($pathToAssessment);
                @headers = split( /\*/, $lines[0] );

                chomp( $headers[3] );
                if ( $headers[3] eq 'yes' ) {

                    # if the student did submit for grading we just want to remove the manual grade
                    # and leave everything else alone
                    $headers[0] =~ s/^ex//;
                    $lines[0] = join( '*', @headers );
                    _setAssessment( $pathToAssessment, @lines );
                    $updateGradesChanged = 1;
                } else {

                    # otherwise if the student did not submit for
                    # grading just remove the submission record

                    ### NEW FLVS GRADEBOOK API ###
                    if ( ( ( $domain !~ /^(fatdec|tolland)/ ) && ( $domain =~ /flvs\.net/ ) || ( $domain =~ /dev\.educator\.flvs\.net$/ ) ) && ( $cid > 0 ) ) {
                        require "/subroutines/flvsexport/integrationAPI.pl";
                        recordEvent(
                            path  => $pathToAssessment,
                            event => "ASSESSMENT_RESET"
                        );

                    }
                    ### END FLVS GRADEBOOK API ###

                    unlink($pathToAssessment);
                    $updateGradesChanged = 1;
                }
            }
        }
    } elsif ( $typeIndex eq "worksheets" ) {
        if ( $shouldExempt == 1 ) {
            if ( -e $pathToAssessment ) {
                if (   ( !assessmentIsExempt( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) )
                    && ( !assessmentIsManuallyGraded( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) )
                    && ( ( $ignoreIfSubmissionExists == 0 ) || ( !assessmentHasBeenAccessed( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) ) ) )
                {
                    @lines = _getAssessment($pathToAssessment);
                    @headers = split( /\*/, $lines[0] );

                    $headers[0] = 'final';
                    $headers[3] = 'ex';

                    #                   $headers[5] = $curTime;

                    # if the exam was never submitted we want to set that time as well
                    if ( $headers[1] eq "" ) {
                        $headers[1] = $curTime;
                    }
                    $lines[0] = join( '*', @headers );

                    chomp( $lines[0] );
                    $lines[0] .= "\n";
                    _setAssessment( $pathToAssessment, @lines );
                    $updateGradesChanged = 1;
                    print STDERR "Exempting: $pathToAssessment\n" if ($debug);
                }
            } else {
                $lines[0] = "final*$curTime**ex\n";

                _setAssessment( $pathToAssessment, @lines );
                $updateGradesChanged = 1;
                print STDERR "Exempting: $pathToAssessment\n" if ($debug);
            }
        } else {

            # we want to remove the ex ONLY if the submission already exists and
            # the submission currently has an "ex" in it.
            if ( assessmentIsExempt( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) ) {
                @lines = _getAssessment($pathToAssessment);

                # figure out if worksheet is empty - this is
                # trickier than exams.  blank questions entered
                #even when teacher grades unsbmiited work.

                my $shouldRemove = 1;

                my $storedLine = $lines[0];

                my @tempLines = @lines;

                shift(@tempLines);    # ignore the header line!
                foreach my $line (@tempLines) {
                    $line =~ s/\*//g;
                    $line =~ s/\s//g;
                    if ( $line ne "" ) {
                        $shouldRemove = 0;
                    }

                }

                if ( !$shouldRemove ) {
                    @headers = split( /\*/, $storedLine );

                    #$headers[0] = 'Submission';
                    $headers[3] = '';

                    #$headers[5] = "";

                    $lines[0] = join( '*', @headers );
                    $lines[0] .= "\n";
                    _setAssessment( $pathToAssessment, @lines );
                    $updateGradesChanged = 1;
                } else {

                    ### NEW FLVS GRADEBOOK API ###
                    if ( ( ( $domain !~ /^(fatdec|tolland)/ ) && ( $domain =~ /flvs\.net/ ) || ( $domain =~ /dev\.educator\.flvs\.net$/ ) ) && ( $cid > 0 ) ) {
                        require "/subroutines/flvsexport/integrationAPI.pl";
                        recordEvent(
                            path  => $pathToAssessment,
                            event => "ASSESSMENT_RESET"
                        );

                    }
                    ### END FLVS GRADEBOOK API ###

                    unlink($pathToAssessment);

                    # need to remove feedback file too

                    my $pathToFeedback = $pathToAssessment;
                    $pathToFeedback =~ s/\.txt$/\.feedback/;
                    unlink($pathToFeedback);
                    $updateGradesChanged = 1;

                }

                print STDERR "Unexempting: $pathToAssessment\n" if ($debug);
            }
        }
    } elsif ( $typeIndex eq "quizzes" ) {

    }

    #   my ($netapp, $theDir, $instructor,$cid,$typeIndex,$assessmentIndex,$student,$shouldExempt)= @_;

    ### NEW FLVS GRADEBOOK API ###
    if ( ( ( $domain !~ /^(fatdec|tolland)/ ) && ( $domain =~ /flvs\.net/ ) || ( $domain =~ /dev\.educator\.flvs\.net$/ ) ) && ( $cid > 0 ) && ($updateGradesChanged) ) {

        require "/subroutines/flvsexport/integrationAPI.pl";

        recordEvent(
            path  => $pathToAssessment,
            event => "ASSESSMENT_GRADED"
        );

    }
    ### END FLVS GRADEBOOK API ###

}

##check if assessment needs to exempt
sub assessmentIsExempt {
    my ( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) = @_;

    my $pathToAssessment = getPathToAssessment( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student );

    if ( $typeIndex eq "exams" ) {
        if ( -e $pathToAssessment ) {
            open FILE, $pathToAssessment;
            my @lines = <FILE>;
            close FILE;
            my @headers = split( /\*/, $lines[0] );
            if ( lc( $headers[4] ) eq 'ex' ) {
                return 1;
            }

        }

    } elsif ( $typeIndex eq "assignments" ) {

        if ( -e $pathToAssessment ) {
            open FILE, $pathToAssessment;
            my @lines = <FILE>;
            close FILE;
            my @headers = split( /\*/, $lines[0] );

            $headers[0] = lc( $headers[0] );

            if ( $headers[0] =~ /^ex/ ) {
                return 1;
            }

        }
    } elsif ( $typeIndex eq "worksheets" ) {

        if ( -e $pathToAssessment ) {

            open FILE, $pathToAssessment;
            my @lines = <FILE>;
            close FILE;
            my @headers = split( /\*/, $lines[0] );
            chomp( $headers[3] );
            if ( lc( $headers[3] ) eq 'ex' ) {

                return 1;
            }

        }

    } elsif ( $typeIndex eq "quizzes" ) {
        if ( -e $pathToAssessment ) {

            open FILE, $pathToAssessment;
            my @lines = <FILE>;
            close FILE;
            my @headers = split( /\*/, $lines[0] );
            chomp( $headers[4] );
            if ( lc( $headers[4] ) eq 'ex' ) {

                return 1;
            }
        }
    }

    return 0;

}

sub assessmentIsTempZero {
    return 0;
}

sub setAssessmentIsTempZero {
    return 1;
}

sub assessmentHasBeenAccessed {
    my ( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) = @_;

    my $pathToAssessment = getPathToAssessment( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student );

    if ( -e $pathToAssessment ) {
        return 1;
    }

    return 0;
}

sub assessmentIsManuallyGraded {
    my ( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student ) = @_;

    my $pathToAssessment = getPathToAssessment( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex, $student );

    if ( $typeIndex eq "exams" ) {
        if ( -e $pathToAssessment ) {
            open FILE, $pathToAssessment;
            my @lines = <FILE>;
            close FILE;
            my @headers = split( /\*/, $lines[0] );
            if ( lc( $headers[4] ) ne '' ) {
                return 1;
            }

        }

    } elsif ( $typeIndex eq "assignments" ) {

        if ( -e $pathToAssessment ) {
            open FILE, $pathToAssessment;
            my @lines = <FILE>;
            close FILE;
            my @headers = split( /\*/, $lines[0] );

            $headers[0] = lc( $headers[0] );

            if ( $headers[0] ne '' ) {
                return 1;
            }

        }
    } elsif ( $typeIndex eq "worksheets" ) {

        if ( -e $pathToAssessment ) {

            open FILE, $pathToAssessment;
            my @lines = <FILE>;
            close FILE;
            my @headers = split( /\*/, $lines[0] );
            chomp( $headers[3] );
            if ( lc( $headers[3] ) ne '' ) {

                return 1;
            }

        }

    } elsif ( $typeIndex eq "quizzes" ) {
        if ( -e $pathToAssessment ) {

            open FILE, $pathToAssessment;
            my @lines = <FILE>;
            close FILE;
            my @headers = split( /\*/, $lines[0] );
            chomp( $headers[4] );
            if ( lc( $headers[4] ) ne '' ) {

                return 1;
            }
        }
    }

    return 0;

}

sub getAssessmentNameFromIndex {
    my ( $netapp, $theDir, $instructor, $cid, $folderString, $assessmentIndex ) = @_;
    my $realIndex = $assTypeIndexes->{$folderString};

    return getAssessmentName( $netapp, $theDir, $instructor, $cid, $realIndex, $assessmentIndex );

}

sub getAssessmentName {
    my ( $netapp, $theDir, $instructor, $cid, $typeIndex, $assessmentIndex ) = @_;

    my $fullPathToTemplate = "/$netapp/$theDir/educator/$instructor/$cid/" . $assTypes[$typeIndex] . "/$assessmentIndex.txt";

    #print STDERR "$fullPathToTemplate\n";

    if ( -e $fullPathToTemplate ) {
        my @assessmentTemplate = Packages::E1::MCHeader::GetFileData($fullPathToTemplate);

        my $firstLine = $assessmentTemplate[0];
        my @fields = split( /\*/, $firstLine );

        return encode_entities( $fields[0] );

        #utf8::decode($fields[0]);

        #return $fields[0];
    } else {
        print STDERR "GB Assesment does not exist $fullPathToTemplate\n";

        return "Cannot find Name";
    }
}

# get gradebuilder from course and put it into array

sub getGradeBuilderArray {
    my $netapp     = shift;
    my $theDir     = shift;
    my $instructor = shift;
    my $cid        = shift;

    my @gbArray;

    my @gradebuilderstuff = Packages::E1::MCHeader::GetFileData("/$netapp/$theDir/educator/$instructor/$cid/gradebuilder.txt");

    shift(@gradebuilderstuff);    #first line is yes/no - we should ignore it

    foreach my $gbEntry (@gradebuilderstuff) {
        chomp $gbEntry;

        my @fields = split( /\:/, $gbEntry );

        my $gbHash = {};

        # 67:1:yes:2:1
        # obid, pts, extra credit, term, honors

        $gbHash->{objectID}    = $fields[0];
        $gbHash->{points}      = $fields[1];
        $gbHash->{extraCredit} = $fields[2];
        $gbHash->{term}        = $fields[3];
        $gbHash->{honors}      = $fields[4];
        push( @gbArray, $gbHash );

    }

    return ( \@gbArray );
}