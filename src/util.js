'use strict';

module.exports = {
    /**
     * Copy values of object own properties to array.
     *
     * @param obj
     * @returns {Array}
     */
    copyObjectToArray: function(obj) {
        var ret = [];
        for (var prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                ret.push(obj[prop]);
            }
        }
        return ret;
    },
    /**
     * Copy src properties to dst object.
     * Will overwrite dst prop with src prop in case of dst prop exist.
     */
    copyObjectPropsToAnotherObject: function(src, dst) {
        for (var prop in src) {
            if(src.hasOwnProperty(prop)) {
                dst[prop] = src[prop];
            }
        }
    }
};