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
package com.flashphoner.api.management
{
	import com.flashphoner.Logger;
	import com.flashphoner.api.data.PhoneConfig;
	
	import flash.media.Camera;
	
	import flashx.textLayout.debug.assert;
	
	import mx.controls.Alert;
	import mx.core.Application;

	/**
	 * Control class (singelton) for cameras
	 **/
	public class VideoControl
	{
		private static var videoControl:VideoControl;
		private var cam:Camera;
		
		public function VideoControl()
		{
			cam = Camera.getCamera();
			
		}
		
		/**
		 * Init width,height,fps and another parameters
		 **/ 
		public function init():void{			
			if (cam != null){				
				supportedResolutions("720x576,720x480,640x480,352x576,352x480,352x288,320x240,176x144,160x120,128x96,80x60");
				cam.setMode(PhoneConfig.VIDEO_WIDTH,PhoneConfig.VIDEO_HEIGHT,PhoneConfig.CAM_FPS,PhoneConfig.CAM_KEEP_RATIO);
				cam.setKeyFrameInterval(PhoneConfig.CAM_KEY_INT);
				cam.setQuality(0,PhoneConfig.CAM_QUALITY);
				cam.setMotionLevel(0,2000);
				PhoneConfig.VIDEO_WIDTH = cam.width;
				PhoneConfig.VIDEO_HEIGHT = cam.height;	
			}
			
		}		
		
		/**
		 * Add new supported resolutions
		 **/
		public function supportedResolutions(resolutions:String):void {					
			var supportedResolutions:String = ""; 
			var resolutionsSplit:Array = resolutions.split(",");
			var flag:Boolean = true;
			for (var i:int=0;i<resolutionsSplit.length;i++){
				var res:String = resolutionsSplit[i];
				var resSplit:Array = res.split("x");
				var w:int = int(resSplit[0]);
				var h:int = int(resSplit[1]);
				cam.setMode(w,h,30,true);
				if ((w==cam.width)&&(h==cam.height)){
					Logger.info("Resolution is supported: "+w+"x"+h);
					supportedResolutions += (w+"x"+h+",");
					if ((w<=PhoneConfig.VIDEO_WIDTH)&&(h<=PhoneConfig.VIDEO_HEIGHT)&&flag){
						PhoneConfig.VIDEO_WIDTH=w;
						PhoneConfig.VIDEO_HEIGHT=h;
						flag=false;
					}
				}else{
					Logger.info("Resolution is NOT supported: "+w+"x"+h+", used: "+cam.width+"x"+cam.height);
				}
			}
			
			Logger.info("supportedResolutions: "+supportedResolutions+" PhoneConfig.VIDEO_WIDTH: "+PhoneConfig.VIDEO_WIDTH+" PhoneConfig.VIDEO_HEIGHT: "+PhoneConfig.VIDEO_HEIGHT);
			
			PhoneConfig.SUPPORTED_RESOLUTIONS = supportedResolutions.substring(0,supportedResolutions.length-1);
			
		}
		
		/**
		 * Get current camera to used Flashphoner
		 **/
		public function getCam():Camera{
			return cam;
		}
		
		/**
		 * Change output format CIF/QCIF
		 **/
		public function changeFormat(width:int, height:int):void{
			Logger.info("change format "+width+"x"+height);			
			if ((width>0)&&(height>0)){
				cam.setMode(width,height,PhoneConfig.CAM_FPS,PhoneConfig.CAM_KEEP_RATIO);
			}			
		}

  		/**
		 * change current camera to used Flashphoner
		 **/
		public function changeCamera(camera:Camera):void{
			Logger.info("changeCamera");
			if (PhoneConfig.VIDEO_ENABLED){
				camera.setMode(320,240,PhoneConfig.CAM_FPS,PhoneConfig.CAM_KEEP_RATIO);
				camera.setKeyFrameInterval(PhoneConfig.CAM_KEY_INT);
				camera.setQuality(0,PhoneConfig.CAM_QUALITY);
				camera.setMotionLevel(0,2000);	
				this.cam = camera;			
			}
		}
	}
}
