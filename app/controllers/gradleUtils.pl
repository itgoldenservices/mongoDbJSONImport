
 

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

                    # if the exam was never submitted we want to set that time as well
                    if ( $headers[3] eq "" ) {
                        $headers[3] = $curTime;
                    }
                    $lines[0] = join( '*', @headers );
                    _setAssessment( $pathToAssessment, @lines );
                    $updateGradesChanged = 1;
                    print STDERR "Exempting: $pathToAssessment\n" if ($debug);

                }
            } else {
                $lines[0] = "Submission***$curTime*ex*$curTime**\n";
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

#creates array of object IDs and adds assessment names to structure as well

sub getObjectIDHash {
    my $netapp     = shift;
    my $theDir     = shift;
    my $instructor = shift;
    my $cid        = shift;

    my %objectIDHash;

    my $typeTargets = "exam assignment quiz worksheet";

    my @objects = Packages::E1::MCHeader::GetFileData("/$netapp/$theDir/educator/mailbox/$instructor/objects.txt");

    foreach my $objectEntry (@objects) {
        chomp $objectEntry;

        #29*assignment*1323662246*0001*dgomoll*3801*

        my @fields = split( /\*/, $objectEntry );

        my $theType  = $fields[1];
        my $foundCid = $fields[5];

        if ( $cid eq $foundCid ) {

            # We are only interested in the assessment types contained in $typeTargets
            # and should ignore anything else
            if ( ( $theType ne "" ) && ( $typeTargets =~ /$theType/ ) ) {

                #my $objectHash={};
                my $typeIndex;

                if    ( $theType eq "exam" )       { $typeIndex = 0; }
                elsif ( $theType eq "assignment" ) { $typeIndex = 1; }
                elsif ( $theType eq "worksheet" )  { $typeIndex = 2; }
                elsif ( $theType eq "quiz" )       { $typeIndex = 3; }
                else {
                    $typeIndex = 3;
                    print STDERR "GB: Invalid assessment type: $theType\n";
                    next;
                }

                $objectIDHash{ $fields[0] }->{type}       = $typeIndex;
                $objectIDHash{ $fields[0] }->{typeString} = $theType;
                $objectIDHash{ $fields[0] }->{timestamp}  = $fields[2];
                $objectIDHash{ $fields[0] }->{itemIndex}  = $fields[3];

                $objectIDHash{ $fields[0] }->{assessmentName} = getAssessmentName( $netapp, $theDir, $instructor, $cid, $typeIndex, $fields[3] );

            }
        }
    }

    return ( \%objectIDHash );

}

sub getGrades {

    my $netapp        = shift;
    my $theDir        = shift;
    my $instructor    = shift;
    my $cid           = shift;
    my $assessmentSel = shift;
    my $studentsSel   = shift;
    my $passedInTA    = shift;
    my $tempPath      = "teacher";
    if ( $passedInTA ne "" ) { $tempPath = "ta"; }

    my $startRec          = 1;
    my $endRec            = 10000;    # if there are more than 10,000 assessments or students in a course we are in trouble
    my $assessmentCounter = 0;

    my $stuStartRec = 1;
    my $stuendRec   = 10000;          # if there are more than 10,000 assessments or students in a course we are in trouble

    my $output;

    # determine if we are going to be grabbing all the grades or a subset based
    # on the params passed in

    if ( $assessmentSel ne "all" ) {
        chomp($assessmentSel);

        ( $startRec, $endRec ) = split( /x/, $assessmentSel );

    }

    if ( $studentsSel ne "all" ) {
        chomp($studentsSel);

        ( $stuStartRec, $stuendRec ) = split( /x/, $studentsSel );

    }

    my $gradebuilderArray = getGradeBuilderArray( $netapp, $theDir, $instructor, $cid );
    my $objectIDs = getObjectIDHash( $netapp, $theDir, $instructor, $cid );
    my ( $studentRosterHash, $sortedNameArray ) = getStudentRosterHash( $netapp, $theDir, $instructor, $cid );
    my $mongoRoster = Packages::E1::E1MongoCacheProxy::ProfileCacheProxy::get_roster_profiles( netapp => $netapp, dir => $theDir, instructor => $instructor, courseid => $cid );


    my $pathToCourseStudentDir = "/$netapp/$theDir/educator/$instructor/$cid/students";

    my $stuCount   = scalar(@$sortedNameArray);
    my $stuCounter = 0;

    my @headerArray;
    my @bodyArray;

    my $headerArraySetUp = 0;

    local $| = 1;

    # the headings need to go in a separate array per the gradebook jquery system
    if ( $headerArraySetUp == 0 ) {
        push( @headerArray, "Name" );
        push( @headerArray, "School" );
    }

    # we use the sorted name array so there is no confusion when displaying chunks of data on the client
    # if we did not do this the client would see a seemingly random chunk of students every time they
    # selected a new "chunk".  Handling it this way insures the names fed into the table are
    # sorted by lname, fname

    foreach my $stuInfo (@$sortedNameArray) {

        my ( $name, $stuDir ) = split( /\*/, $stuInfo );

        my $fullPathToStuDir = "$pathToCourseStudentDir/$stuDir";
        if ( ( -d $fullPathToStuDir ) && ( $stuDir ne '.' ) && ( $stuDir ne '..' ) && ( $stuDir ne $instructor ) ) {
            $stuCounter++;

            # if the record count does not fall in the range we are looking for ignore it
            next if ( ( $stuCounter < $stuStartRec ) || ( $stuCounter > $stuendRec ) );

            my $totalAssessmentCounter     = 0;
            my $assessmentCOmpletedCounter = 0;
            my $totalPoints                = 0;
            my $totalPointsEarned          = 0;
            my $totalCurrentPoints         = 0;

            my $schoolName = '';

            if ($mongoRoster->{$stuDir}->{school}->{name}) {
                $schoolName = $mongoRoster->{$stuDir}->{school}->{name};
            }

            my @segTotalAssessmentCounter     = [ 0, 0, 0 ];
            my @segAssessmentCOmpletedCounter = [ 0, 0, 0 ];
            my @segTotalPoints                = [ 0, 0, 0 ];
            my @segTotalPointsEarned          = [ 0, 0, 0 ];
            my @segTotalCurrentPoints         = [ 0, 0, 0 ];

            my $gbLineEntry = ();

            my $fullNameOut = $studentRosterHash->{$stuDir}->{name};

            my $semester = $studentRosterHash->{$stuDir}->{semester};

            # for now we are always including the links
            # todo: add option to return data with no links - only text

            if ($includeLinks) {
                if ( $fullNameOut eq "" ) {
                    $fullNameOut = "&lt;$stuDir&gt;";
                }

                if ($semester) {
                    $fullNameOut .= " ($semester)";
                }
                $fullNameOut = "<a href=/educator/$tempPath/gradereport.cgi?$instructor" . $passedInTA . "*$theSLT*$cid*$stuDir>$fullNameOut</a>";
                $schoolName  = "<a href=/educator/$tempPath/gradereport.cgi?$instructor*mpos=$mpos&spos=$spos&slt=*$cid*$stuDir>$schoolName</a>";

            }

            push( @$gbLineEntry, $fullNameOut );
            push( @$gbLineEntry, $schoolName );
            $assessmentCounter = 0;
            foreach my $gradebuilderObject (@$gradebuilderArray) {
                my $theObjectID = $gradebuilderObject->{objectID};

                my $assessmentDetails = $objectIDs->{$theObjectID};

                # if there is something wrong with the object linkage ignore the entry
                # and go to the next object in the array
                next if ( !$assessmentDetails );

                # if the assessment count does not fit in the range specified ignore it
                # and go to the next object
                $assessmentCounter++;
                next if ( ( $assessmentCounter < $startRec ) || ( $assessmentCounter > $endRec ) );

                my $assessmentType;
                my $AssessmentIndex;

                my $title = "Replace me";
                my $name  = $stuDir;
                my $calcDateSubmitted;

                if ( $headerArraySetUp == 0 ) {
                    push( @headerArray, $assessmentDetails->{assessmentName} );
                }

                if ( -e "$fullPathToStuDir" ) {

                    my $fullPathToStudentAssessment = "$fullPathToStuDir/" . $assTypePrefixes[ $assessmentDetails->{type} ] . $assessmentDetails->{itemIndex} . ".txt";

                    no strict 'vars';

                    local ( $quell, $shellRoot, $dir, $username, $student, $courseid, $type, $key, $realscore, $maxscore, $manualscore, @gradebuilderstuff, $sizegradebuilderstuff, $gradebuildercontribution, $contribution, $extracredit, $honors, $assessmentstatus, $workiscompleted, $myTerm, $timesubmitted, $requestgrade );

                    $shellRoot = "$netapp";
                    $dir       = "$theDir";
                    $quell     = $instructor;
                    $username  = $instructor;
                    $student   = $stuDir;
                    $courseid  = $cid;
                    $type      = $assTypePrefixes[ $assessmentDetails->{type} ];
                    $key       = $assessmentDetails->{itemIndex};
                    $realscore = 0;

                    #this calls the old getscore routine from the gradebook.pl lib

                    getscore();

                    #these next two items are calculated manually below

                    #getgradebuilderstuff();
                    #gradebuildercontribution();

                    $myTerm = $gradebuilderObject->{term};

                    $score = {

                        # assessmentname   => $___self->getName(%___args) || 'No Name',
                        # assessmenttype   => $___args{type},
                        #  educatorkey      => $___args{key},
                        score            => $realscore,
                        maxscore         => $maxscore,
                        gradingrequested => ( $requestgrade eq 'yes' ) ? 1 : 0,
                        manualscore      => $manualscore,
                        gb_maxscore      => $gradebuilderObject->{points},
                        gb_score         => $contribution,
                        extracredit      => ( $gradebuilderObject->{extraCredit} eq 'yes' ) ? 1 : 0,
                        workcomplete     => ( $workiscompleted eq 'yes' ) ? 1 : 0,
                        status           => $assessmentstatus,
                        honors           => ($honors) ? 1 : 0,
                        semester         => $myTerm,
                        timesubmitted    => $timesubmitted,
                    };

                    # calc running totals

                    if ( $myTerm eq "" ) {
                        $myTerm = 0;
                    }

                    #print STDERR "Sem: $myTerm\n";

                    if ( lc( $score->{score} ) eq "ex" ) {

                    } else {
                        if ( $workiscompleted eq 'yes' ) {
                            $totalPointsEarned += ( $realscore * $gradebuilderObject->{points} ) / $maxscore;
                            $segTotalPointsEarned[$myTerm] += ( $realscore * $gradebuilderObject->{points} ) / $maxscore;

                            if ( ( $assessmentDetails->{type} != 1 ) || ( !$score->{gradingrequested} ) ) {
                                $assessmentCOmpletedCounter++;
                                $segAssessmentCOmpletedCounter[$myTerm]++;

                            }
                            $totalAssessmentCounter++;
                            $segTotalAssessmentCounter[$myTerm]++;

                            if ( !$score->{extracredit} ) {
                                if ( ( $assessmentDetails->{type} != 1 ) || ( !$score->{gradingrequested} ) ) {
                                    $totalCurrentPoints += $gradebuilderObject->{points};
                                    $segTotalCurrentPoints[$myTerm] += $gradebuilderObject->{points};

                                }
                                $totalPoints += $gradebuilderObject->{points};
                                $segTotalPoints[$myTerm] += $gradebuilderObject->{points};

                            }
                        } else {
                            if ( $gradebuilderObject->{honors} ) {
                                if ( $studentRosterHash->{$stuDir}->{honors} ) {
                                    $totalAssessmentCounter++;
                                    $totalPoints += $gradebuilderObject->{points};

                                    $segTotalAssessmentCounter[$myTerm]++;
                                    $segTotalPoints[$myTerm] += $gradebuilderObject->{points};
                                }

                            } else {
                                $totalAssessmentCounter++;
                                $segTotalAssessmentCounter[$myTerm]++;

                                if ( !$score->{extracredit} ) {
                                    $totalPoints += $gradebuilderObject->{points};
                                    $segTotalPoints[$myTerm] += $gradebuilderObject->{points};

                                }
                            }
                        }
                    }

                    if ( ( $score->{score} eq "Not submitted" ) || ( $score->{score} eq "" ) || ( $score->{maxscore} eq "" ) ) {
                        if ( $assessmentDetails->{type} == 1 ) {
                            {
                                $output = "Not&#160;Submitted";
                            }
                        } else {
                            $output = "Not&#160;Accessed";
                        }
                    } else {

                        if ( ( ( $assessmentDetails->{type} == 1 ) ) && ( $score->{gradingrequested} ) ) {
                            $output = "Submitted&#10;Grading&#160;Requested";
                        } else {
                            $output = $score->{score} . "&#47;" . $score->{maxscore};

                            if ( ( $score->{maxscore} > 0 ) && ( $score->{score} ne "Submitted" ) ) {

                                #my $percentage=sprintf("%.0f", ($score->{score}/$score->{maxscore}) * 100);
                                my $percentage = int( ( ( $score->{score} / $score->{maxscore} ) * 100 ) + 0.5 );
                                $output .= "&#160;-&#160;$percentage\%";
                            }
                        }

                    }

                    if ($includeLinks) {

                        my $assessmentTypeHolder = $assessmentDetails->{type};

                        my $feedbackFile = $feedbackFiles[$assessmentTypeHolder];

                        if ( ( $assessmentTypeHolder == 0 ) || ( $assessmentTypeHolder == 3 ) || ( $assessmentTypeHolder == 2 ) )    #exam, quiz, ws
                        {
                            $output = "<a href=/educator/$tempPath/$feedbackFile?$instructor" . $passedInTA . "*$theSLT*$cid*$key*$stuDir>$output</a>";
                        } elsif ( $assessmentTypeHolder == 1 )                                                                       # assignmen
                        {
                            $output = "<a href=/educator/$tempPath/$feedbackFile?$instructor" . $passedInTA . "*$theSLT*$cid*$stuDir*$key>$output</a>";
                        }

                    }

                    push( @$gbLineEntry, $output );
                }

                # --->
                else {
                    #print("Not found $fullPathToStuDir/$name\n");
                }
            }

            # the only time we want to display the totals is if
            # we are displaying all the assessments; otherwise the totals
            # are meaningless

            if ( $assessmentSel eq "all" ) {

                # pts current
                # pts total
                # completed x/y

                my $totString;

                for ( my $i = 1; $i <= 2; $i++ ) {
                    my $calc;
                    $totString = "";

                    if ( $segTotalCurrentPoints[$i] > 0 ) {
                        $calc = int( ( ( $segTotalPointsEarned[$i] / $segTotalCurrentPoints[$i] ) * 100 ) * 100 ) / 100;
                    } else {
                        $calc = 0;
                    }

                    #my $totString= int($segTotalPointsEarned[$i]) . "/" . $segTotalCurrentPoints[$i] . "/" . $calc . "&#37<br>";
                    my $totString = $calc . "&#37<br>";

                    if ( $segTotalPoints[$i] > 0 ) {
                        $calc = ( int( ( ( $segTotalPointsEarned[$i] / $segTotalPoints[$i] ) * 100 ) * 100 ) / 100 );
                    } else {
                        $calc = 0;
                    }

                    #$totString .= int($segTotalPointsEarned[$i]) . "/" . $segTotalPoints[$i] . "/" .  $calc . "&#37<br>";
                    $totString .= $calc . "&#37<br>";

                    if ( $segTotalAssessmentCounter[$i] > 0 ) {
                        $calc = int( ( ( $segAssessmentCOmpletedCounter[$i] / $segTotalAssessmentCounter[$i] ) * 100 ) * 100 ) / 100;
                    } else {
                        $calc = 0;
                    }

                    #$totString .= $segAssessmentCOmpletedCounter[$i] . "/" . $segTotalAssessmentCounter[$i] . "/" . $calc . "&#37";
                    $totString .= $calc . "&#37";

                    push( @$gbLineEntry, $totString );
                }

                #               my $totString="Pts: " . sprintf("%.2f", $totalPointsEarned) . "<br>";
                #
                #
                #               my $calc;
                #
                #               if ($totalPoints > 0)
                #               {
                #                   #$calc=sprintf("%.2f", ($totalPointsEarned/$totalPoints) * 100);
                #
                #                   $calc = int((($totalPointsEarned/$totalPoints) * 100) * 100) / 100;
                #               }
                #               else
                #               {
                #                   $calc=0;
                #               }
                #
                #
                #               $totString .= "Tot &#37; $calc<br>";
                #
                #               if ($totalCurrentPoints > 0)
                #               {
                #                   #$calc=sprintf("%.2f", ($totalPointsEarned/$totalCurrentPoints)*100);
                #
                #                   $calc = int((($totalPointsEarned/$totalCurrentPoints) * 100) * 100) / 100;
                #
                #               }
                #               else
                #               {
                #                   $calc=0;
                #               }
                #
                #               $totString .= "Cur &#37; $calc<br>";
                #
                #               push (@$gbLineEntry,$totString);
                #               #push (@$gbLineEntry,"0");
                #               push (@$gbLineEntry,$assessmentCOmpletedCounter);
                #               push (@$gbLineEntry,$totalAssessmentCounter);
                #
                #               if ($totalAssessmentCounter > 0)
                #               {
                #                   #$calc=sprintf("%.2f", ($assessmentCOmpletedCounter/$totalAssessmentCounter)*100);
                #                   $calc = int((($assessmentCOmpletedCounter/$totalAssessmentCounter) * 100) * 100) / 100;
                #               }
                #               else
                #               {
                #                   $calc=0;
                #               }
                #
                #
                #               push (@$gbLineEntry,$calc);

                push( @bodyArray, $gbLineEntry );

                $totalAssessmentCounter     = 0;
                $assessmentCOmpletedCounter = 0;
                $totalPoints                = 0;
                $totalPointsEarned          = 0;
                $totalCurrentPoints         = 0;

                $gbLineEntry = ();

                if ( $headerArraySetUp == 0 ) {

                    #push (@headerArray,"Points&#160;Earned");
                    #push (@headerArray,"Letter Grade");
                    #push (@headerArray,"Assessments Completed");
                    #push (@headerArray,"&#35; Assessments");
                    #push (@headerArray,"&#37; Completed");

                    #push (@headerArray,"Points&#160;Earned");
                    #push (@headerArray,"Letter Grade");
                    push( @headerArray, "Cur&#160;Segment&#160;1&#160;Points Tot&#160;Segment&#160;1&#160;Points Segment&#160;1&#160;Completed" );
                    push( @headerArray, "Cur&#160;Segment&#160;2&#160;Points Tot&#160;Segment&#160;2&#160;Points Segment&#160;2&#160;Completed" );

                    #push (@headerArray,"Assessments");
                    #push (@headerArray,"&#37; Completed");

                    # pts current
                    # pts total
                    # completed x/y
                }
            }

            # we get to the else if we are NOT displaying all the assessments
            else {
                push( @bodyArray, $gbLineEntry );
                $gbLineEntry = ();

            }
            $headerArraySetUp = 1;

        }
    }

    return ( \@headerArray, \@bodyArray );
}

# get assessment and student count data to set up the
# selection menus on the client

sub getAssessmentCountData {
    my $netapp             = shift;
    my $theDir             = shift;
    my $instructor         = shift;
    my $cid                = shift;
    my $returnValue        = '<option value="all">Show All</option>';
    my $studentReturnValue = '<option value="all">Show All</option>';

    my $assessmentCount;
    my $studentCount;

    my $gradebuilderArray = getGradeBuilderArray( $netapp, $theDir, $instructor, $cid );
    my $objectIDs = getObjectIDHash( $netapp, $theDir, $instructor, $cid );
    my ( $studentRosterHash, $sortedNameArray ) = getStudentRosterHash( $netapp, $theDir, $instructor, $cid );

    my @array = keys(%$objectIDs);
    my $size  = $#array;

    $assessmentCount = $size;

    if ( ( $size % 10 ) > 0 ) {

        #$size += 9;
    }

    for ( my $counter = 1; $counter < $size; $counter += 10 ) {
        $returnValue .= '<option value="' . $counter . 'x' . ( $counter + 9 ) . '"> ' . $counter . ' through ' . ( $counter + 9 ) . '</option>';

    }

    my $countOut = 1;

    foreach my $gradebuilderObject (@$gradebuilderArray) {
        my $theObjectID = $gradebuilderObject->{objectID};

        my $assessmentDetails = $objectIDs->{$theObjectID};

        # if there is something wrong with the object linkage ignore the entry
        # and go to the next object in the array
        next if ( !$assessmentDetails );
        $returnValue .= '<option value="' . $countOut . 'x' . $countOut . '"> ' . $assessmentDetails->{assessmentName} . '</option>';
        $countOut++;

    }

    # get student count data

    @array        = keys(%$studentRosterHash);
    $size         = $#array;
    $studentCount = $size;
    for ( my $counter = 1; $counter < $size; $counter += 10 ) {
        $studentReturnValue .= '<option value="' . $counter . 'x' . ( $counter + 9 ) . '"> ' . $counter . ' through ' . ( $counter + 9 ) . '</option>';

    }

    return ( $returnValue, $studentReturnValue, $assessmentCount, $studentCount );

}
 