describe('Room api', function() {
    var roomApi;
    before(function () {
        Flashphoner.init({
            flashMediaProviderSwfLocation: "../media-provider.swf",
            screenSharingExtensionId: "nlbaajplpmleofphigmgaifhoikjmbkg"
        });
        roomApi = Flashphoner.roomModule;
    });

    it('join room', function(done) {
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("CONNECTED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("JOINED", function(participant){
                console.log("Participant joined with name " + participant.name);
                api.getRooms()[0].leave();
                api.disconnect();
            }).on("STATE", function(participants){
                //create second connection
                roomApi.connect(
                    {
                        urlServer: "ws://192.168.88.234:8080",
                        username: "test2"
                    }
                ).on("CONNECTED", function(api){
                    //join room
                    api.join({name: "my_test_room"}).on("LEFT", function(participant){
                        console.log("Participant left with name " + participant.name);
                        api.disconnect();
                        done();
                    });
                }).on("STATE", function(participants){
                    console.dir(participants);
                });
            });
        });
    });

    it("join and publish", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("CONNECTED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(participants){
                var display = document.createElement("div");
                display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
                document.body.appendChild(display);
                api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                    setTimeout(function(){
                        stream.stop();
                        api.disconnect();
                        document.body.removeChild(display);
                        done();
                    }, 3000);
                });
            });
        });
    });

    it("subscribe to already published stream", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("CONNECTED", function(api){
            var display = document.createElement("div");
            display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
            document.body.appendChild(display);
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(participants){
                api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                    //create second connection and subscribe
                    roomApi.connect(
                        {
                            urlServer: "ws://192.168.88.234:8080",
                            username: "test2"
                        }
                    ).on("CONNECTED", function(api){
                        //join room
                        api.join({name: "my_test_room"}).on("STATE", function(participants){
                            console.log("Joined room with state " + participants);
                            var display = document.createElement("div");
                            display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
                            document.body.appendChild(display);
                            participants["test"].subscribe(display).on("PLAYING", function(stream){
                                setTimeout(function(){
                                    stream.stop();
                                    document.body.removeChild(display);
                                    api.disconnect();
                                }, 3000);
                            });
                        });
                    });
                });
            }).on("LEFT", function(){
                api.disconnect();
                document.body.removeChild(display);
                done();
            });
        });
    });

    it("subscribe to newly published stream", function(done){
        this.timeout(20000);
        roomApi.connect(
            {
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("CONNECTED", function(api){
            var display = document.createElement("div");
            display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
            document.body.appendChild(display);
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(participants){
                //create second connection and publish
                roomApi.connect(
                    {
                        urlServer: "ws://192.168.88.234:8080",
                        username: "test2"
                    }
                ).on("CONNECTED", function(api){
                    //join room
                    api.join({name: "my_test_room"}).on("STATE", function(participants){
                        var display = document.createElement("div");
                        display.setAttribute("style","width:320px; height:240px; border: solid; border-width: 1px");
                        document.body.appendChild(display);
                        api.getRooms()[0].publish(display).on("PUBLISHING", function(stream){
                            setTimeout(function(){
                                stream.stop();
                                document.body.removeChild(display);
                                api.disconnect();
                            }, 3000);
                        });
                    });
                });
            }).on("PUBLISHED", function(participant){
                console.log("Stream published, subscribe");
                participant.subscribe(display).on("FAILED", function(stream){
                    document.body.removeChild(display);
                    api.disconnect();
                    done();
                });
            });
        });
    });

    it("send message", function(done){
        this.timeout(20000);
        var MESSAGE_TEXT = "MY MESSAGE TEXT";
        roomApi.connect(
            {
                urlServer: "ws://192.168.88.234:8080",
                username: "test"
            }
        ).on("CONNECTED", function(api){
            //join room
            api.join({name: "my_test_room"}).on("STATE", function(participants){
                //create second connection
                roomApi.connect(
                    {
                        urlServer: "ws://192.168.88.234:8080",
                        username: "test2"
                    }
                ).on("CONNECTED", function(api){
                    //join room
                    api.join({name: "my_test_room"}).on("STATE", function(participants){
                        console.log("Joined room with state " + participants);
                        participants["test"].sendMessage(MESSAGE_TEXT);
                    }).on("LEFT", function(){
                        api.disconnect();
                        done();
                    })
                });
            }).on("MESSAGE", function(message){
                expect(message.text).to.equal(MESSAGE_TEXT);
                api.disconnect();
            });
        });
    });
});