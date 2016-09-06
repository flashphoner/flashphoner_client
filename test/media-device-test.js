describe('MediaDevices', function(){
    before(function(){
        Flashphoner.init(initOptions);
    });

    it('getMediaDevices should return device list', function(done) {
        Flashphoner.getMediaDevices().then(function(list){
            expect(list).to.be.an("object");
            done();
        });
    });

    it('getMediaDevices should return device list with labels', function(done) {
        this.timeout(10000);
        Flashphoner.getMediaDevices(null, true).then(function(list){
            expect(list).to.be.an("object");
            expect(list.audio[0]).to.have.property("label");
            done();
        }, done);
    });

    it('getMediaAccess should return and release media', function(done) {
        this.timeout(20000);
        var constraints = {
            audio: true,
            video: {
                width: 320,
                height: 240,
                frameRate: 30
            }
        };
        var display = addDisplay();
        Flashphoner.getMediaAccess(constraints, display).then(function(display){
            setTimeout(function(){
                expect(Flashphoner.releaseLocalMedia(display)).to.be.true;
                removeDisplay(display);
                done();
            }, 2000);
        }, done);
    });

    it('getMediaAccess should return media specified by deviceId', function(done){
        this.timeout(20000);
        Flashphoner.getMediaDevices().then(function(list){
            var constraints = {
                audio: {
                    deviceId: list.audio[0].id
                },
                video: {
                    width: 320,
                    height: 240,
                    deviceId: list.video[0].id
                }
            };
            var display = addDisplay();
            return Flashphoner.getMediaAccess(constraints, display);
        }).then(function(display){
            setTimeout(function(){
                Flashphoner.releaseLocalMedia(display);
                removeDisplay(display);
                done();
            }, 2000);
        }).catch(done);
    });

    it('getMediaAccess should work with cached instance in case of Flash provider', function(done){
        this.timeout(30000);
        var mediaProvider = "Flash";
        if (Flashphoner.getMediaProviders().indexOf(mediaProvider) != -1) {
            var display = addDisplay();
            Flashphoner.getMediaDevices(mediaProvider).then(function(list){
                var constraints = {
                    audio: {
                        deviceId: list.audio[0].id
                    },
                    video: {
                        width: 320,
                        height: 240,
                        deviceId: list.video[0].id
                    }
                };
                Flashphoner.getMediaAccess(constraints, display, mediaProvider).then(function(display){
                    setTimeout(function(){
                        constraints.audio.deviceId = list.audio[1].id;
                        constraints.video.deviceId = list.video[1].id;
                        Flashphoner.getMediaAccess(constraints, display, mediaProvider).then(function(display){
                            setTimeout(function(){
                                Flashphoner.releaseLocalMedia(display, mediaProvider);
                                removeDisplay(display);
                                done();
                            }, 2000);
                        });
                    }, 2000);
                })
            })
        } else {
            done(new Error("No Flash"));
        }
    });

    it('getMediaAccess should support screen sharing with WebRTC', function(done){
        this.timeout(30000);
        if (Flashphoner.getMediaProviders()[0] !== "WebRTC") {
            throw new Error("No WebRTC");
        }
        var display = addDisplay(640,480);
        var constraints = {
            video: {
                width: 640,
                height: 480,
                frameRate: 10,
                type: "screen"
            }
        };
        Flashphoner.getMediaAccess(constraints, display).then(function(){
            setTimeout(function(){
                Flashphoner.releaseLocalMedia(display);
                removeDisplay(display);
                done();
            }, 4000);
        }, done);
    });
});