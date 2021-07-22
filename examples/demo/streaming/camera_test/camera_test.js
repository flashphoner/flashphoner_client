var resolutions = [
    {
        standard : "QQVGA",
        width : 160,
        height : 120
    },
    {
        standard : "HQVGA",
        width : 240,
        height : 160
    },
    {
        standard : "CGA",
        width : 320,
        height : 200
    },
    {
        standard : "QVGA",
        width : 320,
        height : 240
    },
    {
        standard : "VGA",
        width : 640,
        height : 480
    },
    {
        standard : "WVGA",
        width : 720,
        height : 480
    },
    {
        standard : "SVGA",
        width : 800,
        height : 600
    },
    {
        standard : "XGA",
        width : 1024,
        height : 768
    },
    {
        standard : "WXGA",
        width : 1280,
        height : 720
    },
    {
        standard : "HD+",
        width : 1600,
        height : 900
    },
    {
        standard : "UXGA",
        width : 1600,
        height : 1200
    },
    {
        standard : "FHD",
        width : 1920,
        height : 1080
    },
    {
        standard : "WQHD",
        width : 2560,
        height : 1440
    }
];
function init_page() {

    try {
        Flashphoner.init();
    } catch (e) {
        console.warn(e);
    }

    Flashphoner.getMediaDevices(null, true).then(function (list) {
        list.video.forEach(function (device) {
            console.log(device);
            var video = document.getElementById("videoInput");
            var i;
            var deviceInList = false;
            for (i = 0; i < video.options.length; i++) {
                if (video.options[i].value == device.id) {
                    deviceInList = true;
                    break;
                }
            }
            if (!deviceInList) {
                var option = document.createElement("option");
                option.text = device.label || device.id;
                option.value = device.id;
                video.appendChild(option);
            }
        });
    }).catch(function (error) {
        console.warn(error);
    });
    $("#startBtn").click(function () {
        startTest();
    })
}

var i = resolutions.length-1;


function startTest() {
    var resolutionDiv = document.getElementById("resolution");

    $("#videoInput").prop('disabled',true);
    $("#startBtn").prop('disabled',true);
    
    if (i < 0) {
        resolutionDiv.innerHTML += "<br />Test complete";
        $("#videoInput").prop('disabled',false);
        $("#startBtn").prop('disabled',false);
        i = resolutions.length-1;
        return false;
    } else if (i == resolutions.length-1) {
        resolutionDiv.innerHTML = "Start test <br/><br/>";
    }
    var display = document.getElementById("display");
    display.style.width = resolutions[i].width+"px";
    display.style.height = resolutions[i].height+"px";
    resolutionDiv.innerHTML += resolutions[i].standard + " " + resolutions[i].width + "x" + resolutions[i].height;

    if (Flashphoner.Browser.isSafariWebRTC()) {
        Flashphoner.playFirstVideo(display, true);
    }

    var constraints = {
        video: {
            deviceId: $('#videoInput').val(),
            width: {exact: resolutions[i].width},
            height: {exact: resolutions[i].height}
        }
    };

    setTimeout(function () {
        Flashphoner.getMediaAccess(constraints, display).then(function (disp) {
            setTimeout(function () {
                var displayRes = disp.childNodes[0].videoWidth + "x" + disp.childNodes[0].videoHeight;
                var testedRes = resolutions[i].width + "x" + resolutions[i].height;
                if (testedRes == displayRes) {
                    console.log("Test passed. " + displayRes + " == " + testedRes);
                    resolutionDiv.innerHTML += "<span style='color: green'> passed </span>" + "<br />";
                } else {
                    console.warn("Test failed. " + displayRes + " != " + testedRes);
                    resolutionDiv.innerHTML += "<span style='color: red'> failed </span>" + "<br />";
                }
                Flashphoner.releaseLocalMedia(display);
                i--;
                startTest();
            }, 3000);

        }).catch(function (error) {
            console.warn(error);
            resolutionDiv.innerHTML += "<span style='color: red'> failed </span>" + "<br />";
            setTimeout(function () {
                Flashphoner.releaseLocalMedia(display);
                i--;
                startTest();
            }, 1000);
        });
    },1000);

}
