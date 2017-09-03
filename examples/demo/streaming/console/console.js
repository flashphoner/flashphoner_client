
var REFRESH_NODE_STATE_INTERVAL = 5000;
var REFRESH_NODE_STATE_FAILED_INTERVAL = 10000;
var REFRESH_NODE_DETAILS = 2000;
var NODE_STATE = {
    NEW: "new",
    ALIVE: "alive",
    ACTIVE: "active",
    DEACTIVATE: "deactivate",
    FAILED: "failed"
};
var NODE_DETAILS_TYPE = {
    ALL: "all",
    PULLED: "pulled",
    RTSP: "rtsp"
};

var nodes = {};

$(function() {
    $("#addNodeFormSubmit").on("click", function(e){
        var ip = $("#nodeIp").val();
        if (ip && ip.length > 0) {
            addNode(ip);
        }
    });
    $('#pushModal').on('show.bs.modal', function(e) {
        var streamName = e.relatedTarget.dataset.streamname;
        $('#pushForm a').text(streamName);
    });
    $("#pushStream").on("click", function(e){
        pushStream();
    });
    $("#pullStream").on("click", function(e){
        pullStream();
    });
    $("#pullRtspStream").on("click", function(e){
        pullRTSPStream();
    });
    $("#streamsTableInfoTypeBtn").on("click", function(e){
        var node = getActiveNode();
        var type = $("#streamsTableInfoType").val();
        node.setDetailsType(type);
    });
    $('#pullStreamBatchModal').on('show.bs.modal', function(e) {
        $("#pullStreamBatchNodes").empty();
        var html = "";
        for (var id in nodes) {
            html += "<option value='" + nodes[id].ip + "'>" + nodes[id].ip + "</option>";
        }
        $("#pullStreamBatchNodes").append(html);
    });
    $("#pullBatchStream").on("click", function(e){
        pullStreamBatch();
    });

});

function createNode(id, ip) {
    var api = FlashphonerRestApi.instance("http://"+ip+":9091", "http://"+ip+":8081");
    api.id = id;
    api.ip = ip;
    var state = NODE_STATE.NEW;
    var pollState = function(){
        api.stat.poll().then(function(stat){
            api.setState(NODE_STATE.ALIVE, stat);
            setTimeout(pollState, REFRESH_NODE_STATE_INTERVAL);
        }, function(){
            api.setState(NODE_STATE.FAILED);
            setTimeout(pollState, REFRESH_NODE_STATE_FAILED_INTERVAL);
        });
    };
    pollState();
    var detailsType = NODE_DETAILS_TYPE.ALL;
    var updateDetails = function(type, data) {
        if (state == NODE_STATE.ACTIVE && detailsType == type) {
            updateNodeDetails(api.id, type, data);
            setTimeout(pollDetails, REFRESH_NODE_DETAILS);
        }
    };
    var pollDetails = function() {
        if (state == NODE_STATE.ACTIVE) {
            switch (detailsType) {
                case NODE_DETAILS_TYPE.ALL:
                    api.stream.findAll().then(function (streams) {
                        updateDetails(NODE_DETAILS_TYPE.ALL, streams);
                    }, function (e) {
                        //no streams or node is dead
                        updateDetails(NODE_DETAILS_TYPE.ALL, []);
                    });
                    break;
                case NODE_DETAILS_TYPE.PULLED:
                    api.pull.findAll().then(function (streams) {
                        updateDetails(NODE_DETAILS_TYPE.PULLED, pullDetailsToStreamDetails(streams));
                    }, function (e) {
                        //no streams or node is dead
                        updateDetails(NODE_DETAILS_TYPE.PULLED, []);
                    });
                    break;
                case NODE_DETAILS_TYPE.RTSP:
                    api.rtsp.findAll().then(function (streams) {
                        updateDetails(NODE_DETAILS_TYPE.RTSP, rtspDetailsToStreamDetails(streams));
                    }, function (e) {
                        //no streams or node is dead
                        updateDetails(NODE_DETAILS_TYPE.RTSP, []);
                    });
                    break;
            }
        }
    };
    api.setDetailsType = function(type) {
        detailsType = type;
    };
    api.setState = function(newState, data){
        switch (newState) {
            case NODE_STATE.ALIVE:
                updateNodeState(api.id, data);
                if (state !== NODE_STATE.ACTIVE) {
                    state = newState;
                }
                break;
            case NODE_STATE.ACTIVE:
                if (state == NODE_STATE.ALIVE || state == NODE_STATE.DEACTIVATE) {
                    state = newState;
                    $("#" + api.id).addClass("active");
                    $("#nodeControls.hidden").removeClass("hidden");
                    pollDetails();
                }
                break;
            case NODE_STATE.DEACTIVATE:
                updateDetails([]);
                state = newState;
                $("#"+api.id).removeClass("active");
                $("#nodeControls").addClass("hidden");
                break;
            case NODE_STATE.FAILED:
                if (state == NODE_STATE.ACTIVE) {
                    updateDetails([]);
                    $("#"+api.id).removeClass("active");
                    $("#nodeControls").addClass("hidden");
                }
                updateNodeState(api.id, NODE_STATE.FAILED);
                state = newState;
                break;
        }
    };
    return api;
}

