<?
include('common.php');

json_begin();

$rows = db_array_query("select id, password, verified from user where name = '" . db_escape($_POST['name']) . "'");

if(count($rows) == 1){
  if(!$rows[0]['verified']){
    printf('{"success":false, "reason":"unverified"}');
  }else if($rows[0]['password'] === hash_user_password($_POST['name'], $_POST['password'])){
    $_SESSION['userid'] = intval($rows[0]['id']);
    $_SESSION['username'] = $_POST['name'];
    printf('{"success":true, "id":%d}', intval($rows[0]['id']));
  }else{
    printf('{"success":false, "reason":"wrong password"}');
  }
}else{
  printf('{"success":false, "reason":"no such user"}');
}
?>