var redis = require('redis');
var session = require('express-session');
var redisStore = require('connect-redis')(session);
var common = require('./common.js');

class Redis {
    constructor(serverMode) {
        const config = {
            host: "localhost", // (serverMode == "live") ? "localhost" : "dev.zip-lab.co.kr",
            port: 6379
        };
        this.client = redis.createClient(config);
        this.client.auth("something");
        this.client.on('error', function (err) {
            console.log('[WORMIO] Redis error: ' + err);
        });

        this.store = new redisStore({
            client: this.client,
            ttl: 3600 * 24
        });
        this.session = session({
            secret: 'something',
            store: this.store,
            resave: false,
            saveUninitialized: true,
            rolling: true,
            cookie: {
                // expires: new Date(Date.now() + common.MS1DAY * 30),
                // maxAge: 60000
                maxAge: common.MS1HOUR * 24
            }
        });
    }

    getSession(userNo) {
        return new Promise(async (resolve, reject) => { try {
            if (common.sessList[userNo] === undefined) {
                return resolve(null);
            }

            this.store.get(common.sessList[userNo], (err, sess) => {
                if (err) {
                    console.log('[WORMIO] No UID in session');
                    return reject(false);
                }

                if (sess) {
                    resolve(sess);
                } else {
                    reject(false);
                }
            });
        } catch (error) {
            reject(error);
        }})
    }

    setSession(userNo, setObject) {
        return new Promise(async (resolve, reject) => { try {
            if (common.sessList[userNo] === undefined) {
                return resolve(null);
            }

            console.log(common.sessList[userNo])
            this.store.get(common.sessList[userNo], (err, sess) => {
                if (err) {
                    console.log('[WORMIO] No UID in session');
                    return reject(false);
                }

                if (sess) {
                    Object.entries(setObject).forEach(([attrName, attrValue]) => {
                        if (attrValue === null) {
                            delete sess[attrName];
                        } else {
                            sess[attrName] = attrValue;
                        }
                    });
                    this.store.set(common.sessList[userNo], sess);
                    resolve(sess);
                } else {
                    reject(false);
                }
            });
        } catch (error) {
            reject(error);
        }})
    }

    delSession(userNo) {
        return new Promise(async (resolve, reject) => { try {
            this.store.destroy(common.sessList[userNo], (err, sess) => {
                delete common.sessList[userNo];
                resolve();
            });
        } catch (error) {
            reject(error);
        }})
    }
}

module.exports = new Redis(common.setting.serverMode);