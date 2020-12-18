const common = require('../handler/common.js');
const Utils = require('../object/utils.js');
const sockIO = require('../handler/socket.js');

var mysql = require('../handler/mysql.js');
mysql = new mysql(common.setting.dbconfig);

const {
    STAGE_SIZE,
    CREATE_PLAYER_SIZE_PER_STAGE
} = require('../handler/define.js');
const CREATE_PLAYER_MARGIN_PER_STAGE = STAGE_SIZE * (1 - CREATE_PLAYER_SIZE_PER_STAGE) / 2;

const AI_NAME_LIST = require('../ainame.json');

const START_POINT = 0;


class Player {
    constructor(id, option = {}) {
        this.id = id;// || Utils.getNewId(common.playerList, '', 1000);
        option = Object.assign({
            socketId: null,
            isMobile: null,
            _aiHandler: null,
            name: AI_NAME_LIST[Math.floor(Math.random() * AI_NAME_LIST.length)],
            color: Utils.getRandomColor()
        }, option);
        
        this.socketId = option.socketId;
        this.isMobile = option.isMobile;
        this.isAI = option.isAI;
        this._aiHandler = option._aiHandler;
        this.name = option.name;
        this.color = option.color;

        if (this.isAI) {
            const startDegree = Math.floor(Math.random() * 360);
            this.aiConf = {
                degree: {
                    value: startDegree,
                    timer: Infinity,
                    dest: startDegree
                },
                target: null,
                boost: {
                    isRunning: false,
                    checkTime: Infinity,
                    endTime: null,
                    dropTimer: 0
                }
            }
        }

        this.isBoosting = false;

        this.myLastTick = option.lastTick;
        this.myLastTick.id = this.id;
    }

    initId() {
        this.id = Utils.getNewId(common.playerList, '', 1000);
        this.myLastTick.id = this.id;
    }

    setCurrent(data) {
        if (data.x !== undefined) this.myLastTick.x = data.x;
        if (data.y !== undefined) this.myLastTick.y = data.y;
        if (data.angle !== undefined) this.myLastTick.angle = data.angle;
        if (data.point !== undefined) this.myLastTick.point = data.point;

        if (
            (this.myLastTick.x < 0 || this.myLastTick.x > STAGE_SIZE) ||
            (this.myLastTick.y < 0 || this.myLastTick.y > STAGE_SIZE)
        ) {
            this.destroy('outmap');
        }
    }
    static getDefaultLastTick() {
        
        return {
            id: null,
            x: Math.ceil(Math.random() * STAGE_SIZE * CREATE_PLAYER_SIZE_PER_STAGE) + CREATE_PLAYER_MARGIN_PER_STAGE,
            y: Math.ceil(Math.random() * STAGE_SIZE * CREATE_PLAYER_SIZE_PER_STAGE) + CREATE_PLAYER_MARGIN_PER_STAGE,
            angle: Math.round(Math.random() * 360),
            point: START_POINT
        };
    }
    destroy(cause = 'conflict') {
        // console.log(`remove(${cause}) '${this.id}' worm in '${this.roomId}'`);
        if (this.roomId !== null) {

            sockIO.send('delete_worm', this.id, { roomId: this.roomId });

            // 룸 내 플레이어 정보 모두 제거
            common.roomList[this.roomId].leave(this);
        }

        // 플레이어 리스트 제거
        delete common.playerList[this.id];
    }
    static setRank(userIdx, name, point) {
        return new Promise(async function (resolve, reject) {
            let q = null, v = [];

            let savedRank = await mysql.query(
                'SELECT * FROM `rank` WHERE userIdx = ?;'
            , [userIdx]); //, { isReturnedOne: true });

            if (savedRank.length > 0) {
                if (savedRank[0].point < point) {
                    q = 'UPDATE `rank` SET point = ? WHERE userIdx = ?;'
                    v = [point, userIdx];
                }
            } else {
                q = 'INSERT INTO `rank`(userIdx, name, point) VALUES (?, ?, ?);'
                v = [userIdx, name, point];
            }
            q !== null && await mysql.query(q, v);
            
            const rtnObj = (await mysql.query(
                'SELECT * FROM `rank` ORDER BY point DESC limit 10;'
            )).map((rtn, idx) => {
                return {
                    rank: idx + 1,
                    name: rtn.name,
                    point: rtn.point
                }
            });
            resolve(rtnObj);
        })
    }
}

const self = Player;
module.exports = Player;