function addNode(ip) {
    var id = ip.replace(/\./g, "");
    if (nodes[id]) {
        return;
    }
    var node = createNode(id, ip);
    nodes[id] = node;
    //append node
    var html = "<button type='button' class='list-group-item list-group-item-action' id='"+id+"'>"+ip+"</button>";
    $("#nodes").append(html);
    $("#"+id).on("click", function(e){
        var activeNode = getActiveNode();
        if (activeNode) {
            activeNode.setState(NODE_STATE.DEACTIVATE);
        }
        nodes[id].setState(NODE_STATE.ACTIVE);
    });
}

function updateNodeState(id, state) {
    if (state == NODE_STATE.FAILED) {
        $("#"+id).addClass("list-group-item-danger");
        $("#" + id + "-state").remove();
    } else {
        var node = $("#"+id);
        node.removeClass("list-group-item-danger");
        if (!node.hasClass("list-group-item-success")) {
            node.addClass("list-group-item-success");
        }
        var streamsIn = parseInt(state.stream.streams_rtmfp_in)+
            parseInt(state.stream.streams_rtmp_in)+
            parseInt(state.stream.streams_rtsp_in)+
            parseInt(state.stream.streams_webrtc_in);
        var streamsOut = parseInt(state.stream.streams_rtmfp_out)+
            parseInt(state.stream.streams_rtmp_out)+
            parseInt(state.stream.streams_rtsp_out)+
            parseInt(state.stream.streams_webrtc_out);
        var mem = parseInt(state.system.system_memory_total)-parseInt(state.system.system_memory_free);
        if ($("#" + id + "-state").length == 0) {
            //add new entry to the table
            var html = "<tr id='"+id+"-state'>" +
                    "<th scope='row'>"+nodes[id].ip+"</th>" +
                    "<td id='"+id+"-state-cpu'>"+state.system.system_java_cpu_usage+"</td>" +
                    "<td id='"+id+"-state-mem'>"+(mem)+"</td>" +
                    "<td id='"+id+"-state-threads'>"+state.core.core_threads+"</td>" +
                    "<td id='"+id+"-state-conn'>"+state.connection.connections+"</td>" +
                    "<td id='"+id+"-state-in'>"+(streamsIn)+"</td>" +
                    "<td id='"+id+"-state-out'>"+(streamsOut)+"</td>" +
                    "</tr>";
            $("#generalInfoTable").append(html);
        } else {
            $("#"+id+"-state-cpu").text(state.system.system_java_cpu_usage);
            $("#"+id+"-state-mem").text(mem);
            $("#"+id+"-state-threads").text(state.core.core_threads);
            $("#"+id+"-state-conn").text(state.connection.connections);
            $("#"+id+"-state-in").text(streamsIn);
            $("#"+id+"-state-out").text(streamsOut);
        }
    }
}

