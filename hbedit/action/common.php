<?

// TODO: log user agent and user id

include('settings.php');

header('Access-control-allow-origin: http://10.0.0.1:8002');

$DB = new SQLite3($SETTINGS['dbfile']);

session_set_cookie_params(1296000);

if(isset($_POST['sessionid'])){
  session_id($_POST['sessionid']);
}

session_start();

function json_begin($jsonp_allowed = False){
  header('Content-type: application/json');
  if($jsonp_allowed && isset($_GET['callback'])){
    echo $_GET['callback'] . '(';
    register_shutdown_function('jsonp_end_shutdown');
  }
}

function jsonp_end_shutdown(){
  echo ')';
}

function hash_user_password($user, $password){
  global $SETTINGS;
  return hash_hmac('sha512', $password . $user, $SETTINGS['key']);
}

function db_exec($q){
  global $DB;
  return $DB->exec($q);
}

function db_array_query($q){
  global $DB;
  $h = $DB->query($q);
  if($h){
    $ret = array();
    while($r = $h->fetchArray(SQLITE3_ASSOC)){
      $ret[] = $r;
    }
    return $ret;
  }else{
    return FALSE;
  }
}

function db_last_id(){
  global $DB;
  return $DB->lastInsertRowID();
}

function log_to_db($action, $type, $msg){
  $ret = db_exec("insert into log (time, uri, action, type, message) values (".
                 "datetime('now')," .
                 "'" . db_escape($_SERVER['REQUEST_URI']) . "'," .
                 "'" . db_escape($action) . "'," .
                 "'" . $type . "'," .
                 "'" . db_escape($msg) . "'" .
                 ")");
  if(!$ret){
    die('cannot log: ' + db_error());
  }
}

function log_error($action, $msg){
  log_to_db($action, 'error', $msg);
}

function log_info($action, $msg){
  log_to_db($action, 'info', $msg);
}

function valid_name($name){
  return strlen($name) >= 4 &&
    strlen($name) <= 20 &&
    preg_match("/^[a-zA-Z0-9_]+$/", $name);
}

function valid_password($pwd){
  return strlen($pwd) > 5;
}

function valid_email($email){
  return filter_var($email, FILTER_VALIDATE_EMAIL) !== FALSE;
}

function new_registration_key(){
  return md5(uniqid("fun",true));
}

function db_error(){
  global $DB;
  return $DB->lastErrorMsg();
}

function db_escape($str){
  global $DB;
  return $DB->escapeString($str);
}

function json_fail($reason, $no_exit = FALSE){
  echo json_encode(array('success'=>FALSE, 'reason'=>$reason));
  if(!$no_exit){
    exit();
  }
}

function get_file_name($type, $id){
  global $SETTINGS;
  return $SETTINGS['datadir'] . '/' . $type . '/' . $id . '.hbs';
}

?>