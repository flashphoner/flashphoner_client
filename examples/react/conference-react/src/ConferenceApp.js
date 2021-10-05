import React, { Component } from 'react';
import update from 'immutability-helper';
import ScrollableFeed from 'react-scrollable-feed';
import './ConferenceApp.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as Flashphoner from '@flashphoner/websdk/src/flashphoner-core.js';
import * as RoomApi from '@flashphoner/websdk/src/room-module.js';
import * as FPUtils from './fp-utils.js';

const SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
const STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
const ROOM_EVENT = RoomApi.events;
const Browser = Flashphoner.Browser;
const PRELOADER_URL = process.env.PUBLIC_URL + '/media/preloader.mp4';
const maxParticipants = 3;

// Div element to display participant
class ParticipantDiv extends Component {
  componentDidMount() {
    this.props.playParticipantStream(this.props.roomParticipant);
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.props.name !== nextProps.name) {  
      return true;  
    }  
    return false;  
  }

  render() {
    return (
      <div className="col-sm-6">
        <div className="fp-remoteVideo">
          <div id={'remoteVideo-' + this.props.name} className="display"></div>
        </div>
        <div className="text-center text-muted">{this.props.name}</div>
      </div>
    )

  }
}

// Div element to display and handle room record checkbox
class RecordDiv extends Component {
  render() {
    if (this.props.recordDisplay) {
      return (
        <div className="col-sm-2 form-check">
          <input type="checkbox"
           id="recordCheckBox"
           className="form-check-input"
           checked={this.props.record}
           onChange={this.props.onChange}
          />
          <label className="form-check-label" htmlFor="recordCheckBox">Record</label>
        </div>
      );
    } else {
      return "";
    }
  }
}

