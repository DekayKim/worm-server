const common = new function () {
    // this.infoFile = require('../info.json');
    // this.gameInfo = this.infoFile.data;
    
    // this.sessList = {};
    this.socketList = {};
    this.roomList = {};
    this.playerList = {};
    this.judgeBuffer = [];

    // 상수 선언
    this.MS1SEC = 1000;
    this.MS1MIN = 1000 * 60;
    this.MS1HOUR = 1000 * 3600; // 60*60*24
    this.MS1DAY = 1000 * 86400; // 60*60*24

    try {
        this.setting = require('../setting.json');
    } catch (error) {
        console.warn(`setting.json was not found. Set default value`);
        this.setting = {
            useHTTPS: false,
            serverMode: "dev",
            allowIP: [],
            isLocal: false,
            serviceOpenDate: null,
            adminAccount: []
        }
    }
}

module.exports = common;