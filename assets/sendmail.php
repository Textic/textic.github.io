<?php
    error_log('Sending Mail', 0);

if(isset($_POST['username'])) {
    error_log('no post params', 0);

    $user_username = $_POST['username'];
    $user_email = $_POST['email'];
    $user_date = $_POST['date'];
    $user_message = $_POST['message'];
} else {
    error_log('no post params', 0);
}
}