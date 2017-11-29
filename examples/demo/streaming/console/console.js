
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
    RTSP: "rtsp",
    API: "api"
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
    var populateNodes = function(storage) {
        storage.empty();
        var html = "";
        for (var id in nodes) {
            html += "<option value='" + nodes[id].ip + "'>" + nodes[id].ip + "</option>";
        }
        storage.append(html);
    };
    $('#pullStreamBatchModal').on('show.bs.modal', function(e) {
        populateNodes($("#pullStreamBatchNodes"));
    });
    $("#pullBatchStream").on("click", function(e){
        pullStreamBatch();
    });
    $('#registerBatchModal').on('show.bs.modal', function(e) {
        populateNodes($("#registerBatchNodes"));
    });
    $("#registerBatch").on("click", function(e){
        registerBatch();
    });
    $("#unregisterBatch").on("click", function(e){
        unregisterBatch();
    });
    $("#callBatch").on("click", function(e){
        callBatch();
    });
    $("#callStressBatch").on("click", function(e){
        callStressTest();
    });
    $("#hangupBatch").on("click", function(e){
        hangupBatch();
    });
    $('#registerStressBatchModal').on('show.bs.modal', function(e) {
        populateNodes($("#registerStressBatchNodes"));
    });
    $("#registerStressBatch").on("click", function(e){
        regoStressTest();
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
                case NODE_DETAILS_TYPE.API:
                    api.api.findAll().then(function (agents) {
                        updateDetails(NODE_DETAILS_TYPE.API, apiDetailsToStreamDetails(agents));
                    }, function (e) {
                        //no streams or node is dead
                        updateDetails(NODE_DETAILS_TYPE.API, []);
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
                case NODE_DETAILS_TYPE.API:
                    nodes[id].api.terminate({sipLogin: stream.name}).then(function(){
                    }, function(){
                        console.log("Failed to terminate sip agent " + stream.name);
                    });
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
    var interval = setInterval(function(){
        if (qty > 0) {
            node.pull.pull(remote, localName+qty, remoteName).catch(function(e){});
            qty--;
        } else {
            clearInterval(interval);
        }
    }, 200);
    $("#pullStreamBatchModal").modal('hide');
}

function registerBatch() {
    var node = getActiveNode();
    var testedNode = $("#registerBatchNodes").val();
    var registrar = $("#registerRegistrarAddress").val();
    var start = $("#registerBatchStart").val();
    var end = $("#registerBatchEnd").val();
    var rate = $("#registerBatchRate").val();
    var password = "Abcd1111";
    var i = start;
    var register = function(login){
        doRego(node, testedNode, login, registrar, password).then(function(){
        }, function(){
            console.log("Failed to initiate sip register " + login + " " + end);
        });
    };
    var throttle = rateLimit(rate, 1000, register);
    for (; i < end; i++) {
        throttle(i);
    }
    $("#registerBatchModal").modal('hide');
}

function unregisterBatch() {
    var node = getActiveNode();
    var start = $("#unregisterBatchStart").val();
    var end = $("#unregisterBatchEnd").val();
    var rate = $("#unregisterBatchRate").val();
    var i = start;
    var terminate = function(login){
        node.api.terminate({sipLogin: login}).then(function(){
        }, function(){
            console.log("Failed to terminate sip agent " + i + " " + end);
        });
    };
    var throttle = rateLimit(rate, 1000, terminate);
    for (; i < end; i++) {
        throttle(i);
    }
    $("#unregisterBatchModal").modal('hide');
}

function callBatch() {
    var node = getActiveNode();
    var ext = $("#callExtension").val();
    var start = $("#callBatchStart").val();
    var end = $("#callBatchEnd").val();
    var rate = $("#callBatchRate").val();
    var i = start;
    var call = function(login){
        doCall(node, login, ext).then(function(){
        }, function(){
            console.log("Failed to call through sip agent " + i + " " + end);
        });
    };
    var throttle = rateLimit(rate, 1000, call);
    for (; i < end; i++) {
        throttle(i);
    }
    $("#callBatchModal").modal('hide');
}

function hangupBatch() {
    var node = getActiveNode();
    var start = $("#hangupBatchStart").val();
    var end = $("#hangupBatchEnd").val();
    var rate = $("#hangupBatchRate").val();
    var i = start;
    node.api.findAll().then(function (sipState) {
        var hangup = function(login){
            //lookup agents' state
            var state = null;
            for (var c = 0; c < sipState.length; c++) {
                //console.log("look for " + login);
                if (sipState[c].connection.sipLogin == login+"") {
                    //console.log("found state " + login);
                    state = sipState[c];
                    break;
                }
            }
            if (state != null && state.calls.length > 0) {
                var call = state.calls[0];
                call.wcsCallAgentId = "" + state.connection.sipLogin;
                node.api.hangup(call).then(function(){
                }, function(){
                    console.log("Failed to hangup sip agent " + login + " " + end);
                });
            }
        };
        var throttle = rateLimit(rate, 1000, hangup);
        for (; i < end; i++) {
            throttle(i);
        }
        $("#hangupBatchModal").modal('hide');
    }, function (e) {
        $("#hangupBatchModal").modal('hide');
    });
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

function apiDetailsToStreamDetails(details) {
    var ret = [];
    details.forEach(function(agent){
        var entry = {
            mediaSessionId: "",
            name: agent.id,
            mediaProvider: "WebRTC",
            status: "ACTIVE",
            published: false,
            audioCodec: "--",
            videoCodec: "--"
        };
        var call = agent.calls[0];
        if (call) {
            entry.mediaSessionId = call.callId;
            entry.status = "CALLING";
        }
        ret.push(entry);
    });
    return ret;
}

var createTd = function(text) {
    return $("<td>").append(text);
};

function doRego(node, testedNode, login, domain, password) {
    var connection = {
        appKey: "defaultApp",
        clientBrowserVersion: "",
        clientVersion: "",
        mediaProviders: ["WebRTC"],
        sipAuthenticationName: login,
        sipLogin: login,
        sipDomain: domain,
        sipOutboundProxy: domain,
        sipPassword: password,
        sipPort: "5060",
        sipRegisterRequired: true,
        urlServer: "ws://"+testedNode+":8080/"
    };
    return node.api.createSession(connection);
}

function doCall(node, login, ext) {
    var call = {
        "wcsCallAgentId": login+"",
        "callId":createUUID(32),
        "incoming":false,
        "hasVideo":false,
        "hasAudio":true,
        "status":"PENDING",
        "mediaProvider":"WebRTC",
        "caller":login,
        "callee":ext,
        "visibleName":login
    };
    return node.api.call(call);
}

/**
 * PREDEFINED TESTS
 */

function regoStressTest() {
    var node = getActiveNode();
    var testedNode = $("#registerStressBatchNodes").val();
    var registrar = $("#registerStressRegistrarAddress").val();
    var start = parseInt($("#registerStressBatchStart").val());
    var end = parseInt($("#registerStressBatchEnd").val());
    var rate = parseInt($("#registerStressBatchRate").val());
    var password = "Abcd1111";
    var i = start;
    var register = function(login){
        doRego(node, testedNode, login, registrar, password).then(function(){
        }, function(){
            console.log("Failed to initiate sip register " + login + " " + end);
        });
    };
    var terminate = function(login){
        node.api.terminate({sipLogin: login}).then(function(){
        }, function(){
            console.log("Failed to terminate sip agent " + i + " " + end);
        });
    };
    var rThrottle = rateLimit(rate, 1000, register);
    var pendingRegistrations = [];
    var pendingTerminations = [];
    //init
    var initialInit = i + rate*2;
    for (; i < initialInit; i++) {
        pendingRegistrations.push(i);
        rThrottle(i);
    }
    var pollState = function() {
        node.api.findAll().then(function (sipState) {
            var c;
            //update state
            var active = [];
            for (c = 0; c < sipState.length; c++) {
                active[c] = parseInt(sipState[c].id);
                var pendingIndex = pendingRegistrations.indexOf(parseInt(sipState[c].id));
                if (pendingIndex > -1) {
                    //console.log("Remove from pending " + sipState[c].id);
                    pendingRegistrations.splice(pendingIndex, 1);
                }
            }
            for (c = 0; c < pendingTerminations.length; c++) {
                if (active.includes(pendingTerminations[c])) {
                    continue;
                }
                pendingTerminations.splice(pendingTerminations.indexOf(pendingTerminations[c]), 1);
            }
            //terminate
            var t = 0;
            for (c = 0; t <= rate && c < sipState.length; c++) {
                if (!pendingTerminations.includes(parseInt(sipState[c].id))) {
                    terminate(sipState[c].id);
                    t++;
                    pendingTerminations.push(parseInt(sipState[c].id));
                }
                //console.log("Skip termination of " + sipState[c].id);
            }
            //console.log("Requested termination of " + t + " registrations");
            for (c = 0; c <= rate && c <= t; c++) {
                i++;
                if (i >= end) {
                    i = start;
                }
                if (active.includes(i)) {
                    //console.log("Skip registration of " + i);
                    continue;
                }
                if (pendingRegistrations.includes(i)) {
                    //console.log("Skip registration of " + i);
                    continue;
                }
                pendingRegistrations.push(i);
                register(i);
            }
        });
    };
    var interval = setInterval(pollState, 1000);
    console.log("Stress register started");
    //$("#registerStressBatchModal").modal('hide');
}

function callStressTest() {
    var node = getActiveNode();
    var ext = $("#callStressExtension").val();
    var start = parseInt($("#callStressBatchStart").val());
    var end = parseInt($("#callStressBatchEnd").val());
    var rate = parseInt($("#callStressBatchRate").val());
    var i = start;
    var call = function(login){
        doCall(node, login, ext).then(function(){
        }, function(){
            console.log("Failed to call through sip agent " + i + " " + end);
        });
    };
    var hangup = function(login, state){
        if (state != null && state.calls.length > 0) {
            var call = state.calls[0];
            call.wcsCallAgentId = "" + state.connection.sipLogin;
            node.api.hangup(call).then(function(){
            }, function(){
                console.log("Failed to hangup sip agent " + login);
            });
        }
    };
    var throttle = rateLimit(rate, 1000, call);

    var pendingCalls = [];
    var pendingTerminations = [];
    //init
    var initialInit = i + rate*2;
    for (; i < initialInit; i++) {
        pendingCalls.push(i);
        throttle(i);
    }
    var pollState = function() {
        node.api.findAll().then(function (sipState) {
            var c;
            //update state
            var active = [];
            for (c = 0; c < sipState.length; c++) {
                active[c] = parseInt(sipState[c].id);
                var pendingIndex = pendingCalls.indexOf(parseInt(sipState[c].id));
                if (pendingIndex > -1 && sipState[c].calls.length > 0) {
                    //console.log("Remove call from pending " + sipState[c].id);
                    pendingCalls.splice(pendingIndex, 1);
                }
                var tIndex = pendingTerminations.indexOf(parseInt(sipState[c].id));
                if (tIndex > -1 && sipState[c].calls.length == 0) {
                    //console.log("Remove call from pending terminations " + sipState[c].id);
                    pendingTerminations.splice(pendingIndex, 1);
                }
            }
            for (c = 0; c < pendingTerminations.length; c++) {
                if (active.includes(pendingTerminations[c])) {
                    continue;
                }
                pendingTerminations.splice(pendingTerminations.indexOf(pendingTerminations[c]), 1);
            }
            //terminate
            var t = 0;
            for (c = 0; t <= rate && c < sipState.length; c++) {
                if (!pendingTerminations.includes(parseInt(sipState[c].id)) && sipState[c].calls.length > 0) {
                    hangup(sipState[c].id, sipState[c]);
                    t++;
                    pendingTerminations.push(parseInt(sipState[c].id));
                } else {
                    //console.log("Skip termination of " + sipState[c].id);
                }
            }
            //console.log("Requested termination of " + t + " calls");
            for (c = 0; c <= rate && c <= t; c++) {
                i++;
                if (i >= end) {
                    i = start;
                }
                if (!active.includes(i)) {
                    //console.log("Skip call of " + i);
                    continue;
                }
                if (pendingCalls.includes(i)) {
                    //console.log("Skip call of " + i);
                    continue;
                }
                //lookup agents' state
                for (var s = 0; s < sipState.length; s++) {
                    //console.log("look for " + login);
                    if (sipState[s].connection.sipLogin == i+"" && sipState[s].calls.length == 0) {
                        //console.log("found state " + login);
                        pendingCalls.push(i);
                        call(i);
                        break;
                    }
                }
            }
        });
    };
    var interval = setInterval(pollState, 1000);
    console.log("Stress calls started");
    //$("#callStressBatchModal").modal('hide');
}


/**
 * https://github.com/wankdanker/node-function-rate-limit/blob/master/index.js
 */
function rateLimit(limitCount, limitInterval, fn) {
    var fifo = [];

    // count starts at limit
    // each call of `fn` decrements the count
    // it is incremented after limitInterval
    var count = limitCount;

    function call_next(args) {
        setTimeout(function() {
            if (fifo.length > 0) {
                call_next();
            }
            else {
                count = count + 1;
            }
        }, limitInterval);

        var call_args = fifo.shift();

        // if there is no next item in the queue
        // and we were called with args, trigger function immediately
        if (!call_args && args) {
            fn.apply(args[0], args[1]);
            return;
        }

        fn.apply(call_args[0], call_args[1]);
    }

    return function rate_limited_function() {
        var ctx = this;
        var args = Array.prototype.slice.call(arguments);
        if (count <= 0) {
            fifo.push([ctx, args]);
            return;
        }

        count = count - 1;
        call_next([ctx, args]);
    };
}


