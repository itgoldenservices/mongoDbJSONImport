sub saveCourseExemptions {
    my $schoolID = 'content';
    my $instructorID = 'master' . $query->param('course'); # Assuming course is a parameter sent from the frontend
    my $courseID = 'master' . $query->param('course');    # Assuming course is a parameter sent from the frontend
    my $action = 'set';

    # Loop over each key and remove if exemptiondata is null
    for my $key (keys %courseExemptions) {
        if (exists $courseExemptions{$key} && !defined $courseExemptions{$key}{'exemptiondata'}) {
            delete $courseExemptions{$key};
        }
    }

    my $sendData = JSON::XS->new->utf8->encode($courseExemptions);

    # Reload the table before sending the data to the backend
    loadTable();

    # Check if the JSON object is empty
    if (!%courseExemptions) {
        $action = 'rm';
    }

    # Send the data to the backend
    my $response = $query->POST(
        -url    => 'getsetcourseautoexemptions.cgi',
        -content_type => 'application/json',
        -content => { franchise => $schoolID, instructor => $instructorID, course => $courseID, data => $sendData, action => $action }
    );

    if ($response->is_success) {
        # Success handling here
    } else {
        # Error handling here
        print $response->status_line;
    }
}
