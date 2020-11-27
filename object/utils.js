const common = require('../handler/common.js');

const utils = new function() {

    this.doAsync = fn => async (req, res, next) => await fn(req, res, next).catch(next)
    this.getNewId = function(list, prefix = '', isNumeric = false) {
        let id;
        do {
            id = isNumeric ? 
                prefix + Math.floor(Math.random() * isNumeric).toString() :
                prefix + Math.random().toString(36).substr(2, 9)
            ;
        } while (id in list);
        return id;
    }

    this.isAdminIP = function (req, allowIP) {
        var ip = (req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress).split(",")[0];
        if (ip.substr(0, 7) == "::ffff:") ip = ip.substr(7);

        if (allowIP.indexOf(ip) === -1) {
            console.warn(`[ROR] access Deny from ${ip}`);
            return false;
        } else {
            return true;
        }
    }

    this.rtnHandler = {
        json: function (req, res, next) {
            common.unlockReq(req.session, req.method, req.path);
            res.json({
                status: 'success',
                serverTime: Date.now(),
                data: res.locals.rtnData || {}
            });
        }
    }

    this.errHandler = {
        log: function (err, req, res, next) {
            console.error(err.stack);
            next(err);
        },

        // { status: 'fail', message: "fail_message" },
        // { status: 'error', message: "error_message" },
        client: function (err, req, res, next) {
            if (req.xhr) {
                res.json({
                    status: 'error',
                    message: err
                });
                // res.status(500).send({
                //     error: 'Something failed!'
                // });
            } else {
                next(err);
            }
        },

        all: function (err, req, res, next) {
            if (err.message) {
                let now = new Date();
                console.warn(`[${now.toLocaleDateString()} ${now.toLocaleTimeString()}] `, err);
                res.json({
                    status: 'error',
                    serverTime: Date.now(),
                    message: "server_error"
                });
            } else {
                res.json({
                    status: 'fail',
                    serverTime: Date.now(),
                    message: err,
                    data: res.locals.rtnData || {}
                });
            }
        }
    }
};

const self = utils;
module.exports = utils;

// 내장 함수 추가
String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

Date.prototype.format = function (f) {
    if (!this.valueOf()) return " ";

    var weekName = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    var d = this;

    return f.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|a\/p)/gi, function ($1) {
        switch ($1) {
            case "yyyy":
                return d.getFullYear();
            case "yy":
                return (d.getFullYear() % 1000).zf(2);
            case "MM":
                return (d.getMonth() + 1).zf(2);
            case "dd":
                return d.getDate().zf(2);
            case "E":
                return weekName[d.getDay()];
            case "HH":
                return d.getHours().zf(2);
            case "hh":
                return ((h = d.getHours() % 12) ? h : 12).zf(2);
            case "mm":
                return d.getMinutes().zf(2);
            case "ss":
                return d.getSeconds().zf(2);
            case "a/p":
                return d.getHours() < 12 ? "오전" : "오후";
            default:
                return $1;
        }
    });
};

String.prototype.string = function (len) {
    var s = '',
        i = 0;
    while (i++ < len) {
        s += this;
    }
    return s;
};
String.prototype.zf = function (len) {
    return "0".string(len - this.length) + this;
};
Number.prototype.zf = function (len) {
    return this.toString().zf(len);
};

Array.prototype.toObject = function (keyField) {
    return this.reduce((obj, item) => {
        obj[item[keyField]] = item;
        return obj
    }, {})
}