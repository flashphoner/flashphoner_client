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

    describe('video resolution', function(){
        before(function(done){
            Flashphoner.init(initOptions);
            Flashphoner.createSession(sOptions).on("ESTABLISHED", function(){
                done();
            });
        });

        it('resize should fire after getMediaAccess', function(done){
            this.timeout(10000);
            var display = addDisplay(320,240);
            Flashphoner.getMediaAccess(null, display).then(function(){
                display.children[0].addEventListener('resize', function(event){
                    Flashphoner.releaseLocalMedia(display);
                    removeDisplay(display);
                    done();
                });
            });
        });
        it('resize should show requested resolution', function(done){
            this.timeout(10000);
            var display = addDisplay(320,240);
            Flashphoner.getMediaAccess({audio: true, video: {width: 640, height: 480}}, display).then(function(){
                display.children[0].addEventListener('resize', function(event){
                    expect(event.target.videoWidth).to.equal(640);
                    expect(event.target.videoHeight).to.equal(480);
                    Flashphoner.releaseLocalMedia(display);
                    removeDisplay(display);
                    done();
                });
            });
        });
        it('playing stream should fire resize event', function(done){
            this.timeout(20000);
            var display1 = addDisplay(320, 240);
            var display2 = addDisplay(320, 240);
            var session = Flashphoner.getSessions()[0];
            var stream = session.createStream({name: "test2", display: display1});
            stream.on(STREAM_STATUS.PUBLISHING, function(){
                var playStream = session.createStream({name: "test2", display: display2});
                playStream.on(STREAM_STATUS.PLAYING, function(){
                    document.getElementById(playStream.id()).addEventListener('resize', function(event){
                        playStream.stop();
                    });


                }).on(STREAM_STATUS.STOPPED, function(){
                    stream.stop();
                });
                playStream.play();
            }).on(STREAM_STATUS.UNPUBLISHED, function(){
                removeDisplay(display1);
                removeDisplay(display2);
                done();
            });
            stream.publish();
        });

        after(function(){
            Flashphoner.getSessions()[0].disconnect();
        });
    });

    describe('media controls', function(){
        before(function(done){
            Flashphoner.init(initOptions);
            Flashphoner.createSession(sOptions).on("ESTABLISHED", function(){
                done();
            });
        });

        it('local audio  should mute/unmute', function(done){
            this.timeout(10000);
            var display = addDisplay(320,240);
            var session = Flashphoner.getSessions()[0];
            var stream = session.createStream({name: "test2", display: display});
            stream.on(STREAM_STATUS.PUBLISHING, function(){
                expect(stream.isAudioMuted()).to.be.false;
                stream.muteAudio();
                expect(stream.isAudioMuted()).to.be.true;
                stream.unmuteAudio();
                expect(stream.isAudioMuted()).to.be.false;
                stream.stop();
            }).on(STREAM_STATUS.UNPUBLISHED, function(){
                removeDisplay(display);
                done();
            });
            stream.publish();
        });
        it('local video should mute/unmute', function(done){
            this.timeout(10000);
            var display = addDisplay(320,240);
            var session = Flashphoner.getSessions()[0];
            var stream = session.createStream({name: "test2", display: display});
            stream.on(STREAM_STATUS.PUBLISHING, function(){
                expect(stream.isVideoMuted()).to.be.false;
                stream.muteVideo();
                expect(stream.isVideoMuted()).to.be.true;
                stream.unmuteVideo();
                expect(stream.isVideoMuted()).to.be.false;
                stream.stop();
            }).on(STREAM_STATUS.UNPUBLISHED, function(){
                removeDisplay(display);
                done();
            });
            stream.publish();
        });

        it('playing stream volume control', function(done){
            this.timeout(20000);
            var display1 = addDisplay(320, 240);
            var display2 = addDisplay(320, 240);
            var session = Flashphoner.getSessions()[0];
            var stream = session.createStream({name: "test2", display: display1});
            stream.on(STREAM_STATUS.PUBLISHING, function(){
                var playStream = session.createStream({name: "test2", display: display2});
                playStream.on(STREAM_STATUS.PLAYING, function(){
                    playStream.setVolume(70);
                    expect(playStream.getVolume()).to.equal(70);
                    playStream.stop();
                }).on(STREAM_STATUS.STOPPED, function(){
                    stream.stop();
                });
                playStream.play();
            }).on(STREAM_STATUS.UNPUBLISHED, function(){
                removeDisplay(display1);
                removeDisplay(display2);
                done();
            });
            stream.publish();
        });

        after(function(){
            Flashphoner.getSessions()[0].disconnect();
        });
    });
});