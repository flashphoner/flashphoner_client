package com.flashphoner.api2.media
{
		
	import com.flashphoner.Logger;
    import com.flashphoner.api2.Main;
	
	import flash.events.*;
	import flash.media.*;
	import flash.net.NetStream;
    import flash.media.Video;
	
	public class RemoteMediaControl
	{	
		private var display:Video;
		private var stream:NetStream;

		private  var currentVolume:int = 100;

		private var application:Main;

		public function RemoteMediaControl(application:Main, display:Video):void
		{
			this.application = application;
			this.display = display;
			this.display.clear();
		}

		public function attachStream(stream:NetStream):void {
			this.stream = stream;
			var soundTransform:SoundTransform = new SoundTransform();
			soundTransform.volume = currentVolume/100;
			stream.soundTransform = soundTransform;
			this.display.attachNetStream(stream);
		}
		
		/**
		 * Get current volume for speakers (1-100) 
		 **/
		public function getVolume():int{
			return currentVolume;
		}		
		
		/**
		 * Set current volume for speakers
		 * @param volume (1-100)
		 **/
		public function setVolume(volume:int):void{
			currentVolume = volume;
			if (stream != null){
				var soundTransform:SoundTransform = new  SoundTransform;	
				soundTransform.volume = currentVolume/100;
				stream.soundTransform = soundTransform;
			}
						
		}
		
		/**
		 * Change format of a video
		 * @param format (CIF/QCIF)
		 **/ 
		public function changeFormat(width:int, height:int):void{
			this.display.width=width;
			this.display.height=height;
			this.display.clear();
		}

		public function onVideoResolutionChange():void {
			Logger.info("onVideoResolutionChange Size is " + display.videoWidth + "x" + display.videoHeight);
			application.resize(display.videoWidth, display.videoHeight);
		}
	}
}
