#!/usr/local/bin/perl

#$Author: Dan Gomoll$
#$Date: 2018-01-24$
#$Revision: 0.01$
#$Source: /e1/data/cgi/Packages/E1/E1MongoObject/.pm$
#$ID: Enrollments.pm$

package Packages::E1::E1MongoObject::Enrollments;

use base 'Packages::E1::E1MongoObject';
use Data::Dumper;
use File::Slurp;
use strict;
use DateTime::Format::MySQL;
use Const::Fast;
use Tie::IxHash;
use DateTime;
use BSON::Types ':all';
use boolean;

sub new {
    my ($class, %params) = @_;

    $params{log_name} = "Enrollments.txt";

    $params{collection} = "enrollments";

    #$params{collection} = "profiles_with_enrollments";

    my $self = $class->SUPER::new(%params);
    $self->{profile} = {};
    bless $self, $class;    ## Makes $self a $class object
                            #$self->{configFile}='/support/learnftsettings.json';
                            # $self->db();

    return $self;
}

sub get_enrollments_for_user {
    my ($self, %params) = @_;

    my $user_id = $params{_id};

    my $crtieria = {
        '$or' => [
            { 'student_user_idfk' => $user_id },
            { '$and'              => [ { instructor_user_idfk => $user_id }, { student_user_idfk => undef } ] }

            ]

    };

    my $ordered_hash = Tie::IxHash->new(role => 1, cid => 1);

    my @enrollment_result = $self->{main_collection}->find({ 'owner_user_idfk' => $user_id, status => 'active' }, { projection => { history => 0, owner => 0, owner_user_idfk => 0 } })->sort($ordered_hash)->all;

    return \@enrollment_result;
}

sub get_enrollments_for_user_as_hash {
    my ($self, %params) = @_;

    my $array_result = $self->get_enrollments_for_user(%params);
    my $return_hash  = {};

    foreach my $record (@$array_result) {
        $return_hash->{ $record->{instructor} . '_' . $record->{cid} } = $record;
    }
    return $return_hash;
}

sub get_enrollment {
    my ($self, %params) = @_;

    my $user_id = $params{_id};

    my $result = $self->{main_collection}->find_one({ _id => $user_id });

    return $result;

}

sub find_enrollment {
    my ($self, $params) = @_;

    my $result = $self->{main_collection}->find_one($params);

    return $result;

}


sub transfer_enrollment {
    my ($self, %params) = @_;

    my $_id               = $params{enrollment_id};
    my $new_instructor_id = $params{new_instructor_id};

    # first find the passed in student enrollment, then
    # find the old instructor and teacher enrollment, then the new
    # instructor and teacher enrollment.
    #
    # If all is well change the values and update
    # the history
    #
    # TODO: This will need to be updated when the courses
    # collection is added

    my $current_student_enrolment = $self->get_enrollment(_id => $_id);
    if ($current_student_enrolment) {
        my $cid = $current_student_enrolment->{cid};
        my $old_teacher_enrollment = $self->find_enrollment({ cid => $cid, role => 'instructor', owner_user_idfk => $current_student_enrolment->{instructor_user_idfk} });
        if ($old_teacher_enrollment) {
            my $new_teacher_enrollment = $self->find_enrollment({ cid => $cid, role => 'instructor', owner_user_idfk => $new_instructor_id });
            if ($new_teacher_enrollment) {
                if ($current_student_enrolment->{instructor_user_idfk} ne $new_teacher_enrollment->{instructor_user_idfk}) {

                    my $update_rec = {
                        '$set' => { instructor_user_idfk => $new_teacher_enrollment->{instructor_user_idfk}, instructor => $new_teacher_enrollment->{instructor} },
                        '$push' => { history => { date => DateTime->now, action => "Transfer $current_student_enrolment->{instructor_user_idfk} ($current_student_enrolment->{instructor}) -> $new_teacher_enrollment->{instructor_user_idfk} ($new_teacher_enrollment->{instructor})" } }
                    };

                    my $result = $self->{main_collection}->update_one({ _id => $_id }, $update_rec);
                    return 0;
                } else {
                    $self->debug("student already enrolled in new course,  $new_instructor_id");
                    return 1;
                }
            } else {
                $self->debug("new teacher enrollment not found: $cid,  $new_instructor_id");
                return 2;
            }
        } else {
            $self->debug("old teacher enrollment not found: $cid,  $current_student_enrolment->{instructor_user_idfk}");
            return 3;
        }
    } else {
        $self->debug("current student enrollment not found: $_id");
        return 4;
    }
    return 5;

}

sub set_archived_status {
    my ($self, %params) = @_;

    my $_id         = $params{id};
    my $course_idfk = $params{course_idfk};

    # db.profiles_with_enrollments.updateOne(
    #    {
    #     $and :
    #     [
    #         {"_id": ObjectId("5b58d7e86bbc8312c832d9cf")},
    #         {"enrollments.course_idfk" : ObjectId("5b58d8216bbc8312c832dac7")}
    #      ]
    #      },
    #    {$set :{"enrollments.$.status" : "active"}}
    # )
    #

    my $update_rec = {
        '$set'  => { 'enrollments.$.status'  => $params{status} },
        '$push' => { 'enrollments.$.history' => { date => DateTime->now, action => "Status: $params{status}" } }
    };

    # the condition below makes sure we only update the status if it
    # is different than the current status

    #     my $conditon = {
    #         '$and' => [
    #             { _id    => $_id },
    #             { status => { '$ne' => $params{status} } }
    #
    #             ]
    #
    #     };

    my $conditon = {
        '$and' => [
            { _id                       => $_id },
            { 'enrollments.course_idfk' => $course_idfk }

            ]

    };

    #    { _id: 1, grades: 80 },
    #    { $set: { "grades.$" : 82 } }
    #)

    my $result = $self->{main_collection}->update_one($conditon, $update_rec);

}

sub set_suspended_status {
    my ($self, %params) = @_;

    my $_id = $params{id};

    my $update_rec = {
        '$set'  => { suspended => $params{suspended} },
        '$push' => { history   => { date => DateTime->now, action => "Suspended: $params{suspended}" } }
    };

    # the condition below makes sure we only update the status if it
    # is different than the current status

    my $conditon = {
        '$and' => [
            { _id       => $_id },
            { suspended => { '$ne' => $params{suspended} } }

            ]

    };

    my $result = $self->{main_collection}->update_one($conditon, $update_rec);

}

sub find_enrollments_for_course {
    my ($self, %params) = @_;

    my $course_id = $params{course_id};

    $self->direct_connect();

    my $projection = {
        'role'                  => 1,
        'segments'              => 1,
        'last_submitted'        => 1,
        'honors'                => 1,
        'suspended'             => 1,
        'reminder'              => 1,
        'invisible_to_students' => 1,
        owner                   => 1,
        _id                     => 1

    };



    my $ordered_hash = Tie::IxHash->new('owner.username' => 1);

    my $enrollment_result = $self->{main_collection}->find({ 'course_idfk' => $course_id, status => 'active' }, { projection => $projection })->sort($ordered_hash);
    my @result_array = $enrollment_result->all;


    return \@result_array;

}



1;