#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <zlib.h>
#include <stdint.h>
#include <stdarg.h>
#include <arpa/inet.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <math.h>

#define NAME_AND_VERSION "HBRDumpC 0.9"

typedef struct {
  int index;
  int size;
  char *buffer;
  int indent;
  char close[100];
  int state[100];
} parsee;

enum state {
  STATE_FIRST,
  STATE_SEPERATOR,
  STATE_FIELD_VALUE
};

parsee p;

int version;

void end_object();
void fail(char *fmt, ...);
void dump_pos();
void list(int n, void (*f)());
void wrote_value();

void seperator(){
  if(p.state[p.indent] == STATE_SEPERATOR){
    putchar(',');
  }else if(p.state[p.indent] == STATE_FIRST){
    p.state[p.indent] = STATE_SEPERATOR;
  }else{
    fail("missing field value");
  }
}

void print_quoted_string_len(char *s, int length){
  putchar('"');
  int i;
  for(i = 0; i < length; i++){
    if(s[i] == '"' || s[i] == '\\'){
      putchar('\\');
    }
    putchar(s[i]);
  }
  putchar('"');
  wrote_value();
}

char* next(int n){
  char *c = p.buffer + p.index;
  p.index += n;
  if(p.index > p.size){
    fail("parse error (too far)");
  }
  return c;
}

void print_quoted_string(char *s){
  print_quoted_string_len(s, strlen(s));
}

void field(char *s){
  seperator();
  print_quoted_string(s);
  putchar(':');
  p.state[p.indent] = STATE_FIELD_VALUE;
}

void open_indent(char oc[2]){
  p.close[--p.indent] = oc[1];
  p.state[p.indent] = STATE_FIRST;
  putchar(oc[0]);
}

void fail(char *fmt, ...){
  char buf[2048];
  va_list args;
  p.close[sizeof(p.close) - 1] = 0;
  if(p.state[p.indent] == STATE_FIELD_VALUE){
    printf("null");
    wrote_value();
  }
  printf("%s", p.close + p.indent);
  field("error");
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  buf[sizeof(buf)-1] = 0;
  print_quoted_string(buf);
  putchar('}');
  exit(1);
}

void wrote_value(){
  p.state[p.indent] = STATE_SEPERATOR;
}

void close_indent(char oc[2]){
  if(p.close[p.indent++] != oc[1])
    fail("cannot close %c with %c", oc[0], p.close[p.indent-1]);
  putchar(oc[1]);
  wrote_value();
}

void begin_object(){
  open_indent("{}");
}

void end_object(){
  close_indent("{}");
}

void begin_list(){
  open_indent("[]");
}

void end_list(){
  close_indent("[]");
}

uint32_t parse_uint(){
  uint32_t i = *(uint32_t*)next(4);
  return ntohl(i);
}

uint16_t parse_ushort(){
  uint16_t s = *(uint16_t*)next(2);
  return ntohs(s);
}

void dump_ushort(){
  printf("%d", (int)parse_ushort());
  wrote_value();
}

void dump_str(){
  int len = parse_ushort();
  print_quoted_string_len(next(len), len);
}

void dump_uint(){
  printf("%d", parse_uint());
  wrote_value();

}

void skip_HBRP(){
  char *c = next(4);
  if(c[0] != 'H' && c[1] != 'B' && c[2] != 'R' && c[3] != 'P')
    fail("input is not recognised");
}

void deflate_remaining(){
  char buf_out[2097152];
  char *buf_in = next(0);
  int length_in = p.size - p.index;
  int length_out;
  z_stream strm;
  int ret;
  strm.zalloc = Z_NULL;
  strm.zfree = Z_NULL;
  strm.opaque = Z_NULL;
  strm.avail_in = 0;
  strm.next_in = Z_NULL;
  ret = inflateInit(&strm);
  if(ret != Z_OK) fail("cannot initialise zlib");
  strm.next_in = (unsigned char*)buf_in;
  strm.avail_in = length_in;
  strm.next_out = (unsigned char*)buf_out;
  strm.avail_out = sizeof(buf_out);
  ret = inflate(&strm, Z_NO_FLUSH);
  if(ret != Z_STREAM_END){
    inflateEnd(&strm);
    fail("cannot deflate (error %d)", ret);
  }
  length_out = sizeof(buf_out) - strm.avail_out;
  munmap(p.buffer, p.size);
  p.buffer = malloc(length_out);
  memcpy(p.buffer, buf_out, length_out);
  p.size = length_out;
  p.index = 0;
}

int parse_bool(){
  char b = *next(1);
  if(b != 0 && b != 1)
    fail("invalid boolean");
  return b;
}


void dump_bool(){
  char b = parse_bool();
  if(b == 0)
    printf("false");
  else if(b == 1)
    printf("true");
  wrote_value();
}

unsigned char parse_byte(){
  return *next(1);
}

void dump_byte(){
  printf("%d", (unsigned int) parse_byte());
  wrote_value();
}

