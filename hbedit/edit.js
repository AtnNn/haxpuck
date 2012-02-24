// AtnNn's HBS Editor
//
// Copyright 2011 Etienne Laurin
// All rights reserved

// TODO:
// when looking for mirrors, segments aren't found
// cut/delete in mirror mode: delete enabled mirrors, save enabled directions list in snippet
// paste in mirror mode: paste in all enabled directions from snippet
// TODO: automatic mirroring of property edits
// TODO: snap curves and segments to same tangent as other curves and segments on the vertex
// TODO: add default values when completing
// TODO: remove property from object
// TODO: pasting a snippet with a segment whose vertex is not snipped should reconnect the segment with that vertex
// TODO: snap vertex to circle formed by tangents of its segments
// TODO: snap begin point of move,scale or rotate to disc, vertex or plane inside the selection
// TODO: snap end point of move, scale or rotate to objects and snap points outside the selection
// TODO: snap both points of other tool to snap points
// TODO: custom ui for each type or property
// TODO: window.onerror catch exceptions and log them on server
//
// TODO: initial position of players is wrong if there are planes involved
// TODO: lines in hockey stadium have different color and are dashed
// TODO: simple mode with only trait and color as properties (with a list of pre-made traits)
// TODO: sometimes the canvas or the stadium property page doesnt show. resizing the window fixes it
// TODO: after load, scroll the canvas_div to the center of the stadium
// TODO: full screen mode
// TODO: group and lock
// TODO: hover text on buttons and properties
// TODO: save stadium to local browser cache
// TODO: change layers
// TODO: set center tool for multiple selected curved segments
// TODO: add 'create trait', 'save trait' and 'load trait' button to properties tab's trait input box
// TODO: don't set properties if they ara the same in the trait
// TODO: anti-aliasing and zoom
// TODO: split segment at any point, and possibility to merge to adjacent points
// TODO: properties of stadium (including traits and background)
// TODO: color picker with palette of common haxball colors
// TODO: better source editor (highlighting, intergrated consistency check, color picker, autocompletion, etc..)
// TODO: comment and organise code
// TODO: import stadiums from hbr files
// TODO: don't use relative difference when moving.. snap the cursor to the object
// TODO: style the scrollbars to be like haxball
// TODO: edit traits
// TODO: color palette: clicking on color changes color of selection
// TODO: advanced tool for editing background
// TODO: there is a minimum to the visible height and width
// TODO: auto lift common properties as traits
// TODO: replace magic numbers with constants
// TODO: commmon x and y property for vertex.{x, y}, disc.pos and goal.{p0, p1}
// TODO: tool to swap vertices of a segment
// TODO: copy properties/paste properties

// DEBUG
//console={log:function(){}};
function tracef(name, f){
    return function(){
        var ret = f.apply(this, arguments);
        console.log(name, arguments, ret);
        return ret;
    };
}


//===== Config Variables

// extra border around the stadium inside the canvas
var margin = 0;

// minimum distance before a click becomes a drag
var minimum_drag_distance = 4;

// maximum distance from which an object can be clicked
var maximum_click_distance = 5;

// distance from which to snap to nearby objects
var snap_distance = 5;

// number of undo savepoints to keep
var undo_levels = 500;

// colors of objects that invisible in haxball
var colors = {
    selected: 'rgba(256,256,0,0.8)',
    vertex: 'rgba(256,0,256,1)',
    invisible_thick: 'rgba(255,255,255,0.8)',
    invisible_thin: 'rgba(0,0,0,0.8)',
    plane_thick: 'rgba(0,0,0,0.8)',
    plane_thin: 'rgba(255,255,255,0.8)',
    red: {thick: 'rgba(255,127,127,1)',
          thin: 'rgba(255,0,0,0.8)'},
    blue:{thick: 'rgba(127,127,255,1)',
          thin: 'rgba(0,0,255,0.8)'}
};



//===== Haxball Values

// values harcoded in haxball
var haxball = {
    hockey: {
        bg_color: 'rgb(85, 85, 85)',
        border_color: 'rgb(233,204,110)'
    },
    grass: {
        bg_color: 'rgb(113,140,90)',
        border_color: 'rgb(199,230,189)'
    },
    segment_color: 'rgb(0,0,0)',
    disc_color: 'rgb(255,255,255)',
    default_disc_radius: 10
};

var properties = (function(p){return {
    bCoef: p(false, 'number'),
    speed: p(false, 'point'),
    cMask: p(false, 'layers'),
    cGroup: p(false, 'layers'),
    trait: p(false, 'trait'),
    x: p(true, 'number', true),
    y: p(true, 'number', true),
    v0: p(true, 'ref', true),
    v1: p(true, 'ref', true),
    curve: p(true, 'number'),
    vis: p(false, 'bool'),
    color: p(false, 'color'),
    normal: p(true, 'point', true),
    dist: p(true, 'number', true),
    radius: p(false, 'number'),
    invMass: p(false, 'number'),
    pos: p(true, 'point'),
    p0: p(true, 'point', true),
    p1: p(true, 'point', true),
    team: p(true, 'team'),
    damping: p(true, 'number')
};})(function(required, type, nodefault){
    return { required: required, type: type, def: !nodefault };
});

var type_properties = {
    vertexes: ['x', 'y', 'bCoef', 'cMask', 'cGroup', 'trait'],
    segments: ['v0', 'v1', 'curve', 'vis', 'color', 'bCoef', 'cMask', 'cGroup', 'trait'],
    planes: ['normal', 'dist', 'bCoef', 'cMask', 'cGroup', 'trait'],
    discs: ['radius', 'invMass', 'pos', 'color',  'bCoef', 'cMask', 'cGroup', 'trait', 'damping', 'speed'], 
    goals: ['p0', 'p1', 'team']
};

// TODO: complete this table
var defaults = {
    discs: {
        radius: 10
    }
};

// Maximums
var maximum_curve = 340;



//==== Program State

// the stadium json (with additional _data fields)
var stadium = {};

// user info when logged in
var user_info = false;

// session id
var session_id = 0;

// the canvas html element
var canvas;

// the currently active tool
var current_tool;

// the position from which to drag
var drag_start_pos;

// savepoints for undo and redo
var undo_savepoints = [];
var redo_savepoints = [];

// Clipboard
var clipboard;

// center of rotation and scale
var transformation_center = [0,0];

// is the mouse clicked?
var mouse_left_down = false;
var mouse_dragging = false;

// total number of fully selected objects
var total_selected_by_type;
var total_selected_by_prop;

// dynamic settings
var settings = {
    preview: false
};

// additional elements to render over the stadium (used for debugging)
var debug_render = [];

// Functions that populate input fields when a new stadium is loaded
var field_setters = [];

// can leave without prompt
var can_leave = false;

// Triggers

triggers = {
    select: [],
    unselect: [],
    set_tool: [],
    reset_selection: []
};

// Property data
var property_data = {};

// cache of patterns
var bg_patterns = {};

// cached window width
var window_width = 800;

// cached canvas size info
var canvas_rect = [-150, -75, 150, 75];

// cached mouse position
var current_mouse_position = false;

// mirror mode
var mirror_mode = false;
var mirror_directions = ['horizontal', 'vertical', 'across'];

// directions in which mirroring is disabled
var disabled_mirroring = {};

// saving
var last_save_id = false;
var last_save_name = false;

// library
var library = {
    list: [],
    last: false,
    query: 'public',
    initialised: false
}

//===== Aliases

var pi = Math.PI;
var tau = Math.PI*2;
var abs = Math.abs;
var round = Math.round;
var max = Math.max;
var min = Math.min;
var cos = Math.cos;
var sin = Math.sin;



//==== Initilisation

$(function(){
    check_logged_in();

    $('#stadium_editor_link').click(function(){
        hide_box();
        return false;
    });

    $('#library_link').click(function(){
        show_box('library');
        if(!library.initialised){
            library_query();
            library.initialised = true;
        }
        return false;
    });

    $('#library_button_public').click(function(){
        if(!$(this).hasClass('active')){
            $(this).addClass('active').siblings().removeClass('active');
            library.query = 'public';
            library_query();
        }
    });

    $('#library_button_saved').click(function(){
        if(!$(this).hasClass('active')){
            $(this).addClass('active').siblings().removeClass('active');
            library.query = 'saved';
            library_query();
        }
    });

    $('#button_library_edit').click(function(){
        library_edit();
    });

    $('#button_library_delete').click(function(){
        library_delete();
    });

    $('#login_link').click(function(){
        show_box('login');
        return false;
    });

    $('#register_link').click(function(){
        show_box('register');
        return false;
    });

    $('#logout_link').click(function(){
        logout();
        return false;
    });

    $('#button_login_login').click(function(){
        login();
    });

    $('#button_login_close').click(function(){
        hide_box();
    });

    $('#button_register_register').click(function(){
        register();
    });

    $('#button_register_close').click(function(){
        hide_box();
    });

    load_tile('grass');
    load_tile('hockey');

    $(window).bind('beforeunload', function(){
        if(!can_leave)
            return "Close the stadium editor?";
    });

    reset_selection();

    canvas = document.getElementById('canvas');

    if(!canvas.getContext){
        alert('Unable to initialise canvas. Your browser may be too old.');
        return;
    }
    
    initialise_properties_css();
    populate_tab_properties();
    
    connect_field($('#input_name'), 'name');
    connect_field($('#prop_spawnDistance'), 'spawnDistance', parseFloat);
    connect_field($('#prop_width'), 'width', parseFloat);
    connect_field($('#prop_height'), 'height', parseFloat);
    connect_field($('#prop_bg_type'), 'bg.type');
    connect_field($('#prop_bg_height'), 'bg.height', parseFloat);
    connect_field($('#prop_bg_width'), 'bg.width', parseFloat);
    connect_field($('#prop_bg_cornerRadius'), 'bg.cornerRadius', parseFloat);
    connect_field($('#prop_bg_kickOffRadius'), 'bg.kickOffRadius', parseFloat);
    connect_field($('#prop_pp_bCoef'), 'playerPhysics.bCoef', parseFloat);
    connect_field($('#prop_pp_invMass'), 'playerPhysics.invMass', parseFloat);
    connect_field($('#prop_pp_damping'), 'playerPhysics.damping', parseFloat);
    connect_field($('#prop_pp_acceleration'), 'playerPhysics.acceleration', parseFloat);
    connect_field($('#prop_pp_kickingAcceleration'), 'playerPhysics.kickingAcceleration', parseFloat);
    connect_field($('#prop_pp_kickingDamping'), 'playerPhysics.kickingDamping', parseFloat);
    connect_field($('#prop_pp_kickStrength'), 'playerPhysics.kickStrength', parseFloat);
    connect_field($('#prop_bp_radius'), 'ballPhysics.radius', parseFloat);
    connect_field($('#prop_bp_bCoef'), 'ballPhysics.bCoef', parseFloat);
    connect_field($('#prop_bp_invMass'), 'ballPhysics.invMass', parseFloat);
    connect_field($('#prop_bp_damping'), 'ballPhysics.damping', parseFloat);
    connect_field($('#prop_bp_color'), 'ballPhysics.color', parseColor);
    connect_field($('#prop_bp_cMask'), 'ballPhysics.cMask', parseMaskList);
    connect_field($('#prop_bp_cGroup'), 'ballPhysics.cGroup', parseMaskList);
    load(new_stadium());
    modified();

    set_tool(tool_select);

    $('#button_library_new').click(function(){
        load(new_stadium());
        hide_box();
        modified();
    });

    $('#button_import').click(function(){
        $('#textarea_import').val(pprint(stadium));
        show_box('import');
    });

    $('#button_import_cancel').click(function(){
        hide_box();
    });

    $('#button_import_select_all').click(function(){
        $('#textarea_import').select();
    });

    $('#button_import_clear').click(function(){
        $('#textarea_import').val('');
    });

    $('#button_import_import').click(function(){
        var st;
        try {
            st = eval('[' + $('#textarea_import').val() + ']')[0];
        } catch (error) {
            st = undefined;
        }
        if(!st){
            alert('Error Importing Stadium');
            return;
        }
        load(st);
        modified();
        hide_box();
    });
    
    $('#button_import_goto').click(function(){
        var pos = prompt('Character Position?');
        if(pos)
            set_selection_range($('#textarea_import')[0], parseInt(pos, 10), parseInt(pos, 10)+10);
    });

    $('#button_properties').click(function(){
        toggle_properties();
    });

    $('#button_save').click(function(){
        save();
    });

    $('#button_download').click(function(){
        download();
    });

    $('#button_help').click(function(){
        show_box('help');
    });

    $('#button_help_close').click(function(){
        hide_box();
    });    

    add_tool(tool_select);
    add_tool(tool_segment);
    add_tool(tool_disc);
    add_tool(tool_vertex);
    add_tool(tool_plane);
    add_tool(tool_goal);
    add_tool(tool_rotate);
    add_tool(tool_scale);

    $('#button_undo').click(function(){
        undo();
    });

    $('#button_redo').click(function(){
        redo();
    });

    $('#button_delete').click(function(){
        if(delete_selected(stadium))
            modified();
    });

    $('#button_select_all').click(function(){
        select_all();
    });


    $('#button_select_none').click(function(){
        select_all(function(){ return false; });
    });

    $('#button_inverse_selection').click(function(){
        select_all(function(shape){ return !selected(shape.object); });
    });

    $('#button_copy').click(function(){
        copy();
    });

    $('#button_paste').click(function(){
        paste();
        modified();
    });

    $('#button_cut').click(function(){
        cut();
        modified();
    });

    $('#button_duplicate').click(function(){
        duplicate();
        modified();
    });

    $('#button_mirror_mode').click(function(){
        mirror_mode = mirror_mode ? false : true;
        if(mirror_mode){
            $('#button_mirror_mode').addClass('active');
            reset_mirror_data(stadium);
        }else{
            $('#button_mirror_mode').removeClass('active');
            clear_mirror_data(stadium);
        }
    });

    $('#pref_preview').click(function(){
        $('#pref_preview').toggleClass('active');
        settings.preview = $('#pref_preview').hasClass('active');
        queue_render();
    });


    define_tab('properties');
    define_tab('advanced');
    define_tab('edit');

    $(canvas).mousedown(handle_down);
    $(canvas).mouseup(handle_up);
    $(canvas).mousemove(handle_move);
    $(document).bind('keydown', handle_key);

    resize();
    $(window).resize(resize);
});

