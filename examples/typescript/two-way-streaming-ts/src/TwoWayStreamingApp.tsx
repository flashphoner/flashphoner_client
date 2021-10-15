import React, { Component } from 'react';
import './TwoWayStreamingApp.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as FPUtils from './fp-utils';
import * as Flashphoner from '@flashphoner/websdk';

const SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
const STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
const Browser = Flashphoner.Browser;
const PRELOADER_URL = process.env.PUBLIC_URL + '/media/preloader.mp4';

interface TwoWayStreamingState {
  apiFailed: string,
  session: any,
  sessionStatus: string,
  sessionStatusClass: string,
  localVideo: any,
  remoteVideo: any,
  publishStream: any,
  publishStatus: string,
  publishStatusClass: string,
  playStream: any,
  playStatus: string,
  playStatusClass: string,
  publishStreamName: string,
  publishStreamNameDisabled: boolean,
  playStreamName: string,
  playStreamNameDisabled: boolean,
  connectButtonText: string,
  connectButtonDisabled: boolean,
  serverUrl: string,
  serverUrlDisabled: boolean,
  publishButtonText: string,
  publishButtonDisabled: boolean,
  playButtonText: string,
  playButtonDisabled: boolean
}

class TwoWayStreamingApp extends Component<{}, TwoWayStreamingState> {
  constructor(props: any) {
    super(props);
    this.state = {
      apiFailed: '',
      session: null,
      sessionStatus: '',
      sessionStatusClass: 'text-muted',
      localVideo: null,
      remoteVideo: null,
      publishStream: null,
      publishStatus: '',
      publishStatusClass: 'text-muted',
      playStream: null,
      playStatus: '',
      playStatusClass: 'text-muted',
      publishStreamName: 'streamName',
      publishStreamNameDisabled: true,
      playStreamName: 'streamName',
      playStreamNameDisabled: true,
      connectButtonText: 'Connect',
      connectButtonDisabled: false,
      serverUrl: 'wss://demo.flashphoner.com:8443',
      serverUrlDisabled: false,
      publishButtonText: 'Publish',
      publishButtonDisabled: true,
      playButtonText: 'Play',
      playButtonDisabled: true
    };
  }

  componentDidMount() {
    try {
      Flashphoner.init({});
      this.setState({
        localVideo: document.getElementById('localVideo'),
        remoteVideo: document.getElementById('remoteVideo')
      });
    }
    catch(e) {
      console.log(e);
      this.setState({
        apiFailed: 'Your browser does not support WebRTC technology needed for this example',
        connectButtonDisabled: true,
        serverUrlDisabled: true
      });
    }
  }

  onConnected = (session: any) => {
    this.setState({
      session: session,
      connectButtonText: 'Disconnect',
      connectButtonDisabled: false,
      serverUrlDisabled: true
    });
    this.onUnpublished();
    this.onStopped();
  }

  onDisconnected = () => {
    this.setState({
      session: null,
      connectButtonText: 'Connect',
      connectButtonDisabled: false,
      serverUrlDisabled: false
    });
    this.onUnpublished();
    this.onStopped();
  }

  onPublishing = (stream: any) => {
    this.setState({
      publishStream: stream,
      publishButtonText: 'Unpublish',
      publishButtonDisabled: false
    });
  }

  onUnpublished = () => {
    let session = this.state.session;
    let itemState = true;

    if(session && session.status() === SESSION_STATUS.ESTABLISHED) {
      itemState = false;
    }
    this.setState({
      publishStream: null,
      publishButtonText: 'Publish',
      publishButtonDisabled: itemState,
      publishStreamNameDisabled: itemState
    });
  }

  onPlaying = (stream: any) => {
    this.setState({
      playStream: stream,
      playButtonText: 'Stop',
      playButtonDisabled: false
    });
  }

  onStopped = () => {
    let session = this.state.session;
    let itemState = true;

    if(session && session.status() === SESSION_STATUS.ESTABLISHED) {
      itemState = false;
    }
    this.setState({
      playStream: null,
      playButtonText: 'Play',
      playButtonDisabled: itemState,
      playStreamNameDisabled: itemState
    });
  }

  publishStream = () => {
    let app = this;
    let session = this.state.session;
    let streamName = this.state.publishStreamName;
    let localVideo = this.state.localVideo;

    if(session && localVideo) {
      session.createStream({
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        receiveVideo: false,
        receiveAudio: false
      }).on(STREAM_STATUS.PUBLISHING, (stream: any) => {
        app.setState({publishStatus: STREAM_STATUS.PUBLISHING, publishStatusClass: 'text-success'});
        app.onPublishing(stream);
      }).on(STREAM_STATUS.UNPUBLISHED, () => {
        app.setState({publishStatus: STREAM_STATUS.UNPUBLISHED, publishStatusClass: 'text-success'});
        app.onUnpublished();
      }).on(STREAM_STATUS.FAILED, () => {
        app.setState({publishStatus: STREAM_STATUS.FAILED, publishStatusClass: 'text-danger'});
        app.onUnpublished();
      }).publish();
    }
  }

  playStream = () => {
    let app = this;
    let session = this.state.session;
    let streamName = this.state.playStreamName;
    let remoteVideo = this.state.remoteVideo;

    if(session && remoteVideo) {
      session.createStream({
        name: streamName,
        display: remoteVideo
      }).on(STREAM_STATUS.PENDING, (stream: any) => {
        let video: any = document.getElementById(stream.id());
        if (!video.hasListeners) {
            video.hasListeners = true;
            video.addEventListener('resize', (event: any) => {
                FPUtils.resizeVideo(event.target);
            });
        }
      }).on(STREAM_STATUS.PLAYING, (stream: any) => {
        app.setState({playStatus: STREAM_STATUS.PLAYING, playStatusClass: 'text-success'});
        app.onPlaying(stream);
      }).on(STREAM_STATUS.STOPPED, () => {
        app.setState({playStatus: STREAM_STATUS.STOPPED, playStatusClass: 'text-success'});
        app.onStopped();
      }).on(STREAM_STATUS.FAILED, () => {
        app.setState({playStatus: STREAM_STATUS.FAILED, playStatusClass: 'text-danger'});
        app.onStopped();
      }).play();
    }
  }

