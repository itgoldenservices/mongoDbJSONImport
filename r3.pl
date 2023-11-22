!/usr/local/bin/perl



$documentRoot = $ENV{'DOCUMENT_ROOT'};
@documentRootSplit = split(/\//,$documentRoot);
$shellRoot = $documentRootSplit[1];
$dir = $documentRootSplit[2];
$domain = $ENV{'HTTP_HOST'};

$fileid="jqexemptstudentsfromassessmentpost.cgi";


$input=(STDIN,$buffer,$ENV{'QUERY_STRING'});
@items=split(/\*/,$input);
$username=$items[0];
$scramble=$items[1];
$courseid=$items[2];
$keyx=$items[3];
$key=$items[4];
$key=~s/\%25/\%/g;




use CGI qw(:standard);
use Data::Dumper;
use Packages::E1::E1MongoCacheProxy::ProfileCacheProxy;


$query       = new CGI;
#$assessmentType    = ($query->param('asstype'));
#$assessmentIndex    = ($query->param('index'));
$username    = ($query->param('username'));
$courseid    = ($query->param('courseid'));
$student    = ($query->param('student'));
$comment    = ($query->param('reason'));




#print STDERR Dumper $query;

# Educator Upgrade - 12/01/00


require "/subroutines/authenticate.cgi";
require "/subroutines/gradebookUtils.pl";
&authenticate;

my %studentIDValues;

my $out="";

my @fields = $query->param;

foreach my $field (@fields) {
    #if ($field =~ /^excb_/) {
    if ($field =~ /^excb_/) {
        $field=~/^excb_(.*)/;
        my $details=$1;
        
        
        my @assData=split('_', $details);
        
        
        my $assessmentType=getAssessmentDirectory($assData[0]);
        my $assessmentIndex=$assData[1];
        
        
        #$out .= "$shellRoot, $dir, $username, $courseid, $assessmentType, $assessmentIndex, $student";

        if ($query->param("excb_" . $details)) {
            $studentIDValues{$student}=1;
            $out .= " EX<br>";
            setAssessmentIsExempt($shellRoot, $dir, $username, $courseid, $assessmentType, $assessmentIndex, $student,1, $comment);
        } else {
            $out .= " NOT EX<br>";
            setAssessmentIsExempt($shellRoot, $dir, $username, $courseid, $assessmentType, $assessmentIndex, $student,0, $comment);
        }
            
        
    
    }

}

##++Invalidate Workload Cache++##
&clear_workload_cache($shellRoot, $dir, $username, $courseid);
##--Invalidate Workload Cache--##

print "Content-type:text/html\n\n";
print "
<html>
<head>
<title>$coursetitle</title>
</head>
<body bgcolor=white>
<meta http-equiv=\"refresh\" content=\"3;url=/educator/teacher/gradereport.cgi?$username*$input*$courseid*$student\">
<h3><font face=helvetica,arial>Submitted.  Thank You.</font></h3>
</body>
</html>\n";