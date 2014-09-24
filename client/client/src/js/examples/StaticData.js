function getCookie(c_name) {
    var i, x, y, ARRcookies = document.cookie.split(";");
    for (i = 0; i < ARRcookies.length; i++) {
        x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
        x = x.replace(/^\s+|\s+$/g, "");
        if (x == c_name) {
            return ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
        }
    }
}

function setCookie(c_name, value) {
    var exdate = new Date();
    exdate.setDate(exdate.getDate() + 100);
    var c_value = escape(value) + "; expires=" + exdate.toUTCString();
    document.cookie = c_name + "=" + c_value;
}

