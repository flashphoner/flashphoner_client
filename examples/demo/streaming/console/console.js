
var REFRESH_NODE_STATE_INTERVAL = 5000;
var REFRESH_NODE_STATE_FAILED_INTERVAL = 10000;
var REFRESH_NODE_DETAILS = 2000;
var STRESS_TEST_INTERVAL = 1000;
var STRESS_TEST_FAILED_INTERVAL = STRESS_TEST_INTERVAL * 2;
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
    API: "api",
    TESTS: "tests"
};

var STRESS_TESTS = {
    REGISTER: { running: false},
    CALL: { running: false},
    PLAY_STREAM: { running: false},
    PUBLISH_STREAM: { running: false}
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
        var node = getActiveNode();
        var html = "";
        for (var id in nodes) {
            if (id != node.id) {
                html += "<option value='" + nodes[id].ip + "'>" + nodes[id].ip + "</option>";
            }
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
    $('#streamStressBatchModal').on('show.bs.modal', function(e) {
        if (STRESS_TESTS.PLAY_STREAM.running) {
            $("#streamStressBatch").text('Stop').removeClass('btn-success').addClass('btn-danger');
        } else {
            $("#streamStressBatch").text('Start').removeClass('btn-danger').addClass('btn-success');
        }
        populateNodes($("#streamStressBatchNodes"));
    });
    $("#streamStressBatch").on("click", function(e){
        streamPlayStressTest();
    });

    $('#streamPublishStressBatchModal').on('show.bs.modal', function(e) {
        populateNodes($("#streamPublishStressBatchNodes"));
    });
    $("#streamPublishStressBatch").on("click", function(e){
        streamPublishStressTest();
    });

    $("#generalInfoTable").sortable();
    $("#streamStressMode").change(function() {
        if ($(this).val() == 'random') {
            $("#normal").addClass('hidden');
            $("#random").removeClass('hidden');
        } else {
            $("#normal").removeClass('hidden');
            $("#random").addClass('hidden');
        }
    });
});

function createNode(id, ip) {
    var api = FlashphonerRestApi.instance("http://"+ip+":8081", "http://"+ip+":8081");
    api.id = id;
    api.ip = ip;
    api.tests = [];
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
    var processDetailsType = function() {
        if (state == NODE_STATE.ACTIVE) {
            if (detailsType == NODE_DETAILS_TYPE.TESTS) {
                $("#streamsTable").addClass("hidden");
                $("#testsTable").removeClass("hidden");
            } else {
                $("#testsTable").addClass("hidden");
                $("#streamsTable").removeClass("hidden");
            }
        }
    };
    var updateDetails = function(type, data) {
        if (state == NODE_STATE.ACTIVE && detailsType == type) {
            if (NODE_DETAILS_TYPE.TESTS == type) {
                updateNodeTestsDetails(api.id);
            } else {
                updateNodeDetails(api.id, type, data);
            }
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
                case NODE_DETAILS_TYPE.TESTS:
                    updateDetails(NODE_DETAILS_TYPE.TESTS, []);
                    break;
            }
        }
    };
    api.setDetailsType = function(type) {
        detailsType = type;
        processDetailsType();
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
                    processDetailsType();
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
            $("#generalInfoTable").sortable("refresh");
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
    $("#streamsTableBody").empty();
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
        if (stream.status == "NEW") {
            $("#streamsTableBody").prepend($tr);
        } else {
            $("#streamsTableBody").append($tr);
        }
    });
}

