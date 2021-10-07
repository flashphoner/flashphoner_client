<template>
  <div id="app">
    <div class="container">
      <h2 class="text-danger">{{ apiFailed }}</h2>
      <div class="row col-sm-12">
        <h2 class="text-center">Two-way Streaming in Vue</h2>
      </div>
      <div class="row col-sm-12" style="margin-top: 20px;">
        <div class="col-sm-6">
          <div class="text-center text-muted">Local</div>
          <div class="fp-Video">
            <div id="localVideo" class="display"></div>
          </div>
          <div class="input-group col-sm-5" style="margin: 10px auto 0 auto;">
            <input type="text" 
             class="form-control"
             placeholder="Stream Name"
             v-model="publishStreamName"
             :disabled="publishStreamNameDisabled"
            />
            <div class="input-group-btn">
              <button
               class="btn btn-outline-dark"
               :disabled="publishButtonDisabled"
               v-on:click="onPublishClick">
                {{ publishButtonText }}
              </button>
            </div>
          </div>
          <div class="text-center" style="margin-top: 20px;">
            <div v-bind:class="publishStatusClass">{{ publishStatus }}</div>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="text-center text-muted">Remote</div>
          <div class="fp-Video">
            <div id="remoteVideo" class="display"></div>
          </div>
          <div class="input-group col-sm-5" style="margin: 10px auto 0 auto;">
            <input type="text" 
             class="form-control"
             placeholder="Stream Name"
             v-model="playStreamName"
             :disabled="playStreamNameDisabled"
            />
            <div class="input-group-btn">
              <button
               class="btn btn-outline-dark"
               :disabled="playButtonDisabled"
               v-on:click="onPlayClick">
                {{ playButtonText }}
              </button>
            </div>
          </div>
          <div class="text-center" style="margin-top: 20px;">
            <div v-bind:class="playStatusClass">{{ playStatus }}</div>
          </div>
        </div>
      </div>
      <div class="row col-sm-12" style="margin-top: 20px;">
          <div class="col-sm-6 offset-sm-3">
            <div class="input-group col-sm-5">
              <input type="text"
               class="form-control"
               placeholder="Server Url"
               v-model="serverUrl"
               :disabled="serverUrlDisabled"
              />
              <div class="input-group-btn">
                <button
                 class="btn btn-outline-dark"
                 :disabled="connectButtonDisabled"
                 v-on:click="onConnectClick">
                  {{ connectButtonText }}
                </button>
              </div>
            </div>
            <div class="text-center" style="margin-top: '20px';">
              <div v-bind:class="sessionStatusClass">{{ sessionStatus }}</div>
            </div>
          </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as FPUtils from './fp-utils.js';
import * as Flashphoner from '@flashphoner/websdk';

const SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
const STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
const Browser = Flashphoner.Browser;
const PRELOADER_URL = require('@/assets/media/preloader.mp4');

