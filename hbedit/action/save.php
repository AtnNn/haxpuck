<?
include('common.php');

json_begin();

$userid = $_SESSION['userid'];

if(!$userid || $_POST['userid'] != $userid){
  json_fail('Wrong user id');
}else{
  $ret = db_exec('insert into stadium (name, userid, time, public, downloads, likes) values ('.
          " '" . db_escape($_POST['name']) . "'" .
          ', ' . $userid .
          ", datetime('now')" .
          ", 0, 0, 0 )");
  if(!$ret){
    log_error('insert into stadium', db_error());
    json_fail('database error');
  }
  $stid = db_last_id();
  $file = get_file_name('stadiums', $stid);
  $ret = file_put_contents($file, $_POST['stadium']);
  if($ret === FALSE){
    db_exec('delete from stadium where id = ' . $stid);
    log_error('file write', 'error while writing file: ' . $file);
    json_fail('error while writing file');
  }
  $overwriteid = intval($_POST['overwrite']);
  if($overwriteid){
    $r = db_array_query('select userid from stadium where id = ' . $overwriteid);
    if(count($r) == 1 && $r[0] == $userid){
      db_exec('delete from stadium where id = ' . $overwriteid);
      unlink(get_file_name('stadiums', $overwriteid));
    }
  }
  echo json_encode(array('success' => TRUE,
                         'id' => $stid));
}
?>