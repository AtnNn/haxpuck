<?
include('common.php');

$id = intval($_GET['id']);

$user = db_array_query('select name from user where verified = 0 ' .
                       ' and id = ' . $id .
                       " and registration_key = '" . db_escape($_GET['key']) . "'");

echo "<html><head><title>Registration Confirmation</title><script>alert('";
if($user && count($user) === 1){
  if(db_exec('update user set verified = 1 where id = ' . $id)){
    echo "Your account (" . $user[0]['name'] . ") on HaxPuck.com has been activated.";
  }else{
    echo "An error occured while activating your account on HaxPuck.com, please try again later.";
  }
}else{
  echo "Invalid confirmation key for HaxPuck.com account activation.";
}
echo "');document.location = 'http://haxpuck.com/';</script></head><body></body></html>";

?>