// Conference React Application
class ConferenceApp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      apiFailed: '',
      session: null,
      sessionStatus: '',
      sessionStatusClass: 'text-muted',
      sessionFailedInfo: '',
      publishStream: null,
      publishStatus: '',
      publishStatusClass: 'text-muted',
      joinButtonText: 'Join',
      joinButtonDisabled: false,
      serverUrl: 'wss://demo.flashphoner.com:8443',
      serverUrlDisabled: false,
      login: 'user1',
      loginDisabled: false,
      publishButtonText: 'Publish',
      publishButtonDisabled: true,
      sendButtonText: 'Send',
      sendButtonDisabled: true,
      muteAudioButtonText: 'Mute A',
      muteAudioButtonDisabled: true,
      muteVideoButtonText: 'Mute V',
      muteVideoButtonDisabled: true,
      inviteUrl: 'Not connected',
      record: false,
      recordDisplay: false,
      room: null,
      participants: [],
      chat: [],
      message: '',
    };
  }

  componentDidMount() {
    let recordDisplay = true;
    // Hide record checkbox if invite URL is used
    if (window.location.href.includes('?')) {
      recordDisplay = false;
    }
    this.setState({recordDisplay: recordDisplay});
    try {
      Flashphoner.init({});
    }
    catch(e) {
      console.log(e);
      this.setState({
        apiFailed: 'Your browser does not support WebRTC technology needed for this example',
        joinButtonDisabled: true,
        serverUrlDisabled: true,
        loginDisabled: true
      });
    }
  }

  onJoined = (room) => {
    this.setState({
      room: room,
      joinButtonText: 'Leave',
      joinButtonDisabled: false,
      serverUrlDisabled: true,
      loginDisabled: true,
      sendButtonDisabled: false,
      sessionFailedInfo: ''
    });
  }

  onLeft = () => {
    this.setState({
      joinButtonText: 'Join',
      joinButtonDisabled: false,
      serverUrlDisabled: false,
      loginDisabled: false,
      publishButtonText: 'Publish',
      publishButtonDisabled: true,
      sendButtonDisabled: true,
      muteAudioButtonText: 'Mute A',
      muteAudioButtonDisabled: true,
      muteVideoButtonText: 'Mute V',
      muteVideoButtonDisabled: true,
      inviteUrl: 'Not connected',
      room: null,
      participants: [],
      chat: [],
      message: ''
    });
  }

  onDisconnected = () => {
    this.setState({session: null}, this.onLeft());
  }

  createConnection = (url, username) => {
    let app = this;
    let session = this.state.session;

    if (session && session.status() === SESSION_STATUS.ESTABLISHED) {
      if (session.getServerUrl() !== url || session.username() !== username) {
        session.on(SESSION_STATUS.DISCONNECTED, () => {app.setState({session: null}, app.createConnection(url, username));});
        session.on(SESSION_STATUS.FAILED, () => {});
        session.disconnect();
      } else {
        app.joinRoom(session);
      }
    } else {
      console.log("Create new RoomApi session with url " + url + ", login " + username);
      app.setState({joinButtonDisabled: true, serverUrlDisabled: true});
      RoomApi.connect({urlServer: url, username: username}).on(SESSION_STATUS.ESTABLISHED, (session) => {
        app.setState({session: session, sessionStatus: SESSION_STATUS.ESTABLISHED, sessionStatusClass: 'text-success'});
        app.joinRoom(session);
      }).on(SESSION_STATUS.DISCONNECTED, () => {
        app.setState({sessionStatus: SESSION_STATUS.DISCONNECTED, sessionStatusClass: 'text-success'});
        app.onDisconnected();
      }).on(SESSION_STATUS.FAILED, () => {
        app.setState({sessionStatus: SESSION_STATUS.FAILED, sessionStatusClass: 'text-danger'});
        app.onDisconnected();
      });
    }
  }

  joinRoom = (session) => {
    let app = this;
    let roomName = this.getRoomName();
    let record = this.state.record;

    console.log("Join the room " + roomName + ", record " + record);
    session.join({name: roomName, record: record}).on(ROOM_EVENT.STATE, (room) => {
      let roomParticipants = room.getParticipants();
      let participantsNumber = roomParticipants.length;
      console.log("Current number of participants in the room: " + participantsNumber);
      if (roomParticipants.length >= maxParticipants) {
          console.warn("Current room is full");
          app.setState({sessionFailedInfo: "Current room is full"});
          room.leave().then(() => {app.onLeft();}, () => {app.onLeft();});
          return false;
      }
      app.setInviteUrl(roomName);
      if (participantsNumber > 0) {
        let chatState = "participants: ";
        for (let i = 0; i < participantsNumber; i++) {
            app.installParticipant(roomParticipants[i]);
            chatState += roomParticipants[i].name();
            if (i < participantsNumber - 1) {
                chatState += ",";
            }
        }
        app.addMessage("chat", chatState);
      } else {
        app.addMessage("chat", " room is empty");
      }
      if (Browser.isSafariWebRTC()) {
        Flashphoner.playFirstVideo(document.getElementById("localDisplay"), true, PRELOADER_URL).then(() => {
            app.publishLocalMedia(room);
            app.onJoined(room);
        });
        return;
      }
      app.publishLocalMedia(room);
      app.onJoined(room);      
    }).on(ROOM_EVENT.JOINED, (participant) => {
      app.installParticipant(participant);
      app.addMessage(participant.name(), "joined");
    }).on(ROOM_EVENT.LEFT, function(participant) {
      app.removeParticipant(participant);
      app.addMessage(participant.name(), "left");
    }).on(ROOM_EVENT.PUBLISHED, (participant) => {
      app.playParticipantsStream(participant);
    }).on(ROOM_EVENT.FAILED, (room, info) => {
      session.disconnect();
      app.setState({sessionFailedInfo: info});
    }).on(ROOM_EVENT.MESSAGE, (message) => {
      if (message.from && message.text) {
        app.addMessage(message.from.name(), decodeURIComponent(message.text));
      }
    });
  }

  addMessage = (login, message) => {
    let date = new Date();
    let time = date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes();
    let newMessage = time + " " + login + " - " + message;
    this.setState({ chat: [ ...this.state.chat, newMessage ]});
  }
  
  installParticipant = (roomParticipant) => {
    let name = roomParticipant.name();

    if (this.state.participants.length >= maxParticipants) {
      console.warn("More than " + maxParticipants + " participants, ignore participant " + name);
    } else {
      console.log("Add participant " + name);
      this.setState({participants: [ ...this.state.participants, {
        'name': name,
        'roomParticipant': roomParticipant,
        'stream': null
      }]});
    }
  }

  removeParticipant = (roomParticipant) => {
    let participants = this.state.participants;
    let name = roomParticipant.name();
    for (let i = 0; i < participants.length; i++) {
      if (participants[i].roomParticipant.name() === name) {
        console.log("Remove participant " + name);
        this.stopParticipantStream(participants[i].stream);
        this.setState(update(this.state, {
          participants: {
            $splice: [[i, 1]]
          }
        }));
        break;
      }
    }
  }

  setParticipantStream = (name, stream) => {
    let participants = this.state.participants;

    for (let i = 0; i < participants.length; i++) {
      if (participants[i].roomParticipant.name() === name) {
        console.log("Set participant " + name + " stream to " + (stream ? stream.name() : null));
        this.setState(update(this.state, {
          participants: {
            [i]: {
              stream: { $set: stream }
            }
          }
        }));
        break;
      }
    }
  }

  stopParticipantStream = (stream) => {
    if (stream && FPUtils.isPlaying(stream.status())) {
      console.log("Stopping stream " + stream.name());
      stream.stop();
    }
  }

  playStream = (stream, remoteVideo, name) => {
    let app = this;
    let participantStream = null;

    participantStream = stream.play(remoteVideo).on(STREAM_STATUS.PLAYING, (playingStream) => {
      let video = document.getElementById(playingStream.id());
      if (video) {
        video.addEventListener('resize', (event) => {
          FPUtils.resizeVideo(event.target);
        });
      }
    });
    app.setParticipantStream(name, participantStream);
  }

  playParticipantsStream = (roomParticipant) => {
    let app = this;
    let remoteVideo = null;
    let stream = null;
    let name = roomParticipant.name();

    if (roomParticipant.getStreams().length > 0) {
      stream = roomParticipant.getStreams()[0];
      remoteVideo = document.getElementById("remoteVideo-" + name);
      if (stream && remoteVideo) {
        if (Browser.isSafariWebRTC()) {
          Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL).then(() => {
            app.playStream(stream, remoteVideo, name);
          });
          return;
        }
        app.playStream(stream, remoteVideo, name);
      }
    }
  }

  onMediaPublished = (stream) => {
    this.setState({
      publishStream: stream,
      publishButtonText: 'Stop',
      publishButtonDisabled: false,
      muteAudioButtonText: 'Mute A',
      muteAudioButtonDisabled: false,
      muteVideoButtonText: 'Mute V',
      muteVideoButtonDisabled: false
    });
  }

  onMediaStopped = () => {
    let session = this.state.session;
    let disablePublish = false;

    if (!session || session.getRooms().length === 0) {
      disablePublish = true;
    }
    this.setState({
      publishStream: null,
      publishButtonText: 'Publish',
      publishButtonDisabled: disablePublish,
      muteAudioButtonText: 'Mute A',
      muteAudioButtonDisabled: true,
      muteVideoButtonText: 'Mute V',
      muteVideoButtonDisabled: true
    });
  }

  publishLocalMedia = (room) => {
    let app = this;
    let constraints = {
        audio: true,
        video: true
    };
    let display = document.getElementById("localDisplay");

    app.setState({publishButtonDisabled: true});
    room.publish({
        display: display,
        constraints: constraints,
        record: false,
        receiveVideo: false,
        receiveAudio: false
    }).on(STREAM_STATUS.FAILED, (stream) => {
        console.warn("Local stream failed!");
        app.setState({publishStatus: STREAM_STATUS.FAILED, publishStatusClass: 'text-danger'});
        app.onMediaStopped();
    }).on(STREAM_STATUS.PUBLISHING, (stream) => {
        app.setState({publishStatus: STREAM_STATUS.PUBLISHING, publishStatusClass: 'text-success'});
        app.onMediaPublished(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, (stream) => {
        app.setState({publishStatus: STREAM_STATUS.UNPUBLISHED, publishStatusClass: 'text-success'});
        app.onMediaStopped();
    });
  }

  getRoomName = () => {
    let name = FPUtils.getUrlParam("roomName");
    if (name && name !== '') {
        return name;
    }
    return "room-"+FPUtils.createUUID(6);
  };

  setInviteUrl = (name) => {
    let inviteUrl = window.location.href.split("?")[0] + "?roomName=" + name;

    this.setState({inviteUrl: inviteUrl});
  };

  onJoinClick = () => {
    let app = this;
    let url = this.state.serverUrl;
    let username = this.state.login;
    let room = this.state.room;
    let participants = this.state.participants;

    if (!room) {
      this.createConnection(url, username);
    } else {
      this.setState({joinButtonDisabled: true}, () => {
        participants.forEach((participant) => {
          // Stop all the playing participants streams
          app.stopParticipantStream(participant.stream);
        });
        room.leave().then(() => {app.onLeft();}, () => {app.onLeft();});
      });
    }
  };

  onPublishClick = () => {
    let stream = this.state.publishStream;
    let room = this.state.room;

    if (!room) return;
    this.setState({publishButtonDisabled: true});
    if (!stream) {
      this.publishLocalMedia(room);
    } else {
      stream.stop();
    }
  };

  onMuteAudioClick = () => {
    let stream = this.state.publishStream;

    if (!stream) return;
    if (stream.isAudioMuted()) {
      stream.unmuteAudio();
      this.setState({muteAudioButtonText: 'Mute A'});
    } else {
      stream.muteAudio();
      this.setState({muteAudioButtonText: 'Unmute A'});      
    }
  }

  onMuteVideoClick = () => {
    let stream = this.state.publishStream;

    if (!stream) return;
    if (stream.isVideoMuted()) {
      stream.unmuteVideo();
      this.setState({muteVideoButtonText: 'Mute V'});
    } else {
      stream.muteVideo();
      this.setState({muteVideoButtonText: 'Unmute V'});      
    }
  }

  onSendClick = () => {
    let session = this.state.session;
    let room = this.state.room;
    let message = this.state.message;

    if (session && room) {
      let participants = room.getParticipants();
      this.addMessage(session.username(), message);
      for (let i = 0; i < participants.length; i++) {
          participants[i].sendMessage(encodeURIComponent(message));
      }
      this.setState({message: ''});
    }
  }

  render() {
    return (
      <div className="container">
        <h2 className="text-danger">{this.state.apiFailed}</h2>
        <div className="row col-sm-9" style={{marginTop: '20px'}}>
          <h2 className="text-center">Conference in React</h2>
        </div>
        <div className="row col-sm-9 justify-content-center" style={{marginTop: '20px'}}>
          <div className="input-group col-sm-9 justify-content-center">
            <div className="col-sm-2 text-right">
              <label className="control-label">WCS URL</label>
            </div>
            <div className="col-sm-4">
              <input type="text"
               className="form-control"
               placeholder="Server Url"
               value={this.state.serverUrl}
               disabled={this.state.serverUrlDisabled}
               onChange={(event) => this.setState({serverUrl: event.target.value})}
              />
            </div>
            <div className="col-sm-3" style={{marginLeft: '5px'}}>
              <div className={this.state.sessionStatusClass}>{this.state.sessionStatus}</div>
            </div>
          </div>
          <div className="input-group col-sm-9 justify-content-center" style={{marginTop: '5px'}}>
            <div className="col-sm-2 text-right">
              <label className="control-label">Login</label>
            </div>
            <div className="col-sm-4">
              <input type="text"
               className="form-control"
               placeholder="Login"
               value={this.state.login}
               disabled={this.state.loginDisabled}
               onChange={(event) => this.setState({login: event.target.value})}
              />
            </div>
            <div className="col-sm-3" style={{marginLeft: '5px'}}>
              <button
               className="btn btn-outline-dark"
               disabled={this.state.joinButtonDisabled}
               onClick={() => this.onJoinClick()}>
                {this.state.joinButtonText}
              </button>
            </div>
          </div>
          <div className="col-sm-9 justify-content-center" style={{marginTop: '5px'}}>
            <RecordDiv
             recordDisplay={this.state.recordDisplay}
             record={this.state.record}
             onChange={(event) => this.setState({record: event.target.checked})}
            />
          </div>
          <div className="col-sm-9" style={{marginTop: '5px'}}>
            <div className="text-danger text-center">{this.state.sessionFailedInfo}</div>
          </div>
        </div>
        <div className="row col-sm-9" style={{marginTop: '20px'}}>
          {
            // eslint-disable-next-line
            this.state.participants.map((participant, i) => {
              return (
                <ParticipantDiv
                 key={participant.name}
                 name={participant.name}
                 roomParticipant={participant.roomParticipant}
                 playParticipantStream={this.playParticipantsStream}
                />
              )
            })
          }
        </div>
        <div className="row col-sm-9 justify-content-center" style={{marginTop: '20px'}}>
          <div className="col-sm-9 justify-content-center">
            <div id="localDisplay" className="fp-localVideo"></div>
          </div>
          <div className="text-center" style={{marginTop: '5px'}}>
            <div className={this.state.publishStatusClass} style={{marginTop: '20px'}}>{this.state.publishStatus}</div>
          </div>
          <div className="col-sm-9 input-group justify-content-center" style={{marginTop: '5px'}}>
            <button
             className="btn btn-outline-dark"
             disabled={this.state.muteAudioButtonDisabled}
             onClick={() => this.onMuteAudioClick()}>
              {this.state.muteAudioButtonText}
            </button>
            <button
             className="btn btn-outline-dark"
             disabled={this.state.muteVideoButtonDisabled}
             onClick={() => this.onMuteVideoClick()}>
              {this.state.muteVideoButtonText}
            </button>
          </div>
          <div className="col-sm-9 input-group justify-content-center" style={{marginTop: '5px'}}>
            <button
             className="btn btn-outline-dark"
             disabled={this.state.publishButtonDisabled}
             onClick={() => this.onPublishClick()}>
              {this.state.publishButtonText}
            </button>
          </div>
        </div>
        <div className="row col-sm-9 justify-content-center" style={{marginTop: '20px'}}>
          <div className="col-sm-9 justify-content-center">
            <div style={{border: '1px solid', height: '100px'}}>
              <ScrollableFeed>
                {this.state.chat.map((item, i) => <div key={i}>{item}</div>)}
              </ScrollableFeed>
            </div>
          </div>
          <div className="input-group col-sm-9  justify-content-center" style={{marginTop: '5px'}}>
            <div className="col-sm-8">
              <textarea rows="1"
               className="form-control" style={{resize: 'none'}}
               onChange={(event) => this.setState({message: event.target.value})}
               value={this.state.message}
              />
            </div>
            <div className="col-sm-1">
              <button
               className="btn btn-outline-dark"
               disabled={this.state.sendButtonDisabled}
               onClick={() => this.onSendClick()}>
                {this.state.sendButtonText}
              </button>
            </div>
          </div>
        </div>
        <div className="row col-sm-9 justify-content-center" style={{marginTop: '20px'}}>
          <div className="col-sm-9">
            <span className="text-muted text-left">Invite</span>
            <div className="text-muted text-center" style={{border: '1px solid'}}>{this.state.inviteUrl}</div>
          </div>
        </div>
      </div>
    );
  };
}

export default ConferenceApp;