// Replace the current stadium with a new stadium
function load(st){
    stadium = st;

    if(!st.bg) st.bg = {};
    if(!st.vertexes) st.vertexes = {};
    if(!st.segments) st.segments = {};
    if(!st.discs) st.discs = {};
    if(!st.goals) st.goals = {};
    if(!st.planes) st.planes = {};
    if(!st.traits) st.traits = {};

    field_setters = $.grep(field_setters, function(f){ return f(); });

    reset_selection();

    for_all_shapes(st, function(shape){
        if(selected(shape.object)){
            trigger('select', shape);
        }
    });

    resize_canvas();

    // TODO: ui and stadium validation
    // validation: all required elems are there, warn on unrelated elems
    // no elems are out of bounds or invalid values
    // max 255 of each type
}

// handler for the window resize event
function resize(){
    var h = $(window).height();
    $('#table').height(h - 46);
    $('#box').height(h - 126);
    var w = $(window).width();
    window_width = w;
    var cdp = $('#canvas_div_placeholder');
    var off = cdp.offset();
    var cd = $('#canvas_div');
    cd.css(off);
    w = cdp.width();
    cd.width(w);
    h = cdp.height();
    cd.height(h);
    resize_canvas();
}

// Generate a mostly empty stadium
function new_stadium(){

    return {
        name: "New Stadium",
        width: 420,
        height: 200,
        spawnDistance: 170,
        bg: {},
        vertexes: [],
        segments: [],
        goals: [],
        discs: [],
        planes: [],
        traits: {
            "ballArea" : { "vis" : false, "bCoef" : 1, "cMask" : ["ball"] },
            "goalPost" : { "radius" : 8, "invMass" : 0, "bCoef" : 0.5 },
            "goalNet" : { "vis" : true, "bCoef" : 0.1, "cMask" : ["ball"] }, 
            "kickOffBarrier" : { "vis" : false, "bCoef" : 0.1, "cGroup" : ["redKO", "blueKO"], "cMask" : ["red", "blue"] }
        }
    };
}

function show_box(name){
    $('#table').addClass('hidden');
    $('#box' + name).removeClass('hidden').siblings().addClass('hidden');
    $('#box').removeClass('hidden');
}

function hide_box(name){
    $('#box').addClass('hidden');
    $('#table').removeClass('hidden');
    resize();
}

function pprint(j, l, tag){
    if(!l) l = 0;
    if(j.substr){
        return quote(j);
    }else if(typeof j == 'number'){
        return j.toString();
    }else if(typeof j == 'boolean'){
        return j.toString();
    }else if(j instanceof Array){
        l++;
        var trait = j[0] ? j[0].trait : "";
        var ret = "[" + indent(l);
        var first = true;
        $.each(j, function(i, x){
            var d = "";
            if(x.trait != trait){
                d = indent(l);
                trait = x.trait;
            }
            ret += (first ? "" : "," + d + indent(l)) + (tag ? "/* " + i +" */ " : "") + pprint(x, l);
            first = false;
        });
        return ret + indent(l-1) + "]";
    }else{
        l++;
        var ret = "{" + indent(l);
        var first = true;
        $.each(j, function(k, v){
            if(v !== undefined && k != '_data'){
                var i = k == 'bg' ? 2 : l;
                ret += (first ? "" : "," + indent(l)) + quote(k) + " : " + pprint(v, i, k == 'vertexes' && i < 10);
                first = false;
            }
        });
        return ret + indent(l - 1, true) + "}";
    }
    return "JSON ERROR";
}

function indent(l, b){
    return l === 0 ? "\n" : l == 1 ? "\n\n\t" : l == 2 && !b ? "\n\t\t" : l == 3 || b ? " " : "";
}


// copied from json2.js //

var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
var meta = {'\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'};

function quote(string) {
    escapable.lastIndex = 0;
    return escapable.test(string) ? '"' +
        string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
}

// end of json2.js code //

function center_canvas(pt){
    // TODO: this functions doesn't work when the div is hidden
    
    var w = $(canvas_div).width();
    var h = $(canvas_div).height();

    if(!pt)
        return [$('#canvas_div').scrollLeft()+w/2+canvas_rect[0],
                $('#canvas_div').scrollTop()+h/2+canvas_rect[1]];

    $('#canvas_div').scrollLeft(pt[0]-w/2-canvas_rect[0]).scrollTop(pt[1]-h/2-canvas_rect[1]);
}

function render(st){

    var transform;

    if(current_tool && current_tool.transform){
        transform = function(shape, draw){
            ctx.save();
            current_tool.transform(st, ctx, shape, draw);
            ctx.restore();
        };
    }else{
        transform = function(shape, draw){ draw(); };
    }

    var ctx = canvas.getContext('2d');

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.clearRect(0, 0, canvas_rect[2] - canvas_rect[0], canvas_rect[3] - canvas_rect[1]);

    ctx.translate(-canvas_rect[0], -canvas_rect[1]);
    
    if(settings.preview){
        ctx.beginPath();
        ctx.moveTo(-st.width, -st.height);
        ctx.lineTo(st.width, -st.height);
        ctx.lineTo(st.width, st.height);
        ctx.lineTo(-st.width, st.height);
        ctx.clip();
    }

    renderbg(st, ctx);

    if(!settings.preview) $.each(st.planes, function(i, plane){
        transform(Shape('planes', plane, i), function(){
            var ext = plane_extremes(st, plane);
            ctx.beginPath();
            ctx.moveTo(ext.a[0], ext.a[1]);
            ctx.lineTo(ext.b[0], ext.b[1]);
            if(selected(plane)){
                ctx.lineWidth = 3;
                ctx.strokeStyle = colors.selected;
                ctx.stroke();
            }
            ctx.lineWidth = 2;
            ctx.strokeStyle = colors.plane_thick;
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.strokeStyle = colors.plane_thin;
            ctx.stroke();
        });
    });

    if(!settings.preview) $.each(st.vertexes, function(i, vertex){
        transform(Shape('vertexes', vertex, i), function(){
            vertex=complete(st, vertex);
            ctx.fillStyle = selected(vertex) ? colors.selected : colors.vertex;
            ctx.fillRect(vertex.x-3, vertex.y-3, 6, 6);
        });
    });

    $.each(st.segments, function(i, segment){
        transform(Shape('segments', segment, i), function(){
            segment = complete(st, segment);
            render_segment_arc(ctx, segment, segment_arc(st, segment));
        });
    });

    if(!settings.preview) $.each(st.goals, function(i, goal){
        transform(Shape('goals', goal, i), function(){
            goal = complete(st, goal);
            ctx.beginPath();
            ctx.moveTo(goal.p0[0], goal.p0[1]);
            ctx.lineTo(goal.p1[0], goal.p1[1]);
            if(selected(goal)){
                ctx.lineWidth = 4;
                ctx.strokeStyle = colors.selected;
                ctx.stroke();
            }
            ctx.lineWidth = 2;
            ctx.strokeStyle = colors[goal.team].thick;
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.strokeStyle = colors[goal.team].thin;
            ctx.stroke();
        });
    });

    $.each(st.discs, function(i, disc){
        transform(Shape('discs', disc, i), function(){
            disc = complete(st, disc);
            ctx.beginPath();
            var radius = disc.radius !== undefined ? disc.radius : haxball.default_disc_radius;
            ctx.arc(disc.pos[0], disc.pos[1], radius, 0, Math.PI*2, true);
            if(selected(disc) && !settings.preview){
                ctx.lineWidth = 5;
                ctx.strokeStyle = colors.selected;
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgb(0,0,0)';
            ctx.lineWidth = 2;
            ctx.fillStyle = color_to_style(disc.color, haxball.disc_color);
            ctx.fill();
            ctx.stroke();
        });
    });

    $.each(debug_render, function(i, f){ f(ctx); });

    if(settings.preview){
        // TODO: use exact colors and sizes

        // draw puck
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI*2, true);
        ctx.fillStyle = 'rgb(255,255,255)';
        ctx.strokeStyle = 'rgb(0,0,0)';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        
        // draw red
        ctx.beginPath();
        ctx.arc(-st.spawnDistance, 0, 15, 0, Math.PI*2, true);
        ctx.fillStyle = 'rgb(240,0,0)';
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        // draw blue
        ctx.beginPath();
        ctx.arc(st.spawnDistance, 0, 15, 0, Math.PI*2, true);
        ctx.fillStyle = 'rgb(0,0,248)';
        ctx.fill();
        ctx.stroke();

    }

    if(!settings.preview && current_tool && current_tool.render){
        current_tool.render(ctx);
    }

}

