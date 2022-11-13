<?php

$to = $_POST["emailTo"];
$msg = $_POST["msg"];

mail($to, "Some test subject", $msg);

?>