export default {
  name: 'TwoWayStreamingApp',
  data: () => ({
    apiFailed: '',
    session: null,
    sessionStatus: '',
    sessionStatusClass: 'text-muted',
    localVideo: null,
    remoteVideo: null,
    publishStreamObj: null,
    publishStatus: '',
    publishStatusClass: 'text-muted',
    playStreamObj: null,
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
    playButtonDisabled: true,
  }),
  mounted() {
    this.onLoad();
  },
  methods: {
    onLoad() {
      try {
        Flashphoner.init({});
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
      }
      catch(e) {
        console.log(e);
        this.apiFailed = 'Your browser does not support WebRTC technology needed for this example';
        this.connectButtonDisabled = true;
        this.serverUrlDisabled = true;
      }
    },
    onConnected(session) {
      this.session = session;
      this.connectButtonText = 'Disconnect';
      this.connectButtonDisabled = false;
      this.serverUrlDisabled = true;
      this.onUnpublished();
      this.onStopped();
    },
    onDisconnected() {
      this.session = null;
      this.connectButtonText = 'Connect';
      this.connectButtonDisabled = false;
      this.serverUrlDisabled = false;
      this.onUnpublished();
      this.onStopped();
    },
    onPublishing(stream) {
      this.publishStreamObj = stream;
      this.publishButtonText = 'Unpublish';
      this.publishButtonDisabled = false;
    },
    onUnpublished() {
      let session = this.session;
      let itemState = true;

      if(session && session.status() === SESSION_STATUS.ESTABLISHED) {
        itemState = false;
      }
      this.publishStreamObj = null;
      this.publishButtonText = 'Publish';
      this.publishButtonDisabled = itemState;
      this.publishStreamNameDisabled = itemState;
    },
    onPlaying(stream) {
      this.playStreamObj = stream;
      this.playButtonText = 'Stop';
      this.playButtonDisabled = false;
    },
    onStopped() {
      let session = this.session;
      let itemState = true;

      if(session && session.status() === SESSION_STATUS.ESTABLISHED) {
        itemState = false;
      }
      this.playStreamObj = null;
      this.playButtonText = 'Play';
      this.playButtonDisabled = itemState;
      this.playStreamNameDisabled = itemState;
    },
    publishStream() {
      let session = this.session;
      let streamName = this.publishStreamName;
      let localVideo = this.localVideo;

      if(session && localVideo) {
        session.createStream({
          name: streamName,
          display: localVideo,
          cacheLocalResources: true,
          receiveVideo: false,
          receiveAudio: false
        }).on(STREAM_STATUS.PUBLISHING, (stream) => {
          this.publishStatus = STREAM_STATUS.PUBLISHING;
          this.publishStatusClass = 'text-success';
          this.onPublishing(stream);
        }).on(STREAM_STATUS.UNPUBLISHED, () => {
          this.publishStatus = STREAM_STATUS.UNPUBLISHED;
          this.publishStatusClass = 'text-success';
          this.onUnpublished();
        }).on(STREAM_STATUS.FAILED, () => {
          this.publishStatus = STREAM_STATUS.FAILED;
          this.publishStatusClass = 'text-danger';
          this.onUnpublished();
        }).publish();
      }
    },
    playStream() {
      let session = this.session;
      let streamName = this.playStreamName;
      let remoteVideo = this.remoteVideo;

      if(session && remoteVideo) {
        session.createStream({
          name: streamName,
          display: remoteVideo
        }).on(STREAM_STATUS.PENDING, (stream) => {
          let video = document.getElementById(stream.id());
          if (!video.hasListeners) {
            video.hasListeners = true;
            video.addEventListener('resize', (event) => {
                FPUtils.resizeVideo(event.target);
            });
          }
        }).on(STREAM_STATUS.PLAYING, (stream) => {
          this.playStatus = STREAM_STATUS.PLAYING;
          this.playStatusClass = 'text-success';
          this.onPlaying(stream);
        }).on(STREAM_STATUS.STOPPED, () => {
          this.playStatus = STREAM_STATUS.STOPPED;
          this.playStatusClass = 'text-success';
          this.onStopped();
        }).on(STREAM_STATUS.FAILED, () => {
          this.playStatus = STREAM_STATUS.FAILED;
          this.playStatusClass = 'text-danger';
          this.onStopped();
        }).play();
      }
    },
    onConnectClick() {
      let url = this.serverUrl;
      let session = this.session;

      if (!session) {
        console.log("Create new session with url " + url);
        this.connectButtonDisabled = true;
        this.serverUrlDisabled = true;
        Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, (session) => {
          this.sessionStatus = SESSION_STATUS.ESTABLISHED;
          this.sessionStatusClass = 'text-success';
          this.onConnected(session);
        }).on(SESSION_STATUS.DISCONNECTED, () => {
          this.sessionStatus = SESSION_STATUS.DISCONNECTED;
          this.sessionStatusClass = 'text-success';
          this.onDisconnected();
        }).on(SESSION_STATUS.FAILED, () => {
          this.sessionStatus = SESSION_STATUS.FAILED;
          this.sessionStatusClass = 'text-danger';
          this.onDisconnected();
        });
      } else {
        this.connectButtonDisabled = true;
        session.disconnect();
      }
    },
    onPublishClick() {
      let stream = this.publishStreamObj;
      let localVideo = this.localVideo;

      if (!localVideo) return;
      if (!stream) {
        this.publishButtonDisabled = true;
        this.publishStreamNameDisabled = true;
        if (Browser.isSafariWebRTC()) {
          Flashphoner.playFirstVideo(localVideo, true, PRELOADER_URL).then(() => {
            this.publishStream();
          });
          return;
        }
        this.publishStream();
      } else {
        this.publishButtonDisabled = true;
        stream.stop();
      }
    },
    onPlayClick() {
      let stream = this.playStreamObj;
      let remoteVideo = this.remoteVideo;

      if (!remoteVideo) return;
      if (!stream) {
        this.playButtonDisabled = true;
        this.playStreamNameDisabled = true;
        if (Flashphoner.getMediaProviders()[0] === "WSPlayer") {
          Flashphoner.playFirstSound();
        } else if (Browser.isSafariWebRTC()) {
          Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL).then(() => {
            this.playStream();
          });
          return;
        }
        this.playStream();
      } else {
        this.playButtonDisabled = true;
        stream.stop();
      }
    }
  }
}
</script>

<style>
.fp-Video {
    border: 1px double black;
    width: 322px;
    height: 242px;
    text-align: center;
    background: #c0c0c0;
    margin: 0 auto 0 auto;
}

.display {
    width: 100%;
    height: 100%;
    display: inline-block;
}

.display > video, object {
    width: 100%;
    height: 100%;
}

video:-webkit-full-screen {
    border-radius: 1px;
}
</style>