function render_segment_arc(ctx, segment, arc){
    ctx.beginPath();
    if(arc.curve){
        ctx.arc(arc.center[0], arc.center[1], arc.radius, arc.from, arc.to, false);
    }else{
        ctx.moveTo(arc.a[0], arc.a[1]);
        ctx.lineTo(arc.b[0], arc.b[1]);
    }

    if(segment.vis !== false){
        if(selected(segment) && !settings.preview){
            ctx.lineWidth = 5;
            ctx.strokeStyle = colors.selected;
            ctx.stroke();
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = color_to_style(segment.color, haxball.segment_color);
        ctx.stroke();
    }else if(!settings.preview){
        if(selected(segment)){
            ctx.lineWidth = 3;
            ctx.strokeStyle = colors.selected;
            ctx.stroke();
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.invisible_thick;
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = colors.invisible_thin;
        ctx.stroke();
    }
}

function renderbg(st, ctx){
    var bg = st.bg;
    ctx.save();

    if(bg.type == 'grass' || bg.type == 'hockey'){

        ctx.fillStyle = haxball[bg.type].bg_color;
        ctx.fillRect(-st.width, -st.height,
                     2 * st.width, 2 * st.height);

        ctx.beginPath();
        
        ctx.moveTo(-bg.width + bg.cornerRadius, -bg.height);
        // TODO: this border doesn't render well in iceweasel
        ctx.arcTo(bg.width, -bg.height, bg.width, -bg.height + bg.cornerRadius, bg.cornerRadius);
        ctx.arcTo(bg.width, bg.height, bg.width - bg.cornerRadius, bg.height, bg.cornerRadius);
        ctx.arcTo(-bg.width, bg.height, -bg.width, bg.height - bg.cornerRadius, bg.cornerRadius);
        ctx.arcTo(-bg.width, -bg.height, -bg.width + bg.cornerRadius, -bg.height, bg.cornerRadius);

        ctx.save();
        ctx.clip();
        ctx.fillStyle = bg_patterns[bg.type];
        ctx.fillRect(-st.width, -st.height, 2 * st.width, 2 * st.height);
        ctx.restore();

        ctx.moveTo(0, -bg.height);
        ctx.lineTo(0, -bg.kickOffRadius);
        ctx.moveTo(bg.kickOffRadius, 0);
        ctx.arc(0, 0, bg.kickOffRadius, 0, Math.PI*2, true);
        ctx.moveTo(0, bg.kickOffRadius);
        ctx.lineTo(0, bg.height);

        ctx.lineWidth = 3;
        ctx.strokeStyle = haxball[bg.type].border_color;
        ctx.stroke();
    }else{
        ctx.fillStyle = haxball.grass.bg_color;
        ctx.fillRect(-st.width, -st.height, 2 * st.width, 2 * st.height);
    }

    ctx.restore();
}

function complete(st, o){
    if(o.trait){
        return $.extend({}, st.traits[o.trait], o);
    }
    return $.extend({}, o);
}

function complete_shape_object(st, shape){
    // TODO: replace all instances of complete(st, shape.object) with a call to this function
    var ret = {};
    if(defaults[shape.type]){
        $.extend(ret, defaults[shape.type]);
    }
    if(shape.object.trait){
        $.extend(ret, st.traits[shape.object.trait]);
    }
    $.extend(ret, shape.object);
    return ret;
}

function norm(v){
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

function dist(a, b){
    return norm([a[0]-b[0], a[1]-b[1]]);
}

function normalise(v){
    var k = norm(v);
    
    var x = v[0] / k;
    var y = v[1] / k;
    
    return [x,y];
}

function handle_down(ev){
    $(document.activeElement).blur();
    if(ev.which != 1)
        return;
    mouse_left_down = true;
    mouse_dragging = false;
    var pt = translate_coords([ev.pageX, ev.pageY]);
    drag_start_pos = pt;
    current_tool.down(pt, ev);
    return false;
}

function translate_coords(p){
    var off = $(canvas).offset();
    var pt = [p[0] - off.left + canvas_rect[0],
              p[1] - off.top + canvas_rect[1]];
    return pt;
}


function handle_up(ev){
    var ret;
    if(ev.which != 1)
        return;
    mouse_left_down = false;
    var pt = translate_coords([ev.pageX, ev.pageY]);
    if(mouse_dragging){
        mouse_dragging = false;
        current_tool.end_drag(drag_start_pos, pt, ev);
    }else{
        current_tool.click(pt, ev);
    }
    drag_start_pos = false;
    return false;
}

function handle_key(ev){
    //console.log('key', ev.which);

    if(ev.ctrlKey){
        return;
    }else if($(ev.target).is('textarea')){
        return;
    }else if($(ev.target).is('input')){
        if(ev.which == 13){ // RET
            $(document.activeElement).blur();
            return false;
        }
        return;
    }

    switch(ev.which){
    case 90: // Z
    case 85:// U
        undo();
        return false;
    case 82: // R
        redo();
        return false;
    case 46: // DEL
        if(delete_selected(stadium))
            modified();
        return false;
    case 65: // A
        select_all();
        return false;
    case 67: // C
        copy();
        return false;
    case 88: // X
        cut();
        modified();
        return false;
    case 86: // V
        paste();
        modified();
        return false;
    case 68: // D
        duplicate();
        modified();
        return false;
    case 49: // 1
    case 50: // 2
    case 51: // 3
    case 52: // 4
    case 53: // 5
    case 54: // 6
    case 55: // 7
    case 56: // 8
        set_tool([tool_select, tool_rotate, tool_scale, tool_segment,
                  tool_vertex, tool_disc, tool_goal, tool_plane]
                 [ev.which - 49]);
        return false;
    default:
        return current_tool.key(ev.which, ev);
    }
}

function handle_move(ev){
    var div_mousepos = $('#mousepos');
    var pt = translate_coords([ev.pageX, ev.pageY]);
    current_mouse_position = pt;
    if(window_width < ev.pageX * 2){
        div_mousepos.removeClass('left').addClass('right');
    }else{
        div_mousepos.removeClass('right').addClass('left');
    }
    var update_pos = true;
    if(mouse_left_down){
        if(!mouse_dragging && dist(pt, drag_start_pos) >= minimum_drag_distance){
            mouse_dragging = true;
        }
        if(mouse_dragging &&
           current_tool.dragging &&
           current_tool.dragging(drag_start_pos, pt, ev) === false){
            update_pos = false;
        }
    }else{
        if(current_tool.moving && current_tool.moving(pt, ev) === false)
            update_pos = false;
    }
    if(update_pos)
        div_mousepos.text(pt[0] + ', ' + pt[1]);
}

var tool_select = {
    name: 'select',
    cursor: 'default',
    init: function(){
        this.drag_type = false;
    },
    down: function(pt, ev){
        var shape = under_point(stadium, pt);
        this.shape = shape;
        if(!shape){
            this.drag_type = 'select';
            if(!(ev.shiftKey || ev.ctrlKey)){
                clear_selection(stadium);
            }
        }else{
            if(shape.type == 'segments'){
                this.drag_type = 'segment';
            }else{
                this.drag_type = 'move';
            }
            this.keep_others = ev.shiftKey || ev.ctrlKey;
            if(!selected(shape.object)){
                this.shape_selected = false;
                if(!this.keep_others)
                    clear_selection(stadium);
                select_shape(stadium, shape);
            }else{
                this.shape_selected = true;
            }
        }
        queue_render();
    },
    click: function(pt, ev){
        if(this.shape){
            if(this.shape_selected){
                if(this.keep_others){
                    unselect_shape(stadium, this.shape);
                }else{
                    clear_selection(stadium);
                }
            }
        }
        update_savepoint();
    },
    end_drag: function(from, to, ev){
        this.transform = false;
        this.drag_type = false;
        var shape = this.shape;
        if(!shape){
            select_rect(stadium, from, to);
            update_savepoint();
        }else if(shape.type == 'segments'){
            curve_segment_to_point(stadium, shape.object, to);
            modified();
        }else{
            if(for_selected(stadium, move_obj, from, to)){
                update_mirrored_geometry_selected(stadium);
                resize_canvas();
                modified();
            }
        }
    },
    key: function(){},
    dragging: function(from, to, ev){
        this.drag_from = from;
        this.drag_to = to;

        this.transform = (
            this.drag_type == 'move' ? transform_drag_move :
                this.drag_type == 'segment' ? transform_drag_curve :
                false);
        queue_render();
        if(this.drag_type == 'select'){
            $('#mousepos').text(Math.abs(from[0]-to[0])+' x '+Math.abs(from[1]-to[1]));
            return false;
        }else if(this.drag_type == 'move'){
            // bad idea
            //$('#mousepos').text('V '+(to[0]-from[0])+', '+(to[1]-from[1]));
            //return false;
        }else if(this.drag_type == 'segment'){
            return false;
        }
    },
    render: function(ctx){
        if(mouse_dragging && this.drag_type == 'select'){
            var a = this.drag_from;
            var b = this.drag_to;
            ctx.fillStyle = 'rgba(213,243,56,0.5)';
            ctx.fillRect(a[0], a[1], b[0]-a[0], b[1]-a[1]);
        }
    }
};

function transform_drag_curve(st, ctx, shape, draw){
    if(!this.shape || shape.object != this.shape.object){
        draw();
        return;
    }

    var seg = complete(st, shape.object);
    var arc = segment_arc_to_point(st, seg, this.drag_to);

    $('#mousepos').text(Math.round(arc.curve) + '°');

    render_segment_arc(ctx, seg, arc);
}

function transform_drag_move(st, ctx, shape, draw){
    if(shape_fully_selected(st, shape))
        ctx.translate(this.drag_to[0] - this.drag_from[0],
                      this.drag_to[1] - this.drag_from[1]);
    draw();
}

var tool_rotate = {
    name: 'rotate',
    cursor: 'default',
    init: function(){
        queue_render();
    },
    down: function(pt, ev){
        this.drag_from = pt;
    },
    click: function(pt, ev){
        transformation_center = pt;
        queue_render();
    },
    end_drag: function(from, to, ev){
        var cs = angle_cs_three(transformation_center, from, to);
         if(for_selected(stadium, rotate_obj, transformation_center, cs[0], cs[1])){
             update_mirrored_geometry_selected(stadium);
            resize_canvas();
            modified();
        }
    },
    key: function(){},
    render: render_transformation_center,
    dragging: function(from, to, ev){
        this.drag_to = to;
        $('#mousepos').text(round(three_point_angle(from, transformation_center, to)*180/pi)+'°');
        queue_render();
        return false;
    },
    transform: function(st, ctx, shape, draw){
        if(mouse_dragging && shape_fully_selected(st, shape)){
            var o = transformation_center;
            ctx.translate(o[0], o[1]);
            var cs = angle_cs_three(transformation_center, this.drag_from, this.drag_to);
            ctx.rotate(angle_to([0,0], cs));
            ctx.translate(-o[0], -o[1]);
        }
        draw();
    }
};

function angle_cs_three(o, from, to){
    var b = normalise(point_subtract(from, o));
    var a = normalise(point_subtract(to, o));
    var cos = a[0] * b[0] + a[1] * b[1];
    var sin = -a[0] * b[1] + a[1] * b[0];
    return [cos, sin];
}

function set_tool(t){
    var old_tool = current_tool;
    current_tool = t;
    $('#button_tool_'+t.name).siblings('button').removeClass('active');
    $('#button_tool_'+t.name).addClass('active');
    $(canvas).css('cursor', t.cursor);
    t.init();
    trigger('set_tool', t, old_tool);
    queue_render();
}

function unselect_shape(st, shape){
    shape_set_selected(shape, false);
    if(shape.type == 'segments'){
        var s = shape.object;
        if(selected(st.vertexes[s.v0]) == 'segment')
            shape_set_selected(Shape('vertexes', st.vertexes[s.v0], s.v0), false);
        if(selected(st.vertexes[s.v1]) == 'segment')
            shape_set_selected(Shape('vertexes', st.vertexes[s.v1], s.v1), false);
    }

}

function select_shape(st, shape){
    shape_set_selected(shape,true);
    if(shape.type == 'segments'){
        var s = shape.object;
        if(!selected(st.vertexes[s.v0]))
            shape_set_selected(Shape('vertexes', st.vertexes[s.v0], s.v0), 'segment');
        if(!selected(st.vertexes[s.v1]))
            shape_set_selected(Shape('vertexes', st.vertexes[s.v1], s.v1), 'segment');
    }
}

function toggle_select_shape(st, shape){
    if(selected(shape.object)){
        unselect_shape(st, shape);
        return false;
    }else{
        select_shape(st, shape);
        return true;
    }
}

function data(obj, k, v){
    if(v === undefined){
        return obj._data ? obj._data[k] : undefined;
    }
    if(!obj._data)
        obj._data = {};
    obj._data[k] = v;
}

function clear_selection(st){
    var count = 0;
    for_all_shapes(st, function(shape){
        if(selected(shape.object)){
            shape_set_selected(shape,false);
            count ++;
        }
    });
    return count;
}

function under_point(st, pt, type){
    var obj;
    var index;

    // check objects in reverse order thet they were rendered
    // which is, at first, the same as the reverse order in which they were created

    if(!type || type == 'discs'){
        eachRev(st.discs, function(i, disc){
            var d = complete_shape_object(st, Shape('discs', disc, i));
            if(dist(d.pos, pt) - d.radius <= maximum_click_distance){
                obj = disc;
                index = i;
                return false;
            }
        });

        if(obj) return Shape('discs', obj, index);
    }

    if(!type || type == 'goals'){
        eachRev(st.goals, function(i, goal){
            var g = complete(st, goal);
            if(point_next_to_line(pt, g.p0, g.p1, maximum_click_distance)){
                obj = goal;
                index = i;
                return false;
            }
        });

        if(obj) return Shape('goals', obj, index);
    }

    if(!type || type == 'vertexes'){
        eachRev(st.vertexes, function(i, vertex){
            var v = complete(st, vertex);
            if(dist([v.x, v.y], pt) <= maximum_click_distance){
                obj = vertex;
                index = i;
                return false;
            }
        });

        if(obj) return Shape('vertexes', obj, index);
    }

    if(!type || type == 'segment'){
        eachRev(st.segments, function(i, segment){
            if(segment_contains(st, segment, pt, maximum_click_distance)){
                obj = segment;
                index = i;
                return false;
            }
        });

        if(obj) return Shape('segments', obj, index);
    }

    if(!type || type == 'planes'){
        eachRev(st.planes, function(i, plane){
            var ext = plane_extremes(st, plane);
            if(point_next_to_line(pt, ext.a, ext.b, maximum_click_distance)){
                obj = plane;
                index = i;
                return false;
            }
        });

        if(obj) return Shape('planes', obj, index);
    }
}

function selected(obj){
    return obj._selected;
}

function shape_set_selected(shape, val){
    var sel = shape.object._selected;
    if(!sel  && val){
        trigger('select', shape);
    }else if(sel && !val){
        trigger('unselect', shape);
    }
    if(!val){
        val = undefined;
    }
    shape.object._selected = val;
}

function trigger(name,a,b){
    $.each(triggers[name], function(i, f){ f(a,b); });
}

function queue_render(){
    // if this function gets called too much, add a minimum delay between calls to render
    render(stadium);
}

function for_selected(st, f, a, b, c){
    var count = 0;
    for_all_shapes(st, function(shape){
        if(selected(shape.object)){
            f(st, shape, a, b, c);
            count ++;
        }
    });
    return count;
}

function for_all_shapes(st, types, f){
    if(!f){
        f = types;
        types = ['vertexes', 'segments', 'goals', 'discs', 'planes'];
    }

    $.each(types, function(i, name){
        var group = st[name];
        if(group){
            $.each(group, function(i, obj){
                return f(Shape(name, obj, i));
            });
        }
    });
}

function select_rect(st, a, b){
    var count = 0;
    // Segments after vertexes
    for_all_shapes(st, ['vertexes', 'goals', 'discs', 'segments'], function(shape){
        var obj = shape.object;
        var o = complete(st, obj);
        switch(shape.type){
        case 'vertexes':
            if(rectangle_contains(a, b, [o.x, o.y])){
                shape_set_selected(shape, true);
                count ++;
            }
            break;

        case 'goals':
            if(rectangle_contains(a, b, o.p0) &&
               rectangle_contains(a, b, o.p1)){
                shape_set_selected(shape, true);
                count ++;
            }                    
            break;

        case 'discs':
            if(rectangle_contains(a, b, o.pos) &&
               !near(o.pos[0], a[0], o.radius) &&
               !near(o.pos[0], b[0], o.radius) &&
               !near(o.pos[1], a[1], o.radius) &&
               !near(o.pos[1], b[1], o.radius)){
                shape_set_selected(shape, true);
                count ++;
            }
            break;

        case 'segments':
            if(selected(st.vertexes[o.v0]) && selected(st.vertexes[o.v1])){
                shape_set_selected(shape, true);
                count ++;
            }
        }
    });

    // TODO: count is wrong. includes shapes that were already selected
    return count;
}

function move_obj(st, shape, from, to){
    var type = shape.type;
    var obj = shape.object;

    var o = complete(st, obj);
    
    var vd = point_subtract(to, from);

    if(type == 'vertexes'){
        obj.x = o.x + vd[0];
        obj.y = o.y + vd[1];
    }
    
    if(type == 'discs'){
        obj.pos = point_add(o.pos, vd);
    }
    
    if(type == 'goals'){
        obj.p0 = point_add(o.p0, vd);
        obj.p1 = point_add(o.p1, vd);
    }

    if(type == 'planes'){
        obj.dist += dot_product(vd, o.normal) / norm(o.normal);
    }
}

var tool_segment = {
    name: 'segment',
    cursor: 'default',
    init: function(){},
    click: function(){},
    end_drag: function(from, to, ev){
        var shape = add_segment(stadium, from, to);
        select_shape(stadium, shape);
        var v = segment_vertices(stadium, shape);
        select_shape(stadium, v[0]);
        select_shape(stadium, v[1]);
        modified();
    },
    key: function(){},
    down: function(pt, ev){
        this.drag_from = pt;
        this.curve = get_prop_val('curve', 0);
    },
    dragging: function(from, to, ev){
        this.drag_to = to;
        $('#mousepos').text(Math.round(dist(from,to))+'; '+Math.round(angle_to(from, to)/Math.PI*180)+'°');
        queue_render();
        return false;
    },
    render: function(ctx){
        if(mouse_dragging){
            ctx.lineWidth = 3;
            ctx.strokeStyle = color_to_style(get_prop_val('color', '000000')); 
            var arc = calculate_arc(this.drag_from, this.drag_to, this.curve);
            ctx.beginPath();
            if(arc.radius){
                ctx.arc(arc.center[0], arc.center[1], arc.radius, arc.from, arc.to, false);
            }else{
                ctx.moveTo(this.drag_from[0], this.drag_from[1]);
                ctx.lineTo(this.drag_to[0], this.drag_to[1]);
            }
            ctx.stroke(); 
        }
    }
};

function add_segment(st, from, to, no_mirror){
    var sa = under_point(st, from, 'vertexes');
    var sb = under_point(st, to, 'vertexes');

    var a = sa || add_vertex(st, from, true);
    var b = sb || add_vertex(st, to, true);

    var obj = {
        v0: a.index,
        v1: b.index
    };

    obj = $.extend({}, get_props_for_type('segments'), obj);

    st.segments.push(obj);
    
    var shape = Shape('segments', obj, st.segments.length - 1);

    if(mirror_mode && !no_mirror){
        $.each(mirror_directions, function(i, dir){
            if(!mirroring_disabled[dir] && can_mirror_segment(from, to, dir, obj.curve)){
                var seg = add_segment(st, mirror_point(from, dir), mirror_point(to, dir), true);
                if(shape.object.curve && (dir == 'horizontal' || dir == 'vertical'))
                    seg.object.curve = -shape.object.curve;
                link_shapes(shape, seg, dir);
                var v = segment_vertices(st, seg);
                link_shapes(a, v[0], dir);
                link_shapes(b, v[1], dir);
            }
        });
    }
    
    return shape;
}

function can_mirror_segment(a, b, dir){
    var ret = true;
    if(sign(a[0]) * sign(b[0]) == -1){
        ret = ret && dir != 'horizontal' && dir != 'across'; 
    }
    if(sign(a[1]) * sign(b[1]) == -1){
        ret = ret && dir != 'vertical' && dir != 'across';
    }
    return ret;
}

function add_vertex(st, pt, no_mirror){
    var n = st.vertexes.length;
    var obj = {
        x: pt[0],
        y: pt[1]
    };

    obj = $.extend({}, get_props_for_type('vertexes'), obj);

    st.vertexes.push(obj);
    var shape = Shape('vertexes', obj, st.vertexes.length - 1);

    if(mirror_mode && !no_mirror){
        $.each(mirror_directions, function(i, dir){
            if(!mirroring_disabled(dir) && can_mirror_vertex(pt, dir)){
                var ver = add_vertex(st, mirror_point(pt, dir), true);
                link_shapes(shape, ver, dir);
            }
        });
    }

    return shape;
}

function can_mirror_vertex(pt, dir){
    if(pt[0] == 0)
        return dir == 'vertical' && pt[1] != 0;
    if(pt[1] == 0)
        return dir == 'horizontal';
    return true;
}

var tool_disc = {
    name: 'disc',
    cursor: 'default',
    init: function(){},
    down: function(pt, ev){
        this.drag_from = pt;
    },
    click: function(pt){
        var shape = add_disc(stadium, pt);
        select_shape(stadium, shape);
        resize_canvas();
        modified();
    },
    end_drag: function(from, to, ev){
        var shape = add_disc(stadium, from, dist(from, to));
        select_shape(stadium, shape);
        modified();
    },
    key: function(){},
    dragging: function(from, to, ev){
        this.drag_to = to;
        queue_render();
    },
    render: function(ctx){
        if(mouse_dragging){
            ctx.fillStyle = color_to_style(get_prop_val('color', 'FFFFFF'));
            ctx.beginPath();
            ctx.arc(this.drag_from[0], this.drag_from[1],
                    dist(this.drag_from, this.drag_to),
                    0, Math.PI*2, false);
            ctx.fill();
        }
    }
};

function add_disc(st, pt, r, is_mirror){
    var obj = {
        pos: [pt[0], pt[1]],
        radius: r
    };

    obj = $.extend({}, get_props_for_type('discs'), obj);

    st.discs.push(obj);
    var shape = Shape('discs', obj, st.discs.length - 1);

    if(mirror_mode && !is_mirror){
        $.each(mirror_directions, function(i, dir){
            if(!mirroring_disabled(dir) && can_mirror_vertex(pt, dir)){
                var dis = add_disc(st, mirror_point(pt, dir), r, true);
                link_shapes(shape, dis, dir);
            }
        });
    }

    return shape;
}

function load_tile(name){
    var tile = new Image(128, 128);
    tile.onload = function(){
        var ctx = canvas.getContext('2d');
        bg_patterns[name] = ctx.createPattern(tile, 'repeat');
        queue_render();
    };
    tile.src = name+'tile.png';
}

function color_to_style(color, def){
    if(!color){
        return def ? def : 'rgb(0,0,0)';
    }else if(color.substr){
        return '#' + color;
    }else{
        return 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
    }
}

function segment_arc(st, segment){
    var seg = segment_points(st, segment);

    var arc = data(segment, 'arc');

    if(arc && arc.a[0] == seg.a[0] && arc.a[1] == seg.a[1] &&
       arc.b[0] == seg.b[0] && arc.b[1] ==seg.b[1] && arc.curve == segment.curve){
        return arc;
    }

    arc = {a: seg.a, b: seg.b, curve: segment.curve};

    var curve = segment.curve;

    $.extend(arc, calculate_arc(seg.a, seg.b, curve));
    
    data(segment, 'arc', arc);

    return arc;
}

function calculate_arc(a, b, curve){
    var arc = {};

    if(curve === 0)
        return arc;

    if(curve < 0){
        curve = -curve;
        var c = a;
        a = b;
        b = c;
    }

    var c = [b[0] - a[0], b[1] - a[1]];
    var d = [
        a[0] + c[0] / 2,
        a[1] + c[1] / 2
    ];
    var nc = norm(c);

    if(curve == 180){
        arc.radius = nc/2;
        arc.center = d;
        arc.from = angle_to(d, a);
        arc.to = angle_to(d, b);
        return arc;
    }

    // |a-b| / sin A = r / sin (90 - A/2)
    var angle = curve * Math.PI / 180;
    var spa2 = Math.sin(Math.PI/2 - angle/2);
    var radius = Math.abs(nc * spa2 / Math.sin(angle));
    
    
    var cp = normalise([c[1], -c[0]]);

    var l = Math.sqrt((nc*nc/4) + radius*radius - nc*radius*Math.cos(Math.PI/2 - angle/2));

    if(curve > 180)
        l = -l;

    arc.radius = radius;
    
    arc.center = [
        d[0] - cp[0] * l,
        d[1] - cp[1] * l
    ];

    arc.from = angle_to(arc.center, a);
    arc.to = angle_to(arc.center, b);
    
    return arc;
}

function angle_to(o, p){
    return Math.atan2(p[1]-o[1], p[0]-o[0]);
}

function between(a, b, c){
    return (a <= c && c <= b) || (b <= c && c <= a);
}

function point_next_to_line(pt, a, b, d){
    return distance_line_point(a, b, pt) <= d &&
        three_point_angle(a, pt, b) > Math.PI/2;
}

function segment_contains(st, segment, pt, d){
    s = complete(st, segment);
    if(!s.curve || s.curve === 0){
        var seg = segment_points(st, segment);
        return point_next_to_line(pt, seg.a, seg.b, d);
    }else{
        var arc = segment_arc(st, s);
        return distance_circle_point(arc.center, arc.radius, pt) <= d &&
            clockwise_between(arc.from, arc.to, angle_to(arc.center, pt)); 
    }
}

function distance_line_point(a, b, p){
    return Math.abs(height_line_point(a, b, p));
}

function height_line_point(a, b, p){
    var d = dist(a, b);
    if(d === 0)
        return dist(a, p);
    return ((b[0]-a[0]) * (a[1]-p[1]) - (a[0]-p[0]) * (b[1]-a[1])) / d;
}

function distance_circle_point(c, r, p){
    return Math.abs(dist(c, p) - r);
}

function clockwise_between(a, b, c){
    // clockwise or anticlockwise??
    a = (a + Math.PI*2) % (Math.PI*2);
    b = (b + Math.PI*2) % (Math.PI*2);
    c = (c + Math.PI*2) % (Math.PI*2);
    return !((b <= c && c <= a) ||
             (c <= a && a <= b) || 
             (a <= b && b <= c));
}

function Shape(type, object, i){
    return {type: type, object: object, index: i};
}

function three_point_angle(a, o, b){
    var r = angle_to(o, a);
    var s = angle_to(o, b);
    var d = Math.abs(r - s);
    if(d > Math.PI)
        return Math.PI * 2 - d;
    return d;
}

function circumcenter(a, b, c){
    // http://en.wikipedia.org/wiki/Circumscribed_circle

    var d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));

    if(d === 0)
        return false;
    
    return [
        ((a[1] * a[1] + a[0] * a[0]) * (b[1] - c[1]) +
         (b[1] * b[1] + b[0] * b[0]) * (c[1] - a[1]) +
         (c[1] * c[1] + c[0] * c[0]) * (a[1] - b[1])) / d,
        ((a[1] * a[1] + a[0] * a[0]) * (c[0] - b[0]) +
         (b[1] * b[1] + b[0] * b[0]) * (a[0] - c[0]) +
         (c[1] * c[1] + c[0] * c[0]) * (b[0] - a[0])) / d
    ];
}

function segment_arc_to_point(st, segment, pt){
    var s = complete(st, segment);
    var arc = segment_arc(st, segment);
    var o = circumcenter(pt, arc.a, arc.b);
    var new_arc = { a: arc.a, b: arc.b };
    
    if(!o){
        new_arc.curve = 0;
        return new_arc;
    }

    var a = arc.a;
    var b = arc.b;
    var height = height_line_point(a, b, pt);

    new_arc.curve = curve_from_center(o, a, b, height);

    if(Math.abs(new_arc.curve) > maximum_curve){
        new_arc.curve = sign(new_arc.curve) * maximum_curve;
        $.extend(new_arc, calculate_arc(arc.a, arc.b, new_arc.curve));
        return new_arc;
    }

    
    new_arc.center = o;
    new_arc.radius = dist(o, pt);
    new_arc.from = angle_to(o, a);
    new_arc.to = angle_to(o, b);

    if(new_arc.curve < 0){
        var c = new_arc.from;
        new_arc.from = new_arc.to;
        new_arc.to = c;
    }

    return new_arc;
}

function curve_from_center(o, a, b, height){
    var angle = three_point_angle(a, o, b);

    var o_side = height_line_point(a, b, o) < 0;

    if(height < 0){
        if(o_side)
            angle = Math.PI*2 - angle;
        angle = -angle;
    }else if(!o_side){
        angle = Math.PI*2 - angle;
    }

    return angle / Math.PI * 180;
}

function curve_segment_to_point(st, segment, pt){
    var arc = segment_arc_to_point(st, segment, pt);

    segment.curve = arc.curve;

    if(mirror_mode){
        $.each(mirror_data(segment), function(dir, shape){
            if(dir == 'horizontal' || dir == 'vertical')
                shape.object.curve = -arc.curve;
            else
                shape.object.curve = arc.curve;
        });
    }
}

function plane_extremes(st, plane){
    var ext = data(plane, 'extremes');

    // TODO: complete the plane object

    if(ext && ext.normal[0] == plane.normal[0] && ext.normal[1] == plane.normal[1] && ext.dist == plane.dist &&
       list_equal(canvas_rect, ext.canvas_rect)){
        return ext;
    }
    ext = {normal: [plane.normal[0], plane.normal[1]], dist: plane.dist, canvas_rect: canvas_rect };

    var pts = plane_extremes_helper(st, ext.normal, ext.dist);

    ext.a = pts.a;
    ext.b = pts.b;

    data(plane, 'extremes', ext);
    return ext;
}

function plane_extremes_at_point(st, pt){
    return plane_extremes_helper(st, pt, norm(pt));
}

function plane_extremes_helper(st, normal, dist){
    var ext = {};
    
    dist = - dist;
    
    // ax + by = p

    if(normal[0] === 0 && normal[1] === 0){
        normal = [1, 0];
    }

    var n = normalise(normal);
    
    var r = canvas_rect;

    var p1 = [r[0], (-dist - n[0] * r[0]) / n[1]];
    var p2 = [r[2], (-dist - n[0] * r[2]) / n[1]];
    var p3 = [(-dist - n[1] * r[1]) / n[0], r[1]];
    var p4 = [(-dist - n[1] * r[3]) / n[0], r[3]];
    
    if(n[0] === 0){
        ext.a = p1;
        ext.b = p2;
    }else if(n[1] === 0){
        ext.a = p3;
        ext.b = p4;
    }else{
        var keep = [];
        if(between(r[1], r[3], p1[1])) keep.push(p1);
        if(between(r[1], r[3], p2[1])) keep.push(p2);
        if(between(r[0], r[2], p3[0])) keep.push(p3);
        if(between(r[0], r[2], p4[0])) keep.push(p4);
        if(keep.length != 2){
            ext.a = p1;
            ext.b = p3;
            if(p1 == p3)
                ext.b = p4;
        }else{
            ext.a = keep[0];
            ext.b = keep[1];
        }
    }

    return ext;
}

function segment_points(st, segment){
    var a = st.vertexes[segment.v0];
    var b = st.vertexes[segment.v1];
    return {
        a: [a.x, a.y],
        b: [b.x, b.y]
    };
}

function rectangle_contains(a, b, pt){
    return between(a[0], b[0], pt[0]) &&
        between(a[1], b[1], pt[1]);
}

function near(a, b, d){
    return Math.abs(a - b) <= d;
}

function point_add(a, b){
    return [a[0]+b[0], a[1]+b[1]];
}

function point_subtract(a, b){
    return [a[0]-b[0], a[1]-b[1]];
}

function dot_product(a, b){
    return a[0]*b[0] + a[1]*b[1];
}

function update_savepoint(){
    if(undo_savepoints.length)
        undo_savepoints[0] = pprint(stadium);
    queue_render();
}

function savepoint(){
    undo_savepoints.unshift(pprint(stadium));
    undo_savepoints.splice(undo_levels);
    redo_savepoints = [];
}

function undo(){
    if(undo_savepoints.length <= 1)
        return false;
    redo_savepoints.unshift(undo_savepoints.shift());
    redo_savepoints.splice(undo_levels);

    load(eval('['+undo_savepoints[0]+']')[0]);
    modified(true);
    return true;
}

function redo(){
    if(redo_savepoints.length <= 0)
        return false;
    var state = redo_savepoints.shift();
    undo_savepoints.unshift(state);
    undo_savepoints.splice(undo_levels);
    load(eval('['+state+']')[0]);
    modified(true);
    return true;
}

function delete_selected(st){
    var vertex_del_log = [];
    var count = 0;
    // delete segments BEFORE vertices
    $.each(['segments', 'vertexes', 'goals', 'discs', 'planes'], function(i, name){
        var group = st[name];
         if(group){
            st[name] = $.grep(group, function(obj, i){
                var del = selected(obj) === true; // possibly 'segment'
                if(name == 'segments'){
                    var a = st.vertexes[obj.v0];
                    var b = st.vertexes[obj.v1];
                    if(!del){
                        if(selected(a) === true || selected(b) === true){
                            del = true;
                        }
                    }
                    if(del){
                        if(selected(a) == 'segment'){
                            shape_set_selected(Shape('vertexes', a, obj.v0),false);
                        }
                        if(selected(b) == 'segment'){
                            shape_set_selected(Shape('vertexes', b, obj.v1),false);
                        }
                    }
                }
                if(del){
                    if(name == 'vertexes'){
                        vertex_del_log.push(i);
                    }
                    count ++;
                    obj._deleted = true;
                    return false;
                }
                return true;
            });
        }
    });
    fix_segments(st, vertex_del_log);
    resize_canvas();
    reset_selection();
    return count;
}

function fix_segments(st, vertex_del_log){
    if(vertex_del_log.length === 0){
        return;
    }
    var new_index = [];
    var diff = 0;
    var sz = st.vertexes.length + vertex_del_log.length;
    for(var i = 0; i <= sz; i++){
        if(i == vertex_del_log[0]){
            vertex_del_log.shift();
            diff ++;
            new_index.push(false);
        }else{
            new_index.push(i - diff);
        }
    }
    $.each(st.segments, function(i, segment){
        segment.v0 = new_index[segment.v0];
        segment.v1 = new_index[segment.v1];
    });
}

var tool_vertex = {
    name: 'vertex',
    cursor: 'default',
    init: function(){},
    click: function(pt){
        var shape = add_vertex(stadium, pt);
        select_shape(stadium, shape);
        modified();
    },
    end_drag: function(){},
    key: function(){},
    down: function(pt, ev){}
};

var tool_goal = {
    name: 'goal',
    cursor: 'default',
    init: function(){},
    click: function(){},
    end_drag: function(from, to, ev){
        var shape = add_goal(stadium, from, to);
        select_shape(stadium, shape);
        modified();
    },
    key: function(){},
    down: function(pt, ev){
        this.drag_from = pt;
    },
    dragging: function(from, to, ev){
        this.drag_to = to;
        $('#mousepos').text(Math.round(dist(from,to))+'; '+Math.round(angle_to(from, to)/Math.PI*180)+'°');
        queue_render();
        return false;
    },
    render: function(ctx){
        if(mouse_dragging){
            ctx.lineWidth = 1;
            if(this.drag_from[0] < 0 || get_prop_val('team', 'blue') == 'red'){
                ctx.strokeStyle = 'rgb(255,0,0)';
            }else{
                ctx.strokeStyle = 'rgb(0,0,255)';
            }
            ctx.beginPath();
            ctx.moveTo(this.drag_from[0], this.drag_from[1]);
            ctx.lineTo(this.drag_to[0], this.drag_to[1]);
            ctx.stroke();
        }
    }
};

var tool_plane = {
    name: 'plane',
    cursor: 'default',
    init: function(){},
    down: function(){},
    click: function(pt){
        // TODO: proper snapping
        snap_point_for_plane(pt);
        var shape = add_plane(stadium, pt);
        select_shape(stadium, shape);
        modified();
    },
    end_drag: function(){},
    key: function(){},
    dragging: function(from, to, ev){},
    render: function(ctx){
        var pt = this.mouse_pos;
        if(pt){
            // TODO: proper snapping
            snap_point_for_plane(pt);
            var ext = plane_extremes_at_point(stadium, pt);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgb(255,255,255)';
            ctx.beginPath();
            ctx.moveTo(ext.a[0], ext.a[1]);
            ctx.lineTo(ext.b[0], ext.b[1]);
            ctx.stroke();
        }
    },
    moving: function(pt, ev){
        this.mouse_pos = pt;
        $('#mousepos').text(pt[0] + ', ' + pt[1] + '; ' + Math.round(angle_to(pt, [0,0])/Math.PI*180)+'°');
        queue_render();
        return false;
    }
};

function snap_point_for_plane(pt){
    if(Math.abs(pt[0]) < 5){
        pt[0] = 0;
    }else if(Math.abs(pt[1]) < 5){
        pt[1] = 0;
    }
}

function add_goal(st, a, b, is_mirror){
    var obj = {
        p0: a,
        p1: b,
        team: a[0] > 0 ? 'blue' : 'red'
    };

    obj = $.extend({}, get_props_for_type('goals'), obj);

    st.goals.push(obj);
    var shape = Shape('goals', obj, st.goals.length - 1);

    if(mirror_mode && !is_mirror){
        $.each(mirror_directions, function(i, dir){
            if(!mirroring_disabled(dir) && can_mirror_segment(a, b, dir)){
                var goa = add_goal(st, mirror_point(a, dir), mirror_point(b, dir), true);
                link_shapes(shape, goa, dir);
            }
        });
    }

    return shape;
}

function add_plane(st, pt, is_mirror){
    var obj;
    if(pt[0] === 0 && pt[1] === 0){
        obj.dist = 0;
        obj.normal = [1, 0];
    }else{
        obj = {
            dist: -dist([0,0], pt),
            normal: normalise([-pt[0], -pt[1]])
        };
    }

    obj = $.extend({}, get_props_for_type('planes'), obj);

    st.planes.push(obj);
    var shape = Shape('planes', obj, st.planes.length - 1);

    if(mirror_mode && !is_mirror){
        $.each(mirror_directions, function(i, dir){
            if(!mirroring_disabled(dir) && can_mirror_vertex(pt, dir)){
                var pla = add_plane(st, mirror_point(pt, dir), true);
                link_shapes(shape, pla, dir);
            }
        });
    }

    return shape;
}

function toggle_properties(){
    var prop = $('#stadium_properties');
    if(!prop.is(':visible')){
        $(canvas).hide();
        prop.show();
        $('#button_properties').addClass('active');
        $('#bottomboxes').hide();
    }else{
        prop.hide();
        $(canvas).show();
        $('#button_properties').removeClass('active');
        $('#bottomboxes').show();
        queue_render();
    }
}

function connect_field(input, p, parse, unparse){
    input.change(function(){
        var val = input.val();
        if(parse){
            val = parse(val);
            input.val(val);
        }
        set_prop(stadium, p, val);
        resize_canvas();
        modified();
    });

    field_setters.push(function(){
        if(input.closest('body').length === 0)
            return false;
        var val = get_prop(stadium, p);
        if(unparse)
            val = unparse(val);
        input.val(val);

        return true;
    });
}

function set_prop(object, path, val){
    var list = path.split('.');
    while(list.length > 1){
        var step = list.shift();
        var next = object[step];
        if(next == undefined){
            next = {};
            object[step] = next;
        }
        object = next;
    }
    object[list.shift()] = val;
}

function get_prop(object, path){
    var list = path.split('.');
    while(list.length){
        if(object == undefined)
            return undefined;
        object = object[list.shift()];
    }
    return object;
}

function define_tab(name){
    var button = $('#button_tab_'+name);
    var tab = $('#tab_'+name);
    button.click(function(){
        button.siblings('button').removeClass('active');
        button.addClass('active');
        tab.siblings().hide();
        tab.show();
    });
}

function point_rotate(pt, center, cos, sin){
    var v = point_subtract(pt, center);
    return point_add(center, [
        v[0] * cos - v[1] * sin,
        v[0] * sin + v[1] * cos
    ]);
}

function rotate_obj(st, shape, center, cos, sin){
    var type = shape.type;
    var obj = shape.object;

    var o = complete(st, obj);
    
    if(type == 'vertexes'){
        var n = point_rotate([o.x, o.y], center, cos, sin);
        obj.x = n[0];
        obj.y = n[1];
    }
    
    if(type == 'discs'){
        obj.pos = point_rotate(o.pos, center, cos, sin);
    }
    
    if(type == 'goals'){
        obj.p0 = point_rotate(o.p0, center, cos, sin);
        obj.p1 = point_rotate(o.p1, center, cos, sin);
    }

    if(type == 'planes'){
        var no = normalise(o.normal);
        var nn = point_rotate(no, [0,0], cos, sin); 
        var pt = point_rotate([no[0]*o.dist, no[1]*o.dist], center, cos, sin);
        var d = projected_dist(nn, pt);
        // var d = dist([0,0], pt) * Math.sin(Math.PI/2 - three_point_angle([-nn[0], -nn[1]], [0,0], pt));
        obj.normal = nn;
        obj.dist = d;
    }
}

function update_mirrored_geometry_selected(st){
    var dm = {};
    if(mirror_mode){
        for_all_shapes(st, function(shape){
            if(!selected(shape.object)){
                return;
            }
            var obj = complete(st, shape.object);
            var dat = mirror_data(shape.object);
            $.each(dat, function(dir, sh2){
                if(!mirroring_disabled(dir)){
                    switch(sh2.type){
                    case 'vertexes':
                        var pt = mirror_point([obj.x, obj.y], dir);
                        sh2.object.x = pt[0];
                        sh2.object.y = pt[1];
                        break;
                    case 'discs':
                        sh2.object.pos = mirror_point(obj.pos, dir);
                        sh2.object.radius = obj.radius;
                        break;
                    case 'goals':
                        sh2.object.p0 = mirror_point(obj.p0, dir);
                        sh2.object.p1 = mirror_point(obj.p1, dir);
                        break;
                    case 'planes':
                        sh2.object.normal = mirror_point(obj.normal, dir);
                        sh2.object.dist = obj.dist;
                        break;
                    }
                }else{
                    if(selected(dat[dir].object)){
                        dm[dir] = (dm[dir] || 0) + 1;
                    }
                    $.each(dat, function(d1, sh1){
                        var dat1 = mirror_data(sh1.object);
                        if(dat1[dir]){
                            if(selected(sh1.object) && selected(dat1[dir].object)){
                                dm[dir] = (dm[dir] || 0) + 1;
                            }
                            delete dat1[dir];
                        }
                    });
                    delete dat[dir]; 
                }
            });
        });
    }
    $.each(dm, function(dir, count){
        disabled_mirroring[dir] -= count / 2;
    });
}

function projected_dist(normal, pt){
    var n = normalise(normal);
    return norm(pt) * Math.sin(Math.PI/2 - three_point_angle(n, [0,0], pt));
}

function height_plane_point(st, plane, pt){
    // TODO: there must a more efficient way to do this
    var ext = plane_extremes(st, plane);
    return height_line_point(ext.a, ext.b, pt);
}

function add_tool(tool){
    $('#button_tool_'+tool.name).click(function(){
        set_tool(tool);
    });
}

function select_all(test){
    if(!test)
        test = function(){ return true; };
    for_all_shapes(stadium, function(shape){
        shape_set_selected(shape, test(shape));
    });
    queue_render();
}

function sign(n){
    return n < 0 ? -1 : 1;
}

function resize_canvas(){
    // TODO: use scrollLeft and scrollTop to recenter the view
    var st = stadium;

    var rect;

    rect = [-st.width, -st.height, st.width, st.height];

    var consider = function(pt, r){
        var x = pt[0];
        var y = pt[1];
        if (x - r < rect[0]) rect[0] = x - r;
        if (y - r < rect[1]) rect[1] = y - r;
        if (x + r > rect[2]) rect[2] = x + r;
        if (y + r > rect[3]) rect[3] = y + r;
    };

    for_all_shapes(stadium, function(shape){
        var obj = shape.object;
        var o = complete(st, obj);
        switch(shape.type){
        case 'vertexes':
            consider([o.x, o.y], 0);
            break;
        case 'goals':
            consider(o.p0, 0);
            consider(o.p1, 0);
            break;
        case 'discs':
            consider(o.pos, o.radius);
            break;
        case 'planes':
            // TODO: find a better way to ensure that a plane is reachable
            var ext = plane_extremes(st, obj);
            consider(midpoint(ext.a, ext.b), 0);
            break;
        }
    });

    var cd = $('#canvas_div');
    var canvas_div_size = [cd.innerWidth() - 20, cd.innerHeight() - 20];
    
    rect = [
        round(min(rect[0] - margin, -canvas_div_size[0]/2)),
        round(min(rect[1] - margin, -canvas_div_size[1]/2)),
        round(max(rect[2] + margin, canvas_div_size[0]/2)),
        round(max(rect[3] + margin, canvas_div_size[1]/2))
    ];

    canvas_rect = rect;
    var wh = { width: rect[2] - rect[0], height: rect[3] - rect[1]};
    $(canvas).attr(wh);
    $(canvas).css(wh);

    queue_render();
}

function midpoint(a, b){
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

var tool_scale = {
    name: 'scale',
    cursor: 'default',
    init: function(){
        queue_render();
    },
    down: function(pt, ev){
        this.drag_from = pt;
    },
    click: function(pt, ev){
        transformation_center = pt;
        queue_render();
    },
    end_drag: function(from, to, ev){
        var v = snap_for_scale(transformation_center, from, to);
        if(scale_selected(stadium, transformation_center, v)){
            resize_canvas();
            modified();
        }
    },
    key: function(){},
    render: render_transformation_center,
    dragging: function(from, to, ev){
        this.drag_to = to;
        queue_render();
        return false;
    },
    transform: function(st, ctx, shape, draw){
        if(mouse_dragging && shape_fully_selected(st, shape)){
            var o = transformation_center;
            ctx.translate(o[0], o[1]);
            var v = snap_for_scale(o, this.drag_from, this.drag_to);
            ctx.scale(v[0], v[1]);
            ctx.translate(-o[0], -o[1]);

            $('#mousepos').text(Math.round(v[0]*100) + '% x ' +
                                Math.round(v[1]*100) + '%');
        }
        draw();
    }
};

function render_transformation_center(ctx){
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgb(0,0,0)';
    ctx.beginPath();
    ctx.arc(transformation_center[0], transformation_center[1], 2, 0, Math.PI*2, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(transformation_center[0], transformation_center[1], 6, 0, Math.PI*2, true);
    ctx.stroke();
    ctx.strokeStyle = 'rgb(255,255,255)';
    ctx.beginPath();
    ctx.arc(transformation_center[0], transformation_center[1], 4, 0, Math.PI*2, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(transformation_center[0], transformation_center[1], 8, 0, Math.PI*2, true);
    ctx.stroke();
}

function snap_for_scale(o, from, to){
    var a = point_subtract(from, o);
    a = [a[0]||1, a[1]||1];
    var b = point_subtract(to, o);
    
    var v = [
        min(b[0]/a[0], 3),
        min(b[1]/a[1], 3)
    ];

    var k = (abs(v[0]) + abs(v[1])) / 2;

    /*
      if(abs(abs(b[0])-abs(a[0])) <= 5) v[0] = sign(b[0]) * sign(a[0]) * 1;
      if(abs(abs(b[1])-abs(a[1])) <= 5) v[1] = sign(b[1]) * sign(a[1]) * 1;

      if(abs(sin(three_point_angle(first_quadrant(from), first_quadrant(o), first_quadrant(to))))
      <= 10 / dist(o, to)){
      v[0] = sign(v[0]) * k;
      v[1] = sign(v[1]) * k;
      } */
    
    var angle = abs(abs(angle_to([0,0], b)) - pi/2);

    if(angle < pi/8){
        v[0] = sign(v[0]);
    }else if(angle > pi*3/8){
        v[1] = sign(v[1]);
    }else{
        v[0] = sign(v[0]) * k;
        v[1] = sign(v[1]) * k;        
    }

    return v;
}

function first_quadrant(pt){
    return [abs(pt[0]), abs(pt[1])];
}

function scale_selected(st, c, v){

    var count = 0;

    // scaling segemnts requires the original vertex value, so scale them first

    for_all_shapes(st, ['segments', 'vertexes', 'discs', 'goals', 'planes'], function(shape){
        if(!selected(shape.object))
            return;

        count ++;

        var type = shape.type;
        var obj = shape.object;

        var o = complete(st, obj);

        var m = Math.sqrt(abs(v[0] * v[1]));

        if(type == 'vertexes'){
            var pt = point_scale([o.x, o.y], c, v);
            obj.x = pt[0];
            obj.y = pt[1];
        }

        else if(type == 'discs'){
            obj.pos = point_scale(o.pos, c, v);
            obj.radius = abs(m) * o.radius;
        }

        else if(type == 'goals'){
            obj.p0 = point_scale(o.p0, c, v);
            obj.p1 = point_scale(o.p1, c, v);
        }

        else if(type == 'planes'){
            var n = normalise(o.normal);
            var vi = [v[1], v[0]];
            obj.normal = normalise(point_scale(n, [0,0], vi));
            var pt = point_scale([n[0]*o.dist, n[1]*o.dist], c, v);
            obj.dist = projected_dist(obj.normal, pt);
        }

        else if(type == 'segments'){
            if(o.curve && v[0] != v[1]){
                var av = [abs(v[0]), abs(v[1])];
                var arc = segment_arc(st, o);
                var vi = [av[1], av[0]];
                var oac = point_subtract(arc.a, arc.center);
                //var obc = point_subtract(arc.b, arc.center);
                var ap = point_scale([-oac[1], oac[0]], [0,0], av);
                //var bp = point_scale([-obc[1], obc[0]], [0,0], av);
                var ac = [-ap[1], ap[0]];
                //var bc = [-bp[1], bp[0]];
                var a = point_scale(arc.a, c, av);
                var b = point_scale(arc.b, c, av);
                var m = midpoint(a, b);
                var ma = point_subtract(a, m);
                var u = [-ma[1], ma[0]];
                var centera = intersect_lines(m, point_add(m, u), a, point_add(a, ac));
                //var centerb = intersect_lines(m, point_add(m, u), b, point_add(b, bc));
                if(centera /* && centerb */){
                    var cua = curve_from_center(centera, a, b, o.curve);
                    //var cub = curve_from_center(centerb, a, b, o.curve)
                    //obj.curve = (cua + cub) / 2 * sign(v[0]*v[1]);
                    obj.curve = cua * sign(v[0]*v[1]);
                }
            }
        }
    });

    update_mirrored_geometry_selected(st);

    return count;
}

function intersect_lines(p1, p2, p3, p4){
    // http://en.wikipedia.org/wiki/Line-line_intersection
    var d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    var k = p1[0]*p2[1] - p1[1]*p2[0];
    var l = p3[0]*p4[1] - p3[1]*p4[0];
    return [
        (k * (p3[0] - p4[0]) - (p1[0] - p2[0]) * l) / d,
        (k * (p3[1] - p4[1]) - (p1[1] - p2[1]) * l) / d
    ];
}

function debug_show_point(pt, style){
    if(!style) style = 'rgb(255,0,0)';
    debug_render.push(function(ctx){
        ctx.fillStyle = style;
        ctx.fillRect(pt[0]-2, pt[1]-2, 4, 4);
    });
}

function midpoint(a, b){
    return [(a[0]+b[0])/2, (a[1]+b[1])/2];
}

function shape_fully_selected(st, shape){
    if(shape.type != 'segments')
        return selected(shape.object);
    else
        return (selected(st.vertexes[shape.object.v0]) &&
                selected(st.vertexes[shape.object.v1]));
}

function point_scale(pt, o, v){
    return [
        (pt[0] - o[0]) * v[0] + o[0],
        (pt[1] - o[1]) * v[1] + o[1]
    ];
}

function initialise_properties_css(){
    var rules = [];

    $.each(type_properties, function(type, props){
        $.each(props, function(i, prop){
            var opts = properties[prop];
            rules.push('.selected_'+type+'.selected_tool_other .prop_'+prop+' { display: block }');
            if(opts.def)
                rules.push('.selected_tool_'+type+' .prop_'+prop+'{ display: block }');
        });
    });

    $('<style type="text/css">' + rules.join('\n') + '</style>').appendTo($('head'));
}

function populate_tab_properties(){
    var tp = $('#tab_properties');
    $.each(properties, function(prop, opts){
        var type = opts.type;
        if(type != 'ref'){
            var div = $('<div class="property prop_'+prop+'"></div>').appendTo(tp);
            var label = $('<label class="prop">'+prop+'</label>').appendTo(div);
            var apply = function(){
                property_apply(prop, property_data[prop]);
            };
            switch(type){
                
                // TODO: number point color team trait bool

            case 'point':
            case 'number':
            case 'color':
            case 'team':
            case 'layers':
            case 'trait':
            case 'bool':
                var inp = $('<input type="text" class="prop">').appendTo(div);
                property_data[prop] = inp;
                inp.change(apply);
            }
        }
    });    
}

function property_apply(prop, inp){
    val = get_prop_val(prop);
    if(val !== undefined){
        for_selected(stadium, function(st, shape){
            shape.object[prop] = val;
            // TODO: mirror the property update
        });
        modified();
    }
}

function get_prop_val(prop, def){
    var inp = property_data[prop];
    if(!inp)
        return def;
    var type = properties[prop].type;
    var val = inp.val();
    switch(type){
    case 'point':
        var m = val.match(/^(-?[0-9]+(\.[0-9]+)?)[,;] ?(-?[0-9]+(\.[0-9]+)?)$/);
        if(m) return [parseFloat(m[1]), parseFloat(m[3])];
        break;
    case 'number':
        var m = val.match(/^(-?[0-9]+(\.[0-9]+)?)$/);
        if(m) return parseFloat(m[1]);
        break;
    case 'color':
        var m = val.match(/^[A-Z0-9]{6}$/i);
        if(m) return m[0];
        break;
    case 'team':
        var m = val.match(/^red|blue$/i);
        if(m) return m[0];
        break;
    case 'layers':
        var layers = val.split(/[,; ]+/);
        var good = true;
        $.each(layers, function(i, layer){
            if($.inArray(layer, ['ball', 'red', 'blue', 'wall', 'redKO', 'blueKO', 'all']) == -1)
                good = false;
        });
        if(good) return layers;
        break;
    case 'trait':
        if(stadium.traits[val])
            return val;
        break;
    case 'bool':
        var m = val.match(/^true|false$/i);
        if(m=='true') return true;
        if(m=='false') return false;
        break;
    }
    if(val !== ''){
        inp.addClass('error');
    }
    return def;
}

function set_prop_val(prop, val){
    var inp = property_data[prop];
    if(!inp)
        return;

    inp.removeClass('error');

    if(val === undefined){
        inp.val('');
        return;
    }

    var type = properties[prop].type;
    switch(type){
    case 'point':
        inp.val(val[0]+','+val[1]);
        break;
    case 'number':
    case 'team':
    case 'trait':
    case 'bool':
        inp.val(''+val);
        break;
    case 'color':
        if(val instanceof Array){
            inp.val(rgb_to_hex(val));
        }else{
            inp.val(val);
        }
        break;
    case 'layers':
        inp.val(val.join(','));
        break;
    }
}

triggers.set_tool.push(function(tool, old_tool){
    var tp = $('#tab_properties');
    tp.removeClass(tool_class_name(old_tool));
    tp.addClass(tool_class_name(tool));
});

function tool_class_name(tool){
    if(!tool)
        return 'selected_tool_none';
    switch(tool.name){
    case 'segment': return 'selected_tool_segments';
    case 'vertex': return 'selected_tool_vertexes';
    case 'plane': return 'selected_tool_planes';
    case 'disc': return 'selected_tool_discs';
    case 'goal': return 'selected_tool_goals';
    default: return 'selected_tool_other';
    }
}

function get_props_for_type(type){
    // TODO: if the prop is the same as from the trait, don't return it
    var props = {};
    $.each(type_properties[type], function(i, prop){
        var opts = properties[prop];
        if(opts.def){
            var val = get_prop_val(prop);
            if(val !== undefined)
                props[prop] = val;
        }
    });
    return props;
}

function reset_selection(){
    trigger('reset_selection');
}

function add_props_from_shape(shape){
    var obj = complete(stadium, shape.object);

    total_selected_by_type[shape.type] = (total_selected_by_type[shape.type] || 0) + 1;

    $('#tab_properties').addClass('selected_' + shape.type);

    $.each(type_properties[shape.type], function(i, prop){
        var n = total_selected_by_prop[prop] || 0;
        total_selected_by_prop[prop] = n + 1;

        var val = obj[prop];
        if(n === 0){
            set_prop_val(prop, val);
        }else if(!equal(val, get_prop_val(prop))){
            set_prop_val(prop, undefined);
        }
    });
}

triggers.select.push(add_props_from_shape);


triggers.unselect.push(function(shape){
    var count = total_selected_by_type[shape.type] - 1;
    total_selected_by_type[shape.type] = count;
    if(count === 0){
        $('#tab_properties').removeClass('selected_' + shape.type);
    }
    $.each(type_properties[shape.type], function(i, prop){
        total_selected_by_prop[prop] -= 1;
    });
});

triggers.reset_selection.push(function(){
    total_selected_by_type = {};
    total_selected_by_prop = {};
});

function list_equal(a, b){
    if(a.length != b.length)
        return false;
    for(var i = 0; i < a.length; i++){
        if(!equal(a[i], b[i]))
            return false;
    }
    return true;
}

function equal(a, b){
    // TODO: other types. atm this is just used to compare numbers, strings and arrays
    if(a instanceof Array){
        return (b instanceof Array) && list_equal(a,b);
    }else{
        return a == b;
    }
}

function modified(do_not_save){
    if(!do_not_save)
        savepoint(stadium);
    update_props(stadium);
    $('#button_save').addClass('modified');
    queue_render();
}

function update_props(st){
    $('#tab_properties').attr('class', tool_class_name(current_tool));

    total_selected_by_type = {};
    total_selected_by_prop = {};   

    for_all_shapes(st, function(shape){
        if(selected(shape.object)){
            add_props_from_shape(shape);
        }
    });
}

function rgb_to_hex(rgb){
    return rgb[0].toString(16) +
        rgb[1].toString(16) +
        rgb[2].toString(16);
}

function copy(){
    clipboard = clone_selected(stadium);
}

function paste(){
    import_snippet(stadium, clipboard);
}

function cut(){
    copy();
    delete_selected(stadium);
}

function duplicate(){
    import_snippet(stadium, clone_selected(stadium));
}

function clone_selected(st){
    // TODO: also clone traits, and on pasting iif traits don't exist, create them with cloned properties
    var snip = {
        shapes: []
    };
    for_all_shapes(st, function(shape){
        if(selected(shape.object)){
            snip.shapes.push(shape_clone(shape));
            if(shape.type == 'segments'){
                var a = st.vertexes[shape.object.v0];
                if(!selected(a)){
                    snip.shapes.push(shape_clone(Shape('vertexes', a, shape.object.v0)));
                }
                var b = st.vertexes[shape.object.v1];
                if(!selected(b)){
                    snip.shapes.push(shape_clone(Shape('vertexes', b, shape.object.v1)));
                }
            }
        }
    });
    return snip;
}

function import_snippet(st, snip){
    if(!snip)
        return;
    clear_selection(st);
    var svl = st.vertexes.length;
    var newi = {};
    $.each(snip.shapes, function(i, shape){
        var index = st[shape.type].length;
        var copy = $.extend(true, {}, shape.object);
        if(shape.type == 'vertexes'){
            if(!(shape.index in newi)){
                newi[shape.index] = svl ++;
            }
            index = newi[shape.index];
        }else if (shape.type == 'segments'){
            var v0 = copy.v0;
            var v1 = copy.v1;

            if(!(v0 in newi))
                newi[v0] = svl ++;
            copy.v0 = newi[v0];
            
            if(!(v1 in newi))
                newi[v1] = svl ++;
            copy.v1 = newi[v1];
        }
        st[shape.type][index] = copy;
        shape_set_selected(Shape(shape.type, st[shape.type][index], index), true);
    });
}

function eachRev(l, f){
    var n = l.length;
    $.each(l.slice().reverse(), function(i, v){
        return f(n-i-1, v);
    });
}

function set_selection_range(el, start, end){

    /* https://github.com/furf/jquery-textselection/blob/master/Selection-1.0.js */
    
    var value, range;

    el.focus();

    if(end === undefined)
        end = start;

    if (typeof end === 'undefined') {
        end = start;
    }

    // Mozilla / Safari
    if (typeof el.selectionStart !== 'undefined') {

        el.setSelectionRange(start, end);

        // IE
    } else {

        value = el.value;
        range = el.createTextRange();
        end   -= start + value.slice(start + 1, end).split("\n").length - 1;
        start -= value.slice(0, start).split("\n").length - 1;
        range.move('character', start);
        range.moveEnd('character', end);
        range.select();

    }
}

function mirror_data(object){
    var dat = data(object, 'mirror');
    if(dat === undefined){
        dat = {};
        data(object, 'mirror', dat);
    }
    return dat;
}

function reset_mirror_data(st){
    // TODO: how to handle shapes at exactly the same position?

    clear_selection(st);

    var link_types = ['horizontal', 'vertical', 'across'];

    for_all_shapes(st, ['vertexes', 'segments', 'goals', 'discs', 'planes'], function(sh1){
        if(!emptyp(mirror_data(sh1.object)))
            return;
        for_all_shapes(st, [sh1.type], function(sh2){
            if(!emptyp(mirror_data(sh2.object)))
                return;
            switch(sh1.type){
            case 'vertexes':
                var pt1 = [sh1.object.x, sh1.object.y];
                var pt2 = [sh2.object.x, sh2.object.y];
                $.each(link_types, function(i, type){
                    if(mirror_of(pt1, pt2, type)){
                        link_shapes(sh1, sh2, type);
                    }
                });
                break;

            case 'segments':
                var v0 = st.vertexes[sh1.object.v0];
                var v1 = st.vertexes[sh1.object.v1];
                var ma = mirror_data(st.vertexes[sh2.object.v0]);
                var mb = mirror_data(st.vertexes[sh2.object.v1]);
                $.each(link_types, function(i, type){
                    if(ma[type] == v0 && mb[type] == v1 &&
                       complete(st, sh1.object).curve == complete(st, sh2.object).curve){
                        link_shapes(sh1, sh2, type);
                    }else if(ma[type] == v1 && mb[type] == v0 &&
                             complete(st, sh1.object).curve == -complete(st, sh2.object).curve){
                        shape_switch_ends(sh1);
                        link_shapes(sh1, sh2, type);
                    }
                });
                break;

            case 'discs':
                if(sh1.object.radius == sh2.object.radius){
                    $.each(link_types, function(i, type){
                        if(mirror_of(sh1.object.pos, sh2.object.pos, type)){
                            link_shapes(sh1, sh2, type);
                        }
                    });
                }
                break;

            case 'goals':
                $.each(link_types, function(i, type){
                    if(mirror_of(sh1.object.p0, sh2.object.p0, type) &&
                       mirror_of(sh1.object.p1, sh2.object.p1, type)){ 
                        link_shapes(sh1, sh2, type);
                    }else if(mirror_of(sh1.object.p0, sh2.object.p1, type) &&
                             mirror_of(sh1.object.p1, sh2.object.p0, type)){ 
                        shape_switch_ends(sh1);
                        link_shapes(sh1, sh2, type);
                    }
                });
                break;

            case 'planes':
                $.each(link_types, function(i, type){
                    if(sh1.object.dist == sh2.object.dist &&
                       mirror_of(sh1.object.normal, sh2.object.normal, type)){
                        link_shapes(sh1, sh2, type);
                    }
                });
                break;
            }
        });
    });

    queue_render();
}

function mirror_of(pt1, pt2, type){
    return !equal(pt1, pt2) && equal(pt1, mirror_point(pt2, type));
}

function mirror_point(pt, type){
    switch(type){
    case 'horizontal':
        return [-pt[0], pt[1]];
    case 'vertical':
        return [pt[0], -pt[1]];
    case 'across':
        return [-pt[0], -pt[1]];
    }
}

function link_shapes(sh1, sh2, dir){
    if(sh1.object == sh2.object)
        return;
    var dat1 = mirror_data(sh1.object)
    var dat2 = {};
    var cancel = false;
    $.each(dat1, function(k, sh3){
        if(sh3.object == sh1.object || sh3.object == sh2.object)
            cancel = true;
    });
    if(cancel)
        return;
    $.each(dat1, function(k, sh3){
        dat2[compose_mirror_directions(dir, k)] = sh3;
        mirror_data(sh3.object)[compose_mirror_directions(dir, k)] = sh2;
    });
    dat1[dir] = sh2;
    dat2[dir] = sh1;
    data(sh2.object, 'mirror', dat2)
}

function emptyp(o){
    for(i in o){
        return false;
    }
    return true;
}

function shape_switch_ends(sh){
    switch(sh.type){
    case 'segments':
        var seg = sh.object;
        seg.curve = -seg.curve;
        var tmp = seg.v0;
        seg.v0 = seg.v1;
        seg.v1 = tmp;
        break;
        
    case 'goals':
        var tmp = sh.object.p0;
        sh.object.p0 = sh.object.p1;
        sh.object.p1 = tmp;
        break;
    }
}

function clear_mirror_data(st){
    for_all_shapes(st, function(shape){
        data(shape.object, 'mirror', {});
    });
    disabled_mirroring = {};
}

triggers.select.push(function(sh1){
    //if mirror of shape is selected too, disable mirroring in that direction
    $.each(mirror_data(sh1.object), function(dir, sh2){
        if(selected(sh2.object)){
            disabled_mirroring[dir] = (disabled_mirroring[dir] || 0) + 1;
        }
    });
});

triggers.unselect.push(function(sh1){
    $.each(mirror_data(sh1.object), function(dir, sh2){
        if(selected(sh2.object)){
            disabled_mirroring[dir] -- ;
        }
    });
});

triggers.reset_selection.push(function(){
    disabled_mirroring = {};
});

function compose_mirror_directions(d1, d2){
    return {
        'horizontal vertical': 'across',
        'vertical horizontal': 'across',
        'across vertical': 'horizontal',
        'vertical across': 'horizontal',
        'across horizontal': 'vertical',
        'horizontal across': 'vertical'
    }[d1 + ' ' + d2];
}

function segment_vertices(st, seg){
    var v0 = seg.object.v0;
    var v1 = seg.object.v1;
    return [
        Shape('vertexes', st.vertexes[v0], v0),
        Shape('vertexes', st.vertexes[v1], v1)
    ];
}

function mirroring_disabled(dir){
    if(!mirror_mode)
        return true;
    if(disabled_mirroring['across'])
        return true;
    if(dir == 'across')
        return disabled_mirroring['across'] || disabled_mirroring['horizontal'] || disabled_mirroring['vertical'];
    if(disabled_mirroring[dir])
        return true;
    return false;
}

function shape_clone(shape){
    return Shape(shape.type, object_clone(shape.object), shape.index);
}

function object_clone(obj){
    var clone = {};
    $.each(obj, function(k, v){
        if(k != '_data'){
            if(v instanceof Array){
                clone[k] = $.extend([], v);
            }else if(typeof v == 'object'){
                clone[k] = $.extend({}, v);
            }else{
                clone[k] = v;
            }
        }
    });
    return clone;
}

function login(){
    var error = function(e){
        // TODO: log to server
        alert('Error during login. Please try again later. (' + e + ')');
    }
    var username = $('#login_name').val();
    $.ajax({
        type: 'POST',
        url: 'http://haxpuck.com/action/login', 
        dataType: 'json',
        data: {
            name: username,
            password: $('#login_password').val(),
            sessionid: session_id
        },
        success: function(login){
            if(!login){
                error('empty response from server');
            }else if(login.success){
                set_logged_in(login.id, username);
                hide_box();
            }else{
                alert('unable to login: ' + login.reason);
            }
        },
        error: function(x, e){
            error(e);
        }
    });
}

function register(){
    var error = function(e){
        // TODO: log to server
        alert('Error during registration. Please try again later. (' + e + ')');
    }
    $.ajax({
        type: 'POST',
        url: 'http://haxpuck.com/action/register', 
        dataType: 'json',
        data: {
            name: $('#register_name').val(),
            password: $('#register_password').val(),
            email: $('#register_email').val(),
            sessionid: session_id
        },
        success: function(registration){
            if(!registration){
                error('empty response from server');
            }else if(registration.success){
                alert('Registration successful. Please open the link sent to your email to confirm your registration.');
                hide_box();
            }else{
                alert('unable to register: ' + registration.reason);
            }
        },
        error: function(x, e){
            error(e);
        }
    });
}

function set_logged_in(id, name){
    user_info = {};
    user_info.id = id;
    user_info.name = name;
    $('body').addClass('logged-in').removeClass('logged-out');
}

function set_logged_out(){
    user_info = {};
    $('body').addClass('logged-out').removeClass('logged-in');
}

function logout(){
    $.ajax({type: 'POST', url: 'http://haxpuck.com/action/logout', data: {sessionid: session_id}});
    set_logged_out();
}

function check_logged_in(){
    $.ajax({
        type: 'GET',
        url: 'http://haxpuck.com/action/session', 
        dataType: 'jsonp',
        success: function(session){
            session_id = session.sessionid;
            if(session && session.username !== null && session.userid !== null){
                set_logged_in(session.userid, session.username);
            }
        },
    });
}

function save(success_continuation){
    var id = user_info.id;
    if(!id) return;

    if(!$('#button_save').hasClass('modified')){
        if(success_continuation)
            success_continuation(last_save_id);
        return;
    }

    var error = function(e){
        // TODO: log to server
        alert('Error during save. Please try again later. (' + e + ')');
    }
    $.ajax({
        type: 'POST',
        url: 'http://haxpuck.com/action/save',
        dataType: 'json',
        data: {
            userid: id,
            sessionid: session_id,
            name: stadium.name,
            stadium: pprint(stadium, 10),
            overwrite: last_save_name == stadium.name ? last_save_id : 0
        },
        success: function(result){
            if(!result){
                error('empty response from server');
            }else if(result.success){
                last_save_id = result.id;
                console.log('last_save_id', last_save_id);
                last_save_name = stadium.name;
                $('#button_save').removeClass('modified');
                if(success_continuation)
                    success_continuation(result.id);
            }else{
                alert('unable to save: ' + result.reason);
            }
        },
        error: function(x, e){
            error(e);
        }
    });
}

function library_query(){
    $('#library_list').empty();
    var error = function(e){
        $('<tr></tr>').html(
            $('<td colspan="3"></td>').
                text('Error Loading Data: '+e)).
            appendTo($('#library_list'));
    }
    $.ajax({
        type: 'POST',
        url: 'http://haxpuck.com/action/list_hbs',
        dataType: 'json',
        data: {
            sessionid: session_id,
            query: library.query
        },
        success: function(result){
            if(!result){
                error('empty response from server');
            }else if(result.success){
                library.list = result.list;
                library_update();
            }else{
                error('List Unavailable: ' + result.reason);
            }
        },
        error: function(x, e){
            error(e);
        }
    });    
}

function library_update(){
    var tb = $('#library_list');
    $.each(library.list, function(i, info){
        $('<tr></tr>').
            append(
                $('<td></td>').html(info.time),
                $('<td></td>').text(info.username),
                $('<td></td>').text(info.name)
            ).appendTo(tb).data({id: info.id, userid: info.userid}).click(function(){
                $(this).addClass('active').siblings().removeClass('active');
                if(user_info && $(this).data('userid') == user_info.id){
                    $('#boxlibrary').addClass('owner');
                }else{
                    $('#boxlibrary').removeClass('owner');
                }
                return false;
            });
    });
}

function library_edit(){
    var sid = $('#library_list tr.active').data('id');
    if(!sid)
        return;
    
    var error = function(e){
        alert('Error while opening stadium: ' + e);
    }
    $.ajax({
        type: 'POST',
        url: 'http://haxpuck.com/action/stadium',
        dataType: 'json',
        data: {
            sessionid: session_id,
            id: sid
        },
        success: function(result){
            if(!result){
                error('empty response from server');
            }else if(result.success){
                load(result.stadium);
                hide_box();
                modified();
            }else{
                error(result.reason);
            }
        },
        error: function(x, e){
            error(e);
        }
    });    
}

function library_delete(){
    var sid = $('#library_list tr.active').data('id');
    if(!sid)
        return;
    
    if(!confirm('Are you sure you want to delete this stadium?'))
        return;

    var error = function(e){
        alert('Error while deleting stadium: ' + e);
    }
    $.ajax({
        type: 'POST',
        url: 'http://haxpuck.com/action/delete_hbs',
        dataType: 'json',
        data: {
            sessionid: session_id,
            id: sid
        },
        success: function(result){
            if(!result){
                error('empty response from server');
            }else if(result.success){
                $('#library_list tr.active').next().addClass('active');
                $('#library_list tr.active').eq(0).remove();
            }else{
                error(result.reason);
            }
        },
        error: function(x, e){
            error(e);
        }
    });    
}

function download(){
    save(function(id){
        can_leave = true;
        $('<form method="POST">'+
          '<input type="hidden" name="sessionid" value="'+session_id+'">'+
          '<input type="hidden" name="id" value="'+id+'">'+
          '</form>'
         ).attr(
             'action', 'http://haxpuck.com/action/hbs/' + encodeURIComponent(stadium.name) + '.hbs'
         ).appendTo('html').submit();
        setTimeout(function(){
            can_leave = false;
        }, 1000);
    });
}

function parseColor(str){
    if(!str.match('^[A-Fa-f0-9]{6}$'))
        return '';
    return str;
}

function parseMaskList(str){
    var list = str.split(',');
    var out = [];
    $.each(list, function(i, w){
        if($.inArray(w, ['ball', 'red', 'blue', 'wall', 'redKO', 'blueKO', 'all']) != -1){
            out.push(w);
        }
    });
    return out;
}
