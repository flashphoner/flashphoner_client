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
package com.flashphoner.phone.views
{
    import flash.events.Event;
    import flash.events.MouseEvent;
    
    import mx.containers.Panel;
    import mx.controls.LinkButton;

    public class DragPanel extends Panel{
        
        public function DragPanel(){
            super();
        }
        
        override protected function createChildren():void{
            super.createChildren();
            this.addEventListener(MouseEvent.MOUSE_DOWN,handleDown);
            this.addEventListener(MouseEvent.MOUSE_UP,handleUp);
        }
        override protected function updateDisplayList(unscaledWidth:Number, unscaledHeight:Number):void{
            super.updateDisplayList(unscaledWidth,unscaledHeight);
        }
        
        private function handleDown(e:Event):void{
            this.startDrag();
        }
        private function handleUp(e:Event):void{
            this.stopDrag();
        }
        
        private function closeMe(e:MouseEvent):void{
            this.visible = false;
        }
    }
}
