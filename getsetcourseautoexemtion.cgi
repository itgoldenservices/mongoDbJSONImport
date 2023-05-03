#!/usr/local/bin/perl
#Written by: Steve Lippert
#Written: 2014/12/26
#Last updated: 2015/01/15

#TODO:
#[X] Take in parameters: data: {franchise: schoolID,instructor: instructorID,course: courseID, data: courseExemptions}
#[X] If action is 'get' return existing auto exemptions if available.
#[X] If action is 'set' save JSON object to file.
#[X] If action is 'rm' remove the JSON file.

use CGI;
use strict;
use JSON qw/ encode_json /;
use Data::Dumper;
require File::Basename;
use MongoDB;
use MongoDB::OID;

my $query = CGI->new;
my @names = $query->param;
my ($netApp, $franchise, $instructorID, $courseID, $JSON, $action, $sendData, $returnData);

$franchise      = $query->param_fetch('franchise')->[0];
$instructorID   = $query->param_fetch('instructor')->[0];
$courseId       = $query->param_fetch('course')->[0];
$sendData       = $query->param_fetch('data')->[0];
$action         = $query->param_fetch('action')->[0];
$JSON           = new JSON;

my $client   = MongoDB->connect($ENV('MDB_ADDRESS'));
my $database = $client->get_database($netapp . '_' . $franchise;);
my $collection = $database->get_collection('auto_exemption_rules');

if ( ($franchise eq 'flvs') || ($franchise eq 'content') || ($franchise eq 'dev') ){
    my $domain = $ENV{'HTTP_HOST'};
    $netApp = 'flvs840';
    $netApp = ( ($domain =~/^learn\-flvs\-/) && ($franchise eq 'flvs') ) ? "e1" : "flvs840";
}else{
    $netApp = 'f840';
}

if( $action eq 'get' ){
  my $query = { courseId => $courseId };
  my $doc   = $coll->find_one($query);

  my $returnData;

  if ($doc) {
  $returnData = encode_json($doc);
  }
  else {
  $returnData = '{"status":"OK","message":"Unable to locate Course Auto Exemptions!"}';
  }
} elsif( $action eq 'set' ){
     
# Updating the document with courseId
my $updateResult = $collection->update_one(
    { "courseId" => $courseId }, # Filter for matching the document
    { 
        '$set' => {
            %$sendData, # Fields to update
            "updatedOn" => time() # Current timestamp
        }
    },
    { "upsert" => 1 } # Create a new document if no match is found
);

# Check if the update was successful
if ($updateResult->acknowledged) {
    # If successful, create response document
    my $returnData = {
        status => 'OK',
        message => 'Update Course Auto Exemptions!'
    };
} else {
    # If unsuccessful, create error document
    my $returnData = {
        status => 'ERROR',
        message => 'Error updating course auto exemptions'
    };
}

# Encode Perl hash into JSON response
my $jsonResponse = encode_json($returnData);
} elsif( $action eq 'rm' ){
# Deleting documents with courseId
my $deleteResult = $collection->delete_many({ "courseId" => $courseId });

# Check if the delete was successful
if ($deleteResult->acknowledged) {
    # If successful, create response document
    my $returnData = {
        status => 'OK',
        message => 'Removed Course Auto Exemptions!'
    };
} else {
    # If unsuccessful, create error document
    my $returnData = {
        status => 'ERROR',
        message => 'Error removing course auto exemptions'
    };
}

# Encode Perl hash into JSON response
my $jsonResponse = encode_json($returnData);
}
print "Content-Type: application/json\n\n";
print $returnData;
exit;