/* ========================================================================
 * bootstrap-switch - v2.0
 * https://github.com/mewsoft/bootstrap-switch
 *
 * bootstrap-switch - v1.0
 * https://github.com/wpic/bootstrap-switch
 * ========================================================================
 * Copyright 2014 WPIC, Hamed Abdollahpour
 *
 * ========================================================================
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================================
 */

(function ( $ ) {

    $.fn.bootstrapSwitch = function( options ) {

        var settings = $.extend({
            on: 'On',
            off: 'Off	',
            onLabel: '&nbsp;&nbsp;&nbsp;',
            offLabel: '&nbsp;&nbsp;&nbsp;',
            same: false,//same labels for on/off states
            size: 'md',
            onClass: 'primary',
            offClass: 'default'
        }, options );

        settings.size = ' btn-'+settings.size;
        if (settings.same){
            settings.onLabel = settings.on;
            settings.offLabel = settings.off;
        }

        return this.each(function(e) {
            var c = $(this);
            var disabled = c.is(":disabled") ? " disabled" : "";

            var div = $('<div class="btn-group btn-toggle" style="white-space: nowrap;"></div>').insertAfter(this);
            var on = $('<button class="btn btn-primary '+settings.size+disabled+'" style="float: none;display: inline-block;"></button>').html(settings.on).css('margin-right', '0px').appendTo(div);
            var off = $('<button class="btn btn-danger '+settings.size+disabled+'" style="float: none;display: inline-block;"></button>').html(settings.off).css('margin-left', '0px').appendTo(div);

            function applyChange(b) {
                var disabled = c.is(":disabled") ? " disabled" : "";
                if(b) {
                    on.attr('class', 'btn active btn-' + settings.onClass+settings.size+disabled).html(settings.on).blur();
                    off.attr('class', 'btn btn-default '+settings.size+disabled).html(settings.offLabel).blur();
                }
                else {
                    on.attr('class', 'btn btn-default '+settings.size+disabled).html(settings.onLabel).blur();
                    off.attr('class', 'btn active btn-' + settings.offClass+settings.size+disabled).text(settings.off).blur();
                }
            }
            applyChange(c.is(':checked'));

            on.click(function(e) {
                if (!c.is(":disabled")) {
                    e.preventDefault();
                    c.prop("checked", !c.prop("checked")).trigger('change')
                }
            });
            off.click(function(e) {
                if (!c.is(":disabled")) {
                    e.preventDefault();
                    c.prop("checked", !c.prop("checked")).trigger('change')
                }
            });

            $(this).hide().on('change', function() {
                applyChange(c.is(':checked'))
            });
        });
    };
} ( jQuery ));