function updateNodeDetails(id, type, streams) {
    //clear
    $("#streamsTable").empty();
    streams.forEach(function(stream){
        var $tr = $("<tr>");
        var $th = $("<th>", {scope: "row"}).append(stream.mediaSessionId);
        var $name = createTd(stream.name);
        var $provider = createTd(stream.mediaProvider);
        var $status = createTd(stream.status);
        var $type = createTd(stream.published == true ? "IN" : "OUT");
        var $aCodec = createTd(stream.audioCodec);
        var $vCodec = createTd(stream.videoCodec);
        var $termButton = $("<button>", {
            type: "button",
            class: "btn btn-default btn-danger btn-block"
        }).append("TERMINATE");
        var $actTd = createTd($termButton);
        if (stream.published && type == NODE_DETAILS_TYPE.ALL) {
            var $pushButton = $("<button>", {
                type: "button",
                class: "btn btn-primary btn-block",
                'data-toggle': "modal",
                'data-target': "#pushModal",
                'data-streamName': stream.name
            }).append("PUSH");
            $actTd.append($pushButton);
        }
        $termButton.on("click", function(e){
            switch (type) {
                case NODE_DETAILS_TYPE.ALL:
                    nodes[id].stream.terminate(stream.mediaSessionId).catch(function(e){});
                    break;
                case NODE_DETAILS_TYPE.PULLED:
                    nodes[id].pull.terminate(stream.name.split("->")[0]).catch(function(e){});
                    break;
                case NODE_DETAILS_TYPE.RTSP:
                    nodes[id].rtsp.terminate(stream.name).catch(function(e){});
                    break;

            }
            $tr.remove();
        });
        $tr.append($th).append($name).append($provider).append($status).append($type).append($aCodec).append($vCodec).append($actTd);
        $("#streamsTable").append($tr);
    });
}

function pullStream() {
    var node = getActiveNode();
    var remote = $("#pullUrl").val();
    var localName = $("#pullLocalName").val();
    var remoteName = $("#pullRemoteName").val();
    node.pull.pull(remote, localName, remoteName).then(function(){
        //pulled ok
    }, function(e){
        //pull failed
    });
    $("#pullModal").modal('hide');
}

function pushStream() {
    var node = getActiveNode();
    var remote = $("#pushUrl").val();
    var remoteName = $('#pushForm a').text();
    node.push.push(remoteName, remote).then(function(){
        //pushed ok
    }, function(e){
        //push failed
    });
    $("#pushModal").modal('hide');
}

function pullRTSPStream() {
    var node = getActiveNode();
    var uri = $("#pullRtspUrl").val();
    node.rtsp.pull(uri).then(function(){
        //pulled ok
    }, function(e){
        //pull failed
    });
    $("#pullRtspModal").modal('hide');
}

//pullBatchStream

function pullStreamBatch() {
    var node = getActiveNode();
    var remote = "ws://"+$("#pullStreamBatchNodes").val()+":8080/";
    var localName = $("#pullBatchLocalName").val();
    var remoteName = $("#pullBatchRemoteName").val();
    var qty = parseInt($("#pullBatchQty").val());
    for (;qty > 0; qty--) {
        node.pull.pull(remote, localName+qty, remoteName).catch(function(e){});
    }
    $("#pullStreamBatchModal").modal('hide');
}

function getActiveNode() {
    var active = $("button.active");
    if (active.length > 0 && nodes[active[0].id]) {
        return nodes[active[0].id];
    }
}

/** UTIL **/
function pullDetailsToStreamDetails(details) {
    var ret = [];
    details.forEach(function(stream){
        var entry = {
            mediaSessionId: stream.localMediaSessionId,
            name: stream.remoteStreamName + "->" + stream.localStreamName,
            mediaProvider: "WebRTC",
            status: stream.status,
            published: true,
            audioCodec: "--",
            videoCodec: "--"
        };
        ret.push(entry);
    });
    return ret;
}

function rtspDetailsToStreamDetails(details) {
    var ret = [];
    details.forEach(function(stream){
        var entry = {
            mediaSessionId: "",
            name: stream.uri,
            mediaProvider: "RTSP",
            status: stream.status,
            published: true,
            audioCodec: "--",
            videoCodec: "--"
        };
        ret.push(entry);
    });
    return ret;
}

var createTd = function(text) {
    return $("<td>").append(text);
};