function updateNodeTestsDetails(id) {
    $("#testsTableBody").empty();
    nodes[id].tests.forEach(function(test, i){
        var $tr = $("<tr>");
        var $th = $("<th>", {scope: "row"}).append(i);
        var $name = createTd(test.name);
        var $start = createTd(test.start);
        var $end = createTd(test.end);
        var $rate = createTd(test.rate);
        var $initialized = createTd(test.initialized);
        var $terminated = createTd(test.terminated);
        var $pending = createTd(test.pending);
        var $termButton = $("<button>", {
            type: "button",
            class: "btn btn-default btn-danger btn-block"
        }).append("TERMINATE");
        var $actTd = createTd($termButton);
        $termButton.on("click", function(){
            test.terminate(i);
            $tr.remove();
        });
        $tr.append($th).append($name).append($start).append($end).append($rate).append($initialized).append($terminated).append($pending).append($actTd);
        $("#testsTableBody").append($tr);
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
    if (!$("#pullStreamBatchNodes").val()) {
        $('#warningModal').modal();
        return false;
    }
    var node = getActiveNode();
    var proto = $("#pullStreamBatchProto").val();
    var localName = $("#pullBatchLocalName").val();
    var remoteName = $("#pullBatchRemoteName").val();
    var remote;
    if (proto == "ws") {
        remote = "ws://" + $("#pullStreamBatchNodes").val() + ":8080/";
    } else {
        remote = "rtmp://" + $("#pullStreamBatchNodes").val() + ":1935/live/" + remoteName;
    }
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
    if (!$("#registerBatchNodes").val()) {
        $('#warningModal').modal();
        return false;
    }
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

function getNode(ip) {
    return nodes[ip.replace(/\./g, "")];
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
    if (!$("#registerStressBatchNodes").val()) {
        $('#warningModal').modal();
        return false;
    }
    var node = getActiveNode();
    var testedNode = $("#registerStressBatchNodes").val();
    var registrar = $("#registerStressRegistrarAddress").val();
    var start = parseInt($("#registerStressBatchStart").val());
    var end = parseInt($("#registerStressBatchEnd").val());
    var rate = parseInt($("#registerStressBatchRate").val());
    var password = "Abcd1111";
    var i = start;
    var rep = {
        name: "REGO",
        start: start,
        end: end,
        rate: rate,
        initialized: 0,
        terminated: 0,
        pending: 0
    };
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
    var running = true;
    var schedule = function(t) {
        setTimeout(pollState, t);
    };
    var pollState = function() {
        if (!running) {
            return;
        }
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
                    rep.initialized++;
                }
            }
            for (c = 0; c < pendingTerminations.length; c++) {
                if (active.includes(pendingTerminations[c])) {
                    continue;
                }
                pendingTerminations.splice(pendingTerminations.indexOf(pendingTerminations[c]), 1);
                rep.terminated++;
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
            rep.pending = (pendingRegistrations.length + pendingTerminations.length);
            schedule(STRESS_TEST_INTERVAL);
        }, function(e) {
            schedule(STRESS_TEST_FAILED_INTERVAL);
        });
    };
    rep.terminate = function(id){
        running = false;
        node.tests.splice(id, 1);
    };
    node.tests.push(rep);
    pollState();
    console.log("Stress register started");
    $("#registerStressBatchModal").modal('hide');
}

function callStressTest() {
    var node = getActiveNode();
    var ext = $("#callStressExtension").val();
    var start = parseInt($("#callStressBatchStart").val());
    var end = parseInt($("#callStressBatchEnd").val());
    var rate = parseInt($("#callStressBatchRate").val());
    var rep = {
        name: "CALL",
        start: start,
        end: end,
        rate: rate,
        initialized: 0,
        terminated: 0,
        pending: 0
    };
    var running = true;
    var schedule = function(t) {
        setTimeout(pollState, t);
    };
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
        if (!running) {
            return;
        }
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
                    rep.initialized++;
                }
                var tIndex = pendingTerminations.indexOf(parseInt(sipState[c].id));
                if (tIndex > -1 && sipState[c].calls.length == 0) {
                    //console.log("Remove call from pending terminations " + sipState[c].id);
                    pendingTerminations.splice(pendingIndex, 1);
                    rep.terminated++;
                }
            }
            for (c = 0; c < pendingTerminations.length; c++) {
                if (active.includes(pendingTerminations[c])) {
                    continue;
                }
                pendingTerminations.splice(pendingTerminations.indexOf(pendingTerminations[c]), 1);
                rep.terminated++;
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
            rep.pending = pendingTerminations.length + pendingCalls.length;
            schedule(STRESS_TEST_INTERVAL);
        }, function(){
            schedule(STRESS_TEST_FAILED_INTERVAL);
        });
    };
    rep.terminate = function(id){
        running = false;
        node.tests.splice(id, 1);
    };
    node.tests.push(rep);
    pollState();
    console.log("Stress calls started");
    $("#callStressBatchModal").modal('hide');
}

