<?

include('common.php');

json_begin();

$sid = intval($_POST['id']);

if($sid){
  $info = db_array_query('select public, userid from stadium where id = '.$sid);
  if(count($info) == 1 && ($info[0]['public'] || $info[0]['userid'] == $_SESSION['userid'])){
    echo '{"success":true,"stadium":';
    readfile(get_file_name('stadiums', $sid));
    echo '}';
  }else{
    json_fail('Permission Denied');
  }
}else{
  json_fail('Invalid Stadium ID');
}

?>