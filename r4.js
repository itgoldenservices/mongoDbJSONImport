const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

let documentRoot = process.env['DOCUMENT_ROOT'];
let documentRootSplit = documentRoot.split('/');
let shellRoot = documentRootSplit[1];
let dir = documentRootSplit[2];
let domain = process.env['HTTP_HOST'];

let fileid = "jqexemptstudentsfromassessmentpost.cgi";

let input = process.stdin;
let buffer = Buffer.alloc(1024);
let envQuery = process.env['QUERY_STRING'];
let items = envQuery.split('*');
let username = items[0];
let scramble = items[1];
let courseid = items[2];
let keyx = items[3];
let key = items[4];
key = key.replace(/\%25/g, '%');

let query = url.parse(envQuery, true).query;
username = query['username'];
courseid = query['courseid'];
let student = query['student'];
let comment = query['reason'];

require("/subroutines/authenticate.cgi");
require("/subroutines/gradebookUtils.pl");
authenticate();

let studentIDValues = {};

let out = "";

let fields = Object.keys(query);

fields.forEach((field) => {
    if (field.startsWith('excb_')) {
        let details = field.slice(5);
        let assData = details.split('_');
        let assessmentType = getAssessmentDirectory(assData[0]);
        let assessmentIndex = assData[1];

        if (query[`excb_${details}`]) {
            studentIDValues[student] = 1;
            out += " EX<br>";
            setAssessmentIsExempt(shellRoot, dir, username, courseid, assessmentType, assessmentIndex, student, 1, comment);
        } else {
            out += " NOT EX<br>";
            setAssessmentIsExempt(shellRoot, dir, username, courseid, assessmentType, assessmentIndex, student, 0, comment);
        }
    }
});
 // Invalidate Workload Cache
clear_workload_cache(shellRoot, dir, username, courseid);

console.log("Content-type:text/html\n\n");
console.log(`
<html>
<head>
<title>${coursetitle}</title>
</head>
<body bgcolor=white>
<meta http-equiv="refresh" content="3;url=/educator/teacher/gradereport.cgi?${username}*${input}*${courseid}*${student}">
<h3><font face=helvetica,arial>Submitted.  Thank You.</font></h3>
</body>
</html>\n`);