function streamPlayStressTest() {
    var node = getActiveNode();
    if (!$("#streamStressBatchNodes").val()) {
        $('#warningModal').modal();
        return false;
    }
    var mode = $( "#streamStressMode option:selected" ).val();

    if (mode == "random") {
        streamPlayStressTestRandom();
        return;
    }

    var remote = "ws://" + $("#streamStressBatchNodes").val() + ":8080";
    var name = $("#streamStressBatchName").val();
    var start = parseInt($("#streamStressBatchStart").val());
    var end = parseInt($("#streamStressBatchEnd").val());
    var rate = parseInt($("#streamStressBatchRate").val());
    var init = parseInt($("#streamStressBatchInit").val());
    var rep = {
        name: "STREAM-PLAY",
        start: start,
        end: end,
        rate: rate,
        initialized: 0,
        terminated: 0,
        pending: 0
    };
    var running = true;
    var schedule = function(t) {
        setTimeout(pollState, t);
    };
    var i = start;
    var play = function(localName){
        node.pull.pull(remote, localName, name).then(function(){
        }, function(){
            console.log("Failed to play stream " + name + " as " + localName);
        });
    };
    var stop = function(localName){
        node.pull.terminate(localName).then(function(){
        }, function(){
            console.log("Failed to stop stream " + localName);
        });
    };
    var throttle = rateLimit(rate, 1000, play);
    var pendingPlays = [];
    var pendingStops = [];
    //init
    var initialInit = i + init < i + rate*2 ? i + rate*2 : i + init;
    for (; i < initialInit; i++) {
        pendingPlays.push(name+i);
        throttle(name+i);
    }
    var pollState = function() {
        if (!running) {
            return;
        }
        node.pull.findAll().then(function (pullState) {
            var c;
            //update state
            var active = [];
            for (c = 0; c < pullState.length; c++) {
                active[c] = pullState[c].localStreamName;
                var pendingIndex = pendingPlays.indexOf(pullState[c].localStreamName);
                if (pendingIndex > -1) {
                    console.log("Remove stream from pending plays " + pullState[c].localStreamName);
                    pendingPlays.splice(pendingIndex, 1);
                    rep.initialized++;
                }
                var tIndex = pendingStops.indexOf(pullState[c].localStreamName);
                if (tIndex > -1) {
                    console.log("Remove stream from pending stops " + pullState[c].localStreamName);
                    pendingStops.splice(pendingIndex, 1);
                    rep.terminated++;
                }
            }
            for (c = 0; c < pendingStops.length; c++) {
                if (active.includes(pendingStops[c])) {
                    continue;
                }
                pendingStops.splice(pendingStops.indexOf(pendingStops[c]), 1);
                rep.terminated++;
            }
            //terminate
            var t = 0;
            for (c = 0; t <= rate && c < pullState.length; c++) {
                if (!pendingStops.includes(pullState[c].localStreamName)) {
                    stop(pullState[c].localStreamName);
                    t++;
                    pendingStops.push(pullState[c].localStreamName);
                } else {
                    console.log("Skip termination of " + pullState[c].localStreamName);
                }
            }
            console.log("Requested termination of " + t + " streams");
            for (c = 0; c <= rate && c <= t; c++) {
                i++;
                if (i >= end) {
                    i = start;
                }
                var localName = name+i;
                if (pendingPlays.includes(localName)) {
                    console.log("Skip stream of " + localName);
                    continue;
                }
                if (pendingStops.includes(localName)) {
                    console.log("Skip stream of " + localName);
                    continue;
                }
                pendingPlays.push(localName);
                play(localName);
            }
            rep.pending = pendingStops.length + pendingPlays.length;
            schedule(STRESS_TEST_INTERVAL);
        }, function(){
            schedule(STRESS_TEST_FAILED_INTERVAL);
        });
    };
    rep.terminate = function(id){
        running = false;
        node.tests.splice(id, 1);
    };
    node.tests.push(rep);
    pollState();
    console.log("Stress streams started");
    STRESS_TESTS.PLAY_STREAM.running = true;
    $("#streamStressBatchModal").modal('hide');
}