  onConnectClick = () => {
    let app = this;
    let url = this.state.serverUrl;
    let session = this.state.session;

    if (!session) {
      console.log("Create new session with url " + url);
      app.setState({connectButtonDisabled: true, serverUrlDisabled: true});
      Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, (session: any) => {
        app.setState({sessionStatus: SESSION_STATUS.ESTABLISHED, sessionStatusClass: 'text-success'});
        app.onConnected(session);
      }).on(SESSION_STATUS.DISCONNECTED, () => {
        app.setState({sessionStatus: SESSION_STATUS.DISCONNECTED, sessionStatusClass: 'text-success'});
        app.onDisconnected();
      }).on(SESSION_STATUS.FAILED, () => {
        app.setState({sessionStatus: SESSION_STATUS.FAILED, sessionStatusClass: 'text-danger'});
        app.onDisconnected();
      });
    } else {
      app.setState({connectButtonDisabled: true});
      session.disconnect();
    }
  }

  onPublishClick = () => {
    let app = this;
    let stream = this.state.publishStream;
    let localVideo = this.state.localVideo;

    if (!localVideo) return;
    if (!stream) {
      app.setState({publishButtonDisabled: true, publishStreamNameDisabled: true});
      if (Browser.isSafariWebRTC()) {
        Flashphoner.playFirstVideo(localVideo, true, PRELOADER_URL).then(() => {
            app.publishStream();
        });
        return;
      }
      app.publishStream();
    } else {
      app.setState({publishButtonDisabled: true});
      stream.stop();
    }
  }

  onPlayClick = () => {
    let app = this;
    let stream = this.state.playStream;
    let remoteVideo = this.state.remoteVideo;

    if (!remoteVideo) return;
    if (!stream) {
      app.setState({playButtonDisabled: true, playStreamNameDisabled: true});
      if (Flashphoner.getMediaProviders()[0] === "WSPlayer") {
        Flashphoner.playFirstSound();
      } else if (Browser.isSafariWebRTC()) {
        Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL).then(() => {
            app.playStream();
        });
        return;
      }
      app.playStream();
    } else {
      app.setState({playButtonDisabled: true});
      stream.stop();
    }
  }

  render() {
    return (
      <div className="container">
        <h2 className="text-danger">{this.state.apiFailed}</h2>
        <div className="row">
          <h2 className="text-center">Two-way Streaming in Typescript</h2>
        </div>
        <div className="row row-space">
          <div className="col-sm-6">
            <div className="text-center text-muted">Local</div>
            <div className="fp-Video">
              <div id="localVideo" className="display"></div>
            </div>
            <div className="input-group col-sm-5" style={{margin: '10px auto 0 auto'}}>
              <input type="text" 
               className="form-control"
               placeholder="Stream Name"
               value={this.state.publishStreamName}
               disabled={this.state.publishStreamNameDisabled}
               onChange={(event) => this.setState({publishStreamName: event.target.value})}
              />
              <div className="input-group-btn">
                <button
                 className="btn btn-outline-dark"
                 disabled={this.state.publishButtonDisabled}
                 onClick={() => this.onPublishClick()}>
                  {this.state.publishButtonText}
                </button>
              </div>
            </div>
            <div className="text-center" style={{marginTop: '20px'}}>
              <div className={this.state.publishStatusClass}>{this.state.publishStatus}</div>
            </div>
          </div>
          <div className="col-sm-6">
            <div className="text-center text-muted">Remote</div>
            <div className="fp-Video">
              <div id="remoteVideo" className="display"></div>
            </div>
            <div className="input-group col-sm-5" style={{margin: '10px auto 0 auto'}}>
              <input type="text" 
               className="form-control"
               placeholder="Stream Name"
               value={this.state.playStreamName}
               disabled={this.state.playStreamNameDisabled}
               onChange={(event) => this.setState({playStreamName: event.target.value})}
              />
              <div className="input-group-btn">
                <button
                 className="btn btn-outline-dark"
                 disabled={this.state.playButtonDisabled}
                 onClick={() => this.onPlayClick()}>
                  {this.state.playButtonText}
                </button>
              </div>
            </div>
            <div className="text-center" style={{marginTop: '20px'}}>
              <div className={this.state.playStatusClass}>{this.state.playStatus}</div>
            </div>
          </div>
        </div>
        <div className="row row-space">
            <div className="col-sm-6 offset-sm-3">
              <div className="input-group col-sm-5">
                <input type="text"
                 className="form-control"
                 placeholder="Server Url"
                 value={this.state.serverUrl}
                 disabled={this.state.serverUrlDisabled}
                 onChange={(event) => this.setState({serverUrl: event.target.value})}
                />
                <div className="input-group-btn">
                  <button
                   className="btn btn-outline-dark"
                   disabled={this.state.connectButtonDisabled}
                   onClick={() => this.onConnectClick()}>
                    {this.state.connectButtonText}
                  </button>
                </div>
              </div>
              <div className="text-center" style={{marginTop: '20px'}}>
                <div className={this.state.sessionStatusClass}>{this.state.sessionStatus}</div>
              </div>
            </div>
        </div>
      </div>
    );
  };
}

export default TwoWayStreamingApp;
