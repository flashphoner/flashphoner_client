const SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
const STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
const STREAM_STATUS_INFO = Flashphoner.constants.STREAM_STATUS_INFO;
const Browser = Flashphoner.Browser;
const CANVAS_TYPE = {
    CANVAS_2D: "2d",
    CANVAS_WEBGL: "webgl"
};
let remoteVideo;
let canvas;
let mockVideo;
let currentSession;
let previewStream;
let publishStream;

//////////////////////////////////
/////////////// Init /////////////

const init_page = function() {
    //init api
    try {
        Flashphoner.init();
    } catch (e) {
        setText("notifyFlash", "Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    //local and remote displays
    localVideo = document.createElement("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    setValue("urlServer", setURL() + "/" + createUUID(4));
    onDisconnected();
}

const connect = function() {
    let url = getValue('urlServer');

    //create session
    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        currentSession = session;
        setStatus("connectStatus", session.status());
        startStreaming();
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus("connectStatus", SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus("connectStatus", SESSION_STATUS.FAILED);
        onDisconnected();
    });
}

const disconnect = function() {
    if (currentSession) {
        currentSession.disconnect();
    }
}

const onConnected = function() {
    enableItem('startBtn');
    setText('startBtn', "Stop");
    setHandler("startBtn", "click", stopBtnClick, startBtnClick);
}

const onDisconnected = function() {
    stopStreaming();
    toggleInputs(true);
    setText('startBtn', "Start");
    setHandler("startBtn", "click", startBtnClick, stopBtnClick);
}

const onPublishing = function(stream) {
    setText("publishInfo", "");
    publishStream = stream;
}

const onPlaying = function(stream) {
    setText("playInfo", "");
    previewStream = stream;
    onConnected();
}

const onStopped = function() {
    previewStream = null;
    remoteVideo.parentNode.style.display = "none";
    if (publishStream != null && publishStream.published()) {
        publishStream.stop();
    }
}

const onUnpublished = function() {
    publishStream = null;
    stopCanvasStream();
}

const startBtnClick = function() {
    if (validate()) {
        toggleInputs(false);
        setDisplaySize(remoteVideo, getValue("width"), getValue("height"));
        connect();
    }
}

const stopBtnClick = function() {
    disableItem('startBtn');
    if (previewStream != null) {
        previewStream.stop();
        previewStream = null;
    }
}

const setDisplaySize = function(display, width, height) {
    if (display) {
        display.style.width = width + "px";
        display.style.height = height + "px";
        display.style.display = "block";
    }
}

const startStreaming = function() {
    let session = currentSession;
    let streamName = getValue("urlServer").split('/')[3];
    let canvasStream = createCanvasStream();

    session.createStream({
        name: streamName,
        display: localVideo,
        constraints: {
            audio: false,
            video: false,
            customStream: canvasStream
        }
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        setStatus("publishStatus", STREAM_STATUS.PUBLISHING);
        playStream();
        onPublishing(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function () {
        setStatus("publishStatus", STREAM_STATUS.UNPUBLISHED);
        onUnpublished();
        disconnect();
    }).on(STREAM_STATUS.FAILED, function () {
        setStatus("publishStatus", STREAM_STATUS.FAILED);
        onUnpublished();
        disconnect();
    }).publish();
}

const playStream = function() {
    let session = currentSession;
    let streamName = getValue("urlServer").split('/')[3];
    let width = getValue("width");
    let height = getValue("height");

    setDisplaySize(remoteVideo.parentNode, width, height);

    session.createStream({
        name: streamName,
        display: remoteVideo,
        constraints: {
            audio: !Browser.isiOS(),
            video: true
        }
    }).on(STREAM_STATUS.PENDING, function (stream) {
        let video = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            video.addEventListener('resize', function (event) {
                resizeVideo(event.target);
            });
        }
    }).on(STREAM_STATUS.PLAYING, function (stream) {
        setStatus("playStatus", stream.status());
        onPlaying(stream);
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus("playStatus", STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function (stream) {
        setStatus("playStatus", STREAM_STATUS.FAILED, stream);
        onStopped();
        disconnect();
    }).play();
}

const stopStreaming = function() {
    onStopped();
    onUnpublished();
}

//show connection, or local, or remote stream status
const setStatus = function(id, status, stream) {
    setText(id, status);
    setAttribute(id, "class", "");
    if (status === "PLAYING" || status === "ESTABLISHED" || status === "PUBLISHING") {
        setAttribute(id, "class", "text-success");
    } else if (status === "DISCONNECTED" || status === "UNPUBLISHED" || status === "STOPPED") {
        setAttribute(id, "class", "text-muted");
    } else if (status === "FAILED") {
        if (stream && stream.getInfo()) {
            if (stream.published()) {
                setText("publishInfo", stream.getInfo());
                setAttribute("publishInfo", "class", "text-muted");
            } else {
                setText("playInfo", stream.getInfo);
                setAttribute("playInfo", "class", "text-muted");
            }
        }
        setAttribute(id, "class", "text-danger");
    }
}

const validate = function() {
    if (!getCheckbox("sendVideo") && !getCheckbox("sendAudio")) {
        highlightInput("sendVideo");
        highlightInput("sendAudio");
        return false;
    } else {
        removeHighlight("sendVideo");
        removeHighlight("sendAudio");
    }
    return validateInput("urlServer") && validateInput("width") && validateInput("height");
}

const validateInput = function(id) {
    let value = getValue(id);
    let valid = true;
    if (!value || !value.length) {
        highlightInput(id);
        valid = false;
    } else {
        removeHighlight(id);
    }
    return valid;
}

const highlightInput = function(input) {
    let item = document.getElementById(input);
    if (item) {
        let parent = closest(input,'.form-group');
        if (parent) {
            parent.classList.add("has-error");
        }
    }
}

const removeHighlight = function(input) {
    let item = document.getElementById(input);
    if (item) {
        let parent = closest(input,'.form-group');
        if (parent) {
            parent.classList.remove("has-error");
        }
    }
}

const toggleInputs = function(enable) {
    if (enable) {
        enableItem('urlServer');
        enableItem('startBtn');
        enableItem('width');
        enableItem('height');
        enableItem('mirror');
        enableItem('useWebGl');
        enableItem('useAnimFrame');
        enableItem('sendAudio');
        enableItem('sendVideo');
    } else {
        disableItem('urlServer');
        disableItem('startBtn');
        disableItem('width');
        disableItem('height');
        disableItem('useWebGl');
        disableItem('mirror');
        disableItem('useAnimFrame');
        disableItem('sendAudio');
        disableItem('sendVideo');
    }
}

const createCanvasStream = function() {
    let type = getCheckbox("webGl") ? CANVAS_TYPE.CANVAS_WEBGL : CANVAS_TYPE.CANVAS_2D;
    let width = getValue("width");
    let height = getValue("height");
    let constraints = {};
    canvas = Canvas("canvasContainer", width, height, type,
        getCheckbox("mirror"), getCheckbox("useAnimFrame"));
    mockVideo = Video(canvas);
    if (!getCheckbox("sendVideo")) {
        constraints.video = false;
    } else {
        constraints.video = {
            width: width,
            height: height
        };
    }
    constraints.audio = getCheckbox("sendAudio");
    mockVideo.start(constraints);
    return canvas.canvasStream();
}

const stopCanvasStream = function() {
    if (mockVideo) {
        mockVideo.stop();
    }
    if (canvas) {
        canvas.close();
    }
}

const Canvas = function(parentId, width, height, type, mirror, useRequestAnimationFrame) {
    const canvasObject = {
        canvas: null,
        useRequestAnimationFrame: false,
        context: null,
        stream: null,
        init: function(parentId, width, height, type, mirror, useRequestAnimationFrame) {
            let parent = document.getElementById(parentId);
            if (parent) {
                canvasObject.canvas = document.createElement("canvas");
                canvasObject.canvas.width = width;
                canvasObject.canvas.height = height;
                parent.appendChild(canvasObject.canvas);
                setDisplaySize(parent, width, height);
                canvasObject.mirror = mirror;
                canvasObject.useRequestAnimationFrame = useRequestAnimationFrame;
                if (type === CANVAS_TYPE.CANVAS_2D) {
                    canvasObject.context = Canvas2d(canvasObject.canvas, mirror);
                } else if (type === CANVAS_TYPE.CANVAS_WEBGL) {
                    canvasObject.context = CanvasWebGl(canvasObject.canvas, mirror);
                }
                stream = canvasObject.canvas.captureStream(30);
            }
        },
        close: function() {
            if (canvasObject.canvas) {
                canvasObject.canvas.parentNode.style.display = "none";
                canvasObject.canvas.remove();
                canvasObject.canvas = null;
                canvasObject.stream = null;
            }
            canvasObject.useRequestAnimationFrame = false;
            canvasObject.context = null;
        },
        drawFrame: function(source) {
            if (source && canvasObject.context) {
                canvasObject.context.drawFrame(source);
            }
        },
        loop: function(video) {
            if (!video.paused && !video.ended) {
                canvasObject.drawFrame(video);
                if (canvasObject.useRequestAnimationFrame) {
                    requestAnimationFrame(() => {
                        canvasObject.loop(video);
                    });
                } else {
                    setTimeout(() => {
                        canvasObject.loop(video);
                    }, 1000 / 30); // drawing at 30fps
                }
            }
        },
        canvasStream: function() {
            return stream;
        }
    };
    canvasObject.init(parentId, width, height, type, mirror, useRequestAnimationFrame);
    return canvasObject;
}

const Canvas2d = function(canvas, mirror) {
    const canvas2d = {
        canvas: null,
        api: null,
        init: function(canvas, mirror) {
            if (canvas) {
                canvas2d.canvas = canvas;
                let context = canvas2d.canvas.getContext(CANVAS_TYPE.CANVAS_2D);
                if (mirror) {
                    context.translate(canvas2d.canvas.width, 0);
                    context.scale(-1, 1);
                    context.save();
                }
                canvas2d.api = {
                    context: context
                }
            }
        },
        close: function() {
            canvas2d.canvas = null;
            canvas2d.api = null;
        },
        drawFrame: function(source) {
            if (source && canvas2d.api && canvas2d.api.context) {
                canvas2d.api.context.drawImage(source, 0, 0);
            }
        }
    };
    canvas2d.init(canvas, mirror);
    return canvas2d;
}

const CanvasWebGl = function(canvas, mirror) {
    const canvasWebGl = {
        canvas: null,
        api: null,
        init: function(canvas, mirror) {
            if (canvas) {
                canvasWebGl.canvas = canvas;
                let context = canvasWebGl.canvas.getContext(CANVAS_TYPE.CANVAS_WEBGL);
                let vertexShaderSource = `
              attribute vec2 a_position;
              attribute vec2 a_texCoord;
              varying vec2 v_texCoord;
              void main() {
                gl_Position = vec4(a_position, 0, 1);
                v_texCoord = vec2(a_texCoord.x, a_texCoord.y);
              }
            `;
                if (mirror) {
                    vertexShaderSource = `
                  attribute vec2 a_position;
                  attribute vec2 a_texCoord;
                  varying vec2 v_texCoord;
                  void main() {
                    gl_Position = vec4(a_position, 0, 1);
                    v_texCoord = vec2(1.0 - a_texCoord.x, a_texCoord.y); // X axis mirroring
                  }
                `;
                }

                const fragmentShaderSource = `
              precision mediump float;
              varying vec2 v_texCoord;
              uniform sampler2D u_texture;
              void main() {
                gl_FragColor = texture2D(u_texture, v_texCoord);
              }
            `;

                function createShader(context, type, source) {
                    const shader = context.createShader(type);
                    context.shaderSource(shader, source);
                    context.compileShader(shader);
                    return shader;
                }

                function createProgram(context, vertex, fragment) {
                    const program = context.createProgram();
                    context.attachShader(program, vertex);
                    context.attachShader(program, fragment);
                    context.linkProgram(program);
                    return program;
                }

                const vertexShader = createShader(context, context.VERTEX_SHADER, vertexShaderSource);
                const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentShaderSource);
                const program = createProgram(context, vertexShader, fragmentShader);

                const positionBuffer = context.createBuffer();
                context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
                context.bufferData(context.ARRAY_BUFFER, new Float32Array([
                    -1, -1, 1, -1, -1, 1,
                    -1, 1, 1, -1, 1, 1
                ]), context.STATIC_DRAW);

                const texCoordBuffer = context.createBuffer();
                context.bindBuffer(context.ARRAY_BUFFER, texCoordBuffer);
                context.bufferData(context.ARRAY_BUFFER, new Float32Array([
                    0, 0, 1, 0, 0, 1,
                    0, 1, 1, 0, 1, 1
                ]), gl.STATIC_DRAW);

                const texture = context.createTexture();
                context.bindTexture(context.TEXTURE_2D, texture);
                context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
                context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
                context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
                context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);

                const posLoc = context.getAttribLocation(program, "a_position");
                const texLoc = context.getAttribLocation(program, "a_texCoord");
                const uTexLoc = context.getUniformLocation(program, "u_texture");

                canvasWebGl.api = {
                    context: context,
                    program: program,
                    positionBuffer: positionBuffer,
                    posLoc: posLoc,
                    texCoordBuffer: texCoordBuffer,
                    texLoc: texLoc,
                    texture: texture,
                    uTexLoc: uTexLoc
                };
            }
        },
        close: function() {
            canvasWebGl.canvas = null;
            canvasWebGl.api = null;
        },
        drawFrame: function(source) {
            if (source && canvasWebGl.api && canvasWebGl.api.context) {
                let context = canvasWebGl.api.context;
                context.viewport(0, 0, canvasWebGl.canvas.width, canvasWebGl.canvas.height);
                context.clear(context.COLOR_BUFFER_BIT);

                context.useProgram(canvasWebGl.api.program);

                // Position
                context.bindBuffer(context.ARRAY_BUFFER, canvasWebGl.api.positionBuffer);
                context.enableVertexAttribArray(canvasWebGl.api.posLoc);
                context.vertexAttribPointer(canvasWebGl.api.posLoc, 2, context.FLOAT, false, 0, 0);

                // Texture coordinates
                context.bindBuffer(context.ARRAY_BUFFER, canvasWebGl.api.texCoordBuffer);
                context.enableVertexAttribArray(canvasWebGl.api.texLoc);
                context.vertexAttribPointer(canvasWebGl.api.texLoc, 2, context.FLOAT, false, 0, 0);

                // Renew texture from source
                context.bindTexture(context.TEXTURE_2D, canvasWebGl.api.texture);
                context.texImage2D(
                    context.TEXTURE_2D, 0, context.RGBA, context.RGBA,
                    context.UNSIGNED_BYTE, source
                );
                context.uniform1i(canvasWebGl.api.uTexLoc, 0);

                context.drawArrays(context.TRIANGLES, 0, 6);
            }
        }
    };
    canvasWebGl.init(canvas, mirror);
    return canvasWebGl;
}


const Video = function(canvas) {
    const videoObject = {
        canvas: null,
        video: null,
        init: function(canvas) {
            videoObject.canvas = canvas;
            videoObject.video = document.createElement("video");
            videoObject.video.setAttribute("playsinline", "");
            videoObject.video.setAttribute("webkit-playsinline", "");
            videoObject.video.muted = true;
            videoObject.video.addEventListener("play", () => {
                videoObject.canvas.loop(videoObject.video);
            }, 0);
        },
        start: function(constraints) {
            let hasVideo = false;
            let hasAudio = false;
            let canvasStream = videoObject.canvas.canvasStream();
            if (constraints.video) {
                hasVideo = true;
            }
            if (constraints.audio) {
                hasAudio = true;
            }
            navigator.mediaDevices.getUserMedia(constraints)
                .then((stream) => {
                    videoObject.video.srcObject = stream;
                    videoObject.video.onloadedmetadata = () => {
                        if (!hasVideo) {
                            canvasStream.removeTrack(canvasStream.getVideoTracks()[0]);
                        }
                        if (hasAudio) {
                            videoObject.video.muted = false;
                            try {
                                let audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                let source = audioContext.createMediaElementSource(videoObject.video);
                                let destination = audioContext.createMediaStreamDestination();
                                source.connect(destination);
                                canvasStream.addTrack(destination.stream.getAudioTracks()[0]);
                            } catch (e) {
                                console.warn("Failed to create audio context");
                            }
                        }
                    };
                    videoObject.video.play();
                });
        },
        stop: function() {
            if (videoObject.video) {
                videoObject.video.pause();
                videoObject.video.removeEventListener('play', null);
                let tracks = videoObject.video.srcObject.getTracks();
                for (let i = 0; i < tracks.length; i++) {
                    tracks[i].stop();
                }
                videoObject.video.srcObject = null;
                videoObject.video = null;
                videoObject.canvas = null;
            }
        }
    };
    videoObject.init(canvas);
    return videoObject;
}