void dump_side(){
  switch(parse_byte()){
  case 0:
    print_quoted_string("red");
    break;
  case 1:
    print_quoted_string("blue");
    break;
  case 2:
    print_quoted_string("spectator");
    break;
  default:
    fail("invalid side");
  }
  wrote_value();
}

double parse_double(){
  char *c = next(8);
  char buf[8] = {
    c[7], c[6], c[5], c[4], c[3], c[2], c[1], c[0]
  };
  double s = *(double*) buf;
  return s;
}

void dump_double(){
  // the printed number should
  // uniquely determine the value
  printf("%.200g", parse_double());
  wrote_value();
}

void print_field_name(int n){
  print_quoted_string
    (n == 0 ? "classic" :
     n == 1 ? "easy" :
     n == 2 ? "small" :
     n == 3 ? "big" :
     n == 4 ? "rounded" :
     n == 5 ? "hockey" :
     n == 6 ? "big_hockey" :
     n == 7 ? "big_easy" :
     n == 8 ? "big_rounded" :
     n == 9 ? "huge" :
     (fail("invalid default field (%d)", n), "invalid"));
}

void print_field_bg_type(int n){
  print_quoted_string
    (n == 0 ? "none" :
     n == 1 ? "grass" :
     n == 2 ? "hockey" :
     (fail("invalid field type"), ""));
}

void print_mask(int m){
  begin_list();
#define mask(n, s) do { if(m & n){              \
    seperator();                                \
    print_quoted_string(s);                     \
    } } while (0)
  mask(1, "ball");
  mask(2, "red");
  mask(4, "blue");
  mask(8, "redKO");
  mask(16, "blueKO");
  mask(32, "wall");
#undef mask
  end_list();
  wrote_value();
}

void dump_prop_fields(){
  field("bCoef");
  dump_double();
  field("cMask");
  print_mask(parse_uint());
  field("cGroup");
  print_mask(parse_uint());
}

void dump_vertex(){
  begin_object();
  field("x");
  dump_double();
  field("y");
  dump_double();
  dump_prop_fields();
  end_object();
}

void print_color(int c){
  char *rgb=((char*)&c)+1;
  begin_list();
  seperator();
  printf("%d", rgb[0]);
  seperator();
  printf("%d", rgb[1]);
  seperator();
  printf("%d", rgb[2]);
  end_list();
}

void print_curve(double c){
  // TODO: might be wrong
  printf("%lf", atan(1 / c) * 360 / M_PI);
  wrote_value();
}

void dump_segment(){
  begin_object();
  field("v0");
  dump_byte();
  field("v1");
  dump_byte();
  dump_prop_fields();
  field("curve");
  print_curve(parse_double());
  field("vis");
  dump_bool();
  field("color");
  print_color(parse_uint());
  end_object();
}

void dump_plane(){
  begin_object();
  field("normal");
  dump_pos();
  field("dist");
  dump_double();
  dump_prop_fields();
  end_object();
}

void dump_goal(){
  begin_object();
  field("p0");
  dump_pos();
  field("p1");
  dump_pos();
  field("team");
  dump_side();
  end_object();
}

void dump_disc(int has_speed){
  begin_object();
  field("pos");
  dump_pos();
  if(has_speed){
    field("speed");
    dump_pos();
  }
  field("radius");
  dump_double();
  field("bCoef");
  dump_double();
  field("invMass");
  dump_double();
  field("damping");
  dump_double();
  field("color");
  print_color(parse_uint());
  field("cMask");
  print_mask(parse_uint());
  if(version > 3){
    field("cGroup");
    print_mask(parse_uint());
  }
  end_object();
}

void dump_stadium_disc(){
  dump_disc(0);
}

void dump_custom_stadium(){
  begin_object();
  field("name");
  dump_str();

  field("bg");
  begin_object();
  field("type");
  print_field_bg_type(parse_byte());
  field("width");
  dump_double();
  field("height");
  dump_double();
  field("kickOffRadius");
  dump_double();
  field("corner_radius");
  dump_double();
  end_object();

  // TODO: what are these?
  parse_double();
  parse_uint();

  field("width");
  dump_double();
  field("height");
  dump_double();
  field("spawnDistance");
  dump_double();
  field("vertexes");
  list(parse_byte(), dump_vertex);
  field("segments");
  list(parse_byte(), dump_segment);
  field("planes");
  list(parse_byte(), dump_plane);
  field("goals");
  list(parse_byte(), dump_goal);
  field("discs");
  list(parse_byte(), dump_stadium_disc);
  
  end_object();
}

void dump_stadium(){
  int b = parse_byte();
  begin_object();
  if(b != 255){
    field("normal");
    print_field_name(b);
  }else{
    field("custom");
    dump_custom_stadium();
  }
  end_object();
}

void maybe_field(char *name, void (*f)()){
  if(parse_bool()){
    field(name);
    f();
  }
}

void list(int n, void (*f)()){
  begin_list();
  while(n--){
    seperator();
    f();
  }
  end_list();
}