function streamPublishStressTest() {
    if (!$("#streamPublishStressBatchNodes").val()) {
        $('#warningModal').modal();
        return false;
    }
    var node = getActiveNode();
    var remote = "ws://" + $("#streamPublishStressBatchNodes").val() + ":8080";
    var name = $("#streamPublishStressBatchName").val();
    var start = parseInt($("#streamPublishStressBatchStart").val());
    var end = parseInt($("#streamPublishStressBatchEnd").val());
    var rate = parseInt($("#streamPublishStressBatchRate").val());
    var init = parseInt($("#streamPublishStressBatchInit").val());
    var rep = {
        name: "STREAM-PUBLISH",
        start: start,
        end: end,
        rate: rate,
        initialized: 0,
        terminated: 0,
        pending: 0
    };
    var running = true;
    var schedule = function(t) {
        setTimeout(pollState, t);
    };
    var i = start;
    var publish = function(remoteName){
        node.pull.push(remote, name, remoteName).then(function(){
        }, function(){
            console.log("Failed to publish stream " + name + " as " + remoteName);
        });
    };
    var stop = function(remoteName){
        node.pull.terminate(name, remoteName).then(function(){
        }, function(){
            console.log("Failed to stop stream " + remoteName);
        });
    };
    var throttle = rateLimit(rate, 1000, publish);
    var pendingPublish = [];
    var pendingStops = [];
    //init
    var initialInit = i + init < i + rate*2 ? i + rate*2 : i + init;
    for (; i < initialInit; i++) {
        pendingPublish.push(name+i);
        throttle(name+i);
    }
    var pollState = function() {
        if (!running) {
            return;
        }
        node.pull.findAll().then(function (pullState) {
            var c;
            //update state
            var active = [];
            for (c = 0; c < pullState.length; c++) {
                active[c] = pullState[c].remoteStreamName;
                var pendingIndex = pendingPublish.indexOf(pullState[c].remoteStreamName);
                if (pendingIndex > -1) {
                    console.log("Remove stream from pending publish " + pullState[c].remoteStreamName);
                    pendingPublish.splice(pendingIndex, 1);
                    rep.initialized++;
                }
                var tIndex = pendingStops.indexOf(pullState[c].remoteStreamName);
                if (tIndex > -1) {
                    console.log("Remove stream from pending stops " + pullState[c].remoteStreamName);
                    pendingStops.splice(pendingIndex, 1);
                    rep.terminated++;
                }
            }
            for (c = 0; c < pendingStops.length; c++) {
                if (active.includes(pendingStops[c])) {
                    continue;
                }
                pendingStops.splice(pendingStops.indexOf(pendingStops[c]), 1);
                rep.terminated++;
            }
            //terminate
            var t = 0;
            for (c = 0; t <= rate && c < pullState.length; c++) {
                if (!pendingStops.includes(pullState[c].remoteStreamName)) {
                    stop(pullState[c].remoteStreamName);
                    t++;
                    pendingStops.push(pullState[c].remoteStreamName);
                } else {
                    console.log("Skip termination of " + pullState[c].remoteStreamName);
                }
            }
            console.log("Requested termination of " + t + " streams");
            for (c = 0; c <= rate && c <= t; c++) {
                i++;
                if (i >= end) {
                    i = start;
                }
                var remoteName = name+i;
                if (pendingPublish.includes(remoteName)) {
                    console.log("Skip stream of " + remoteName);
                    continue;
                }
                if (pendingStops.includes(remoteName)) {
                    console.log("Skip stream of " + remoteName);
                    continue;
                }
                pendingPublish.push(remoteName);
                publish(remoteName);
            }
            rep.pending = pendingStops.length + pendingPublish.length;
            schedule(STRESS_TEST_INTERVAL);
        }, function(){
            schedule(STRESS_TEST_FAILED_INTERVAL);
        });
    };
    rep.terminate = function(id){
        running = false;
        node.tests.splice(id, 1);
    };
    node.tests.push(rep);
    pollState();
    console.log("Stress streams started");
    $("#streamPublishStressBatchModal").modal('hide');
}

