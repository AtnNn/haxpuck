<?

include('common.php');

log_info('session id', session_id());

if($_SERVER['REQUEST_METHOD'] == 'POST'){
  session_unset();
}