void dump_pos(){
  list(2, dump_double);
}

void dump_sim_disc(){
  dump_disc(1);
}

void dump_discs(){
  list(parse_uint(), dump_sim_disc);
}

void dump_player(){
  begin_object();
  field("id");
  dump_uint();
  field("name");
  dump_str();
  field("admin");
  dump_bool();
  field("team");
  dump_side();
  field("number");
  dump_byte();
  field("avatar");
  dump_str();
  field("input");
  dump_uint();
  field("auto_kick");
  dump_bool();
  field("desync");
  dump_bool();
  field("country");
  dump_str();
  field("disc_id");
  dump_uint();
  end_object();
}

void dump_header(){
  begin_object();
  field("first_frame");
  dump_uint();
  field("room_name");
  dump_str();
  field("locked");
  dump_bool();
  field("score_limit");
  dump_byte();
  field("time_limit");
  dump_byte();
  field("rules_timer");
  dump_uint();
  field("rules");
  dump_byte();
  field("puck_side");
  dump_side();
  field("puck_pos");
  dump_pos();
  field("red_score");
  dump_uint();
  field("blue_score");
  dump_uint();
  field("time");
  dump_double();
  field("stadium");
  dump_stadium();
  maybe_field("discs", dump_discs);
  field("players");
  list(parse_uint(), dump_player);
  end_object();
}

void dump_join(){
  field("misc1");
  dump_uint();
  field("name");
  dump_str();
  field("misc2");
  dump_bool();
  field("country");
  dump_str();
}

void dump_part(){
  field("misc1");
  dump_ushort();
  maybe_field("kick_message", dump_str);
  field("ban");
  dump_bool();
}

void dump_say(){
  field("msg");
  dump_str();
}

void dump_misc1(){
  // nothing
};

void dump_start(){
  // nothing
}

void dump_stop(){
  // nothing
}

void dump_puck(){
  field("misc");
  dump_byte();
}

void dump_team(){
  field("player2");
  dump_uint();
  field("team");
  dump_side();
}

void dump_lock(){
  field("lock");
  dump_bool();
}

void dump_misc2(){
  field("misc");
  list(5, dump_byte);
}

void dump_avatar(){
  field("avatar");
  dump_str();
}

void dump_misc3(){
  // nothing
}

void dump_admin(){
  field("player2");
  dump_uint();
  field("admin");
  dump_bool();
}

void dump_field_change(){
  // TODO
  field("data");
  list(parse_uint(), dump_byte);
}

void (*action_dumper[])() = {
  dump_join, dump_part, dump_say, dump_misc1,
  dump_start, dump_stop, dump_puck, dump_team,
  dump_lock, dump_misc2, dump_avatar, dump_misc3,
  dump_admin, dump_field_change
};

void print_action(int a){
  print_quoted_string
    (!a-- ? "join" :
     !a-- ? "part" :
     !a-- ? "say" :
     !a-- ? "misc1" :
     !a-- ? "start" :
     !a-- ? "stop" :
     !a-- ? "puck" :
     !a-- ? "team" :
     !a-- ? "lock" :
     !a-- ? "misc2" :
     !a-- ? "avatar" :
     !a-- ? "misc3" :
     !a-- ? "admin" :
     !a-- ? "field_change" :
     (fail("invalid action type"), ""));
}

void dump_action_fields(){
  int n = parse_byte();
  field("action");
  print_action(n);
  action_dumper[n]();
}

void dump_actions(){
  int can_idle = 1;
  begin_list();
  while(p.index < p.size){
    seperator();
    begin_object();
    if(can_idle && parse_bool()){
      field("idle");
      dump_uint();
      can_idle = 0;
    }else{
      field("player");
      dump_uint();
      dump_action_fields();
      can_idle = 1;
    }
    end_object();
  }
  if(p.index != p.size){
    fail("parse error");
  }
  end_list();
}

void dump_file(){
  begin_object();
  field("dumped_by");
  printf("%s", "\"" NAME_AND_VERSION "\"");
  wrote_value();
  field("version");
  version = parse_uint();
  printf("%d", version);
  wrote_value();
  skip_HBRP();
  field("frame_count");
  dump_uint();
  deflate_remaining();
  field("initial_state");
  dump_header();
  field("actions");
  dump_actions();
  end_object();
}

int main(int argc, char **argv){
  if(argc != 2){
    fputs("Please give path to hbr file as argument\n", stderr);
    return -1;
  }

  int fd = open(argv[1], O_RDONLY);
  if(fd == -1) return (perror("open"), 1);

  struct stat sb;
  if(fstat(fd, &sb) == -1) return (perror("fstat"), 1);
 
  p.buffer = mmap(NULL, sb.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
  if(p.buffer == MAP_FAILED) return (perror("mmap"), 1);
  p.index = 0;
  p.indent = sizeof(p.close);
  p.close[p.indent] = 0;
  p.size = sb.st_size;

  dump_file();
  putchar('\n');
  return 0;
}
