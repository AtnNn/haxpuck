<?
include('common.php');

json_begin();

if(!valid_name($_POST['name'])){
  printf('{"success":false, "reason":"invalid name"}');
  exit();
}

if(!valid_password($_POST['password'])){
  printf('{"success":false, "reason":"invalid password"}');
  exit();
}

if(!valid_email($_POST['email'])){
  printf('{"success":false, "reason":"invalid email"}');
  exit();
}

$users = db_array_query("select id from user where name = '" . db_escape($_POST['name']) . "'");
$emails = db_array_query("select id from user where email = '" . db_escape(strtolower($_POST['email'])) . "'");

if(count($users) != 0){
  log_error('existing user', print_r(count($users), true));
  printf('{"success":false, "reason":"existing user"}');
}else if(count($emails) != 0){
  printf('{"success":false, "reason":"existing email"}');
}else{
  $regkey = new_registration_key();
  $success = db_exec("insert into user (name, password, email, registration_key, verified) values (".
                         "'" . db_escape($_POST['name']) . "'," .
                         "'" . db_escape(hash_user_password($_POST['name'], $_POST['password'])) . "'," .
                         "'" . db_escape($_POST['email']) . "'," .
                         "'" . $regkey . "'," .
                         "0)");
  if($success){
    mail($_POST['email'], 'HaxPuck Registration Confirmation',
         "Hello " . $_POST['name'] . "," .
         "\n\nTo confirm your registration on HaxPuck.com, please open the following link:" .
         "\n\nhttp://haxpuck.com/action/confirm?key=" . $regkey . "&id=" . db_last_id() .
         "\n\nIf you have not requested a HaxPuck.com account, you can safely ignore this message." .
         "\n\nThank you,\nThe HaxPuck.com staff", 
         "From: HaxPuck.com <haxpuck@haxpuck.com>");
    printf('{"success":true}');
  }else{
    printf('{"success":false, "reason":"internal error"}');
    log_error('create user', db_error());
  }
}
?>