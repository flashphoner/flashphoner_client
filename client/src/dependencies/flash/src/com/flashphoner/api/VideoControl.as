/*
Copyright (c) 2011 Flashphoner
All rights reserved. This Code and the accompanying materials
are made available under the terms of the GNU Public License v2.0
which accompanies this distribution, and is available at
http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Contributors:
    Flashphoner - initial API and implementation

This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. Other license versions by negatiation. Write us support@flashphoner.com with any questions.
*/
package com.flashphoner.api
{
	import com.flashphoner.Logger;
	
	import flash.media.Camera;
	import flash.net.NetStream;
	
	import flashx.textLayout.debug.assert;
	
	import mx.controls.Alert;
	import mx.controls.VideoDisplay;
	import mx.core.Application;

	/**
	 * Control class (singelton) for cameras
	 **/
	public class VideoControl
	{
		private static var videoControl:VideoControl;
		private var cam:Camera;
		private const FPS:int = 15;
		private const KEEP_RATIO:Boolean = true;
		private const KEY_INT:int = 48;
		private const QUALITY:int = 80;
		private var width:int;
		private var height:int;
		
		public function VideoControl(){
		}
		
		/**
		 * Init width,height,fps and another parameters
		 **/ 
		public function init(width:int, height:int):void{
			this.width = width;
			this.height = height;
			var camera:Camera = getCam(); 
			if (camera != null){
				supportedResolutions(camera, "1280x720,720x576,720x480,640x480,352x576,352x480,352x288,320x240,176x144,160x120,128x96,80x60");
				camera.setMode(this.width,this.height,FPS,KEEP_RATIO);
				camera.setKeyFrameInterval(KEY_INT);
				camera.setQuality(0,QUALITY);
				camera.setMotionLevel(0,2000);
			}
			
		}		
		
		private function supportedResolutions(camera:Camera, resolutions:String):void {					
			var resolutionsSplit:Array = resolutions.split(",");
			var flag:Boolean = true;
			for (var i:int=0;i<resolutionsSplit.length;i++){
				var res:String = resolutionsSplit[i];
				var resSplit:Array = res.split("x");
				var w:int = int(resSplit[0]);
				var h:int = int(resSplit[1]);
				camera.setMode(w,h,30,true);
				if ((w==camera.width)&&(h==camera.height)){
					Logger.info("Resolution is supported: "+w+"x"+h);
					if ((w<=this.width)&&(h<=this.height)&&flag){
						this.width=w;
						this.height=h;
						flag=false;
					}
				}else{
					Logger.info("Resolution is NOT supported: "+w+"x"+h+", used: "+camera.width+"x"+camera.height);
				}
			}
		}
		
		public function getCam():Camera {
			if (cam == null){
				cam = Camera.getCamera();
			}
			return cam; 			
		}
		
		/**
		 * Get current camera to used Flashphoner
		 **/
		public function attachStream(netStream:NetStream):void{
			netStream.attachCamera(getCam());
		}
		
		public function attachLocal(videoDisplay:VideoDisplay):void{
			videoDisplay.attachCamera(getCam());
		}
		
		
		/**
		 * Change output format CIF/QCIF
		 **/
		public function changeFormat(width:int, height:int):void{
			Logger.info("change format "+width+"x"+height);			
			if ((width>0)&&(height>0)){
				getCam().setMode(width,height,FPS,KEEP_RATIO);
			}			
		}
		
		public function hasAccess():Boolean{
			var camera:Camera = getCam();
			if (camera == null){
				return false;
			}else{
				if (camera.muted){
					return false;
				}else{
					return true;
				}
				
			}
		}		

  		/**
		 * change current camera to used Flashphoner
		 **/
		public function changeCamera(camera:Camera):void{
			Logger.info("changeCamera");
			camera.setMode(320,240,FPS,KEEP_RATIO);
			camera.setKeyFrameInterval(KEY_INT);
			camera.setQuality(0,QUALITY);
			camera.setMotionLevel(0,2000);	
			this.cam = camera;			
		}
	}
}
