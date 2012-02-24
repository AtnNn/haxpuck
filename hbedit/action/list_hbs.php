<?

include('common.php');

json_begin();

$uid = $_SESSION['userid'];
$uname = $_SESSION['username'];

$query = $_POST['query'];

if($query == 'public'){
  $list = db_array_query('select s.id, s.userid, s.name, s.time, u.name as username from stadium s, user u '.
                         'where s.public = 1 and s.userid = u.id order by time desc limit 50');
}else if($query == 'saved'){
  if(!$uid){
    json_fail('Not Logged In');
  }
  $list = db_array_query("select s.id, s.userid, s.name, s.time, '".db_escape($uname)."' as username from stadium s where s.userid = ".$uid.' order by time desc limit 50');
}else{
  json_fail('Invalid Query');
}

echo json_encode(array('success' => True,
                       'list' => $list));

?>