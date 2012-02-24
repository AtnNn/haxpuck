<?

include('common.php');

json_begin();

$sid = intval($_POST['id']);

if($sid){
  $info = db_array_query('select public, userid from stadium where id = '.$sid);
  if(count($info) == 1 && $info[0]['userid'] == $_SESSION['userid']){
    if(db_exec('delete from stadium where id = '.$sid)){
      if(unlink(get_file_name('stadiums', $sid))){
        echo '{"success":true}';
      }else{
        json_fail('Unable to Delete');
      }
    }else{
      json_fail('Unable to delete');
    }
  }else{
    json_fail('Permission Denied');
  }
}else{
  json_fail('Invalid Stadium ID');
}

?>