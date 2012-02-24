<?

include('common.php');

header('Content-type: application/octet-stream');
header('Content-Disposition: attachment'); // TODO: filename

$sid = intval($_POST['id']);

if($sid){
  $info = db_array_query('select public, userid from stadium where id = '.$sid);
  if(count($info) == 1 && ($info[0]['public'] || $info[0]['userid'] == $_SESSION['userid'])){
    readfile(get_file_name('stadiums', $sid));
  }else{
    header("Status: 403 Acces Denied");
    echo 'PERMISSION DENIED';
  }
}else{
  header("Status: 404 Not Found");
  echo 'INVALID STADIUM ID';
}

?>