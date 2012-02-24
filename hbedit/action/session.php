<?
include('common.php');

json_begin(true);

echo json_encode(array('userid' => $_SESSION['userid'],
                       'username' => $_SESSION['username'],
                       'sessionid' => session_id()));