function streamPlayStressTestRandom() {
    var node = getActiveNode();
    var streams = {};
    var remoteNode = getNode($("#streamStressBatchNodes").val());
    var remote = "ws://" + $("#streamStressBatchNodes").val() + ":8080";
    var start = 0;
    var end = parseInt($("#streamStressMaxStreams").val());
    var rate = parseInt($("#streamStressBatchRate").val());
    var fakeStreamPercents = parseInt($("#fakeRequests").val());
    var cdn = $("#useCDN").is(':checked');
    var init = 1;
    var streamTTL = parseInt($( "#streamTTL option:selected" ).val()) * 60 * 1000; // ms
    var REMOTE_NODE_POLL_INTERVAL = 5000;
    var rep = {
        name: "STREAM-PLAY",
        start: start,
        end: end,
        rate: rate,
        initialized: 0,
        terminated: 0,
        pending: 0
    };
    var schedule = function(fn, t) {
        setTimeout(fn, t);
    };
    var play = function(localName, remoteName){
        console.log("play " + localName + " -> " + remoteName + " ; pending streams " + pendingPlays.length);
        node.pull.pull(remote, localName, remoteName).then(function(){
            streams[localName] = {
                "remoteName": remoteName,
                "startTime": performance.now(),
                "endTime": 0
            }
        }, function(){
            console.log("Failed to play stream " + remoteName + " as " + localName);
        });
    };
    var stop = function(localName){
        node.pull.terminate(localName).then(function(){
        }, function(){
            console.log("Failed to stop stream " + localName);
        });
        delete streams[localName];
    };
    if (STRESS_TESTS.PLAY_STREAM.running) {
        for (var stream in streams) {
            if (streams.hasOwnProperty(stream)) {
                stop(stream);
            }
        }
        STRESS_TESTS.PLAY_STREAM.running = false;
        console.log("Stress streams stopped");
        $("#streamStressBatchModal").modal('hide');
        return;
    }

    var throttle = rateLimit(rate, 1000, play);
    var remoteStreams = [];
    var i = 0;
    var pollRemoteStreams = function() {
        if (cdn) {
            remoteNode.cdn.showRoutes().then(function(routes) {
                remoteStreams = Object.values(routes);
            }, function() {
                console.log("Failed to get routes");
            })
        }
        remoteNode.stream.findAll().then(function (streams) {
            var c;
            for (c = 0; c < streams.length; c++) {
                remoteStreams[c] = streams[c].name;
            }
        }, function(e) {
            console.log("Failed to get streams");
        });
        if (remoteStreams.length != 0 && !STRESS_TESTS.PLAY_STREAM.running) {
            STRESS_TESTS.PLAY_STREAM.running = true;
            prepareStreams();
        }
    };
    schedule(pollRemoteStreams, REMOTE_NODE_POLL_INTERVAL);
    var pendingPlays = [];
    var pendingStops = [];
    var prepareStreams = function() {
        //init
        var initialInit = i + init < i + rate * 2 ? i + rate * 2 : i + init;
        for (; i < initialInit; i++) {
            var remoteName = remoteStreams[Math.floor(Math.random() * remoteStreams.length)];
            var localName = remoteName + "-" + i;
            pendingPlays.push(localName);
            throttle(localName, remoteName);
        }
        pollState();
    };
    var pollState = function() {
        if (!STRESS_TESTS.PLAY_STREAM.running) {
            return;
        }
        node.pull.findAll().then(function (pullState) {
            var c;
            //update state
            var active = [];
            for (c = 0; c < pullState.length; c++) {
                active[c] = pullState[c].localStreamName;
                var pendingIndex = pendingPlays.indexOf(pullState[c].localStreamName);
                if (pendingIndex > -1) {
                    console.log("Remove stream from pending plays " + pullState[c].localStreamName);
                    pendingPlays.splice(pendingIndex, 1);
                    rep.initialized++;
                }
                var tIndex = pendingStops.indexOf(pullState[c].localStreamName);
                if (tIndex > -1) {
                    console.log("Remove stream from pending stops " + pullState[c].localStreamName);
                    pendingStops.splice(tIndex, 1);
                    rep.terminated++;
                }
            }
            for (c = 0; c < pendingStops.length; c++) {
                if (active.includes(pendingStops[c])) {
                    continue;
                }
                pendingStops.splice(pendingStops.indexOf(pendingStops[c]), 1);
                rep.terminated++;
            }
            //terminate
            var t = 0;
            for (c = 0; t <= rate && c < pullState.length; c++) {
                if (!pendingStops.includes(pullState[c].localStreamName)) {
                    if (streams.hasOwnProperty(pullState[c].localStreamName)) {
                        var nowTime = performance.now();
                        var startTime = streams[pullState[c].localStreamName]['startTime'];
                        if ((nowTime - startTime) >= streamTTL) {
                            console.log("Terminate stream " + pullState[c].localStreamName + " ; stream time " + (nowTime - startTime)/1000);
                            stop(pullState[c].localStreamName);
                            t++;
                            pendingStops.push(pullState[c].localStreamName);
                        }
                    }
                } else {
                    console.log("Skip termination of " + pullState[c].localStreamName + " ; stream time " + Math.round(performance.now - streams[pullState[c].localStreamName]['startTime']));
                }
            }
            console.log("Requested termination of " + t + " streams");
            for (c = 0; c <= rate && c <= t; c++) {
                if (Object.keys(streams).length >= end) {
                    continue;
                }

                i++;
                if (i >= end) {
                    i = start;
                }

                var remoteName = remoteStreams[Math.floor(Math.random() * remoteStreams.length)];
                var localName = remoteName + "-" + i;
                if (pendingPlays.includes(localName)) {
                    console.log("Skip stream of " + localName);
                    continue;
                }
                if (pendingStops.includes(localName)) {
                    console.log("Skip stream of " + localName);
                    continue;
                }
                pendingPlays.push(localName);
                play(localName, remoteName);

                if (Object.keys(streams).length % fakeStreamPercents === 0) {
                    remoteName = Math.random().toString(36).substring(2);
                    localName = remoteName + "-" + i;
                    console.log("Generate fake stream name " + remoteName);
                    play(localName, remoteName);
                }
            }
            rep.pending = pendingStops.length + pendingPlays.length;
            schedule(pollState, STRESS_TEST_INTERVAL);
        }, function(){
            schedule(pollState, STRESS_TEST_FAILED_INTERVAL);
        });
    };
    rep.terminate = function(id){
        STRESS_TESTS.PLAY_STREAM.running = false;
        node.tests.splice(id, 1);
    };
    node.tests.push(rep);

    pollRemoteStreams();
    console.log("Stress streams started");
    $("#streamStressBatchModal").modal('hide');
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


