const common = require('../handler/common.js');
const Utils = require('../object/utils.js');
const sockIO = require('../handler/socket.js');

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
        
        this.socketId = option.socketId || null;
        this._aiHandler = option._aiHandler || null;
        this.isAI = option.isAI;
        // this.roomId = option.roomId; //* room join시 입력됨
        this.name = (option.name === null) ?
            AI_NAME_LIST[Math.floor(Math.random() * AI_NAME_LIST.length)] :
            option.name
        ;
        this.color = option.color || Utils.getRandomColor();

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
        if (data.point !== undefined) this.myLastTick.point = data.point;

        if (
            (this.myLastTick.x < 0 || this.myLastTick.x > STAGE_SIZE) ||
            (this.myLastTick.y < 0 || this.myLastTick.y > STAGE_SIZE)
        ) {
            this.destroy('outmap');
        // } else if (data.point) {
        //     common.roomList[this.roomId].checkRank();
        }
    }
    static getDefaultLastTick() {
        
        return {
            id: null,
            x: Math.ceil(Math.random() * STAGE_SIZE * CREATE_PLAYER_SIZE_PER_STAGE) + CREATE_PLAYER_MARGIN_PER_STAGE,
            y: Math.ceil(Math.random() * STAGE_SIZE * CREATE_PLAYER_SIZE_PER_STAGE) + CREATE_PLAYER_MARGIN_PER_STAGE,
            point: START_POINT
        };
    }
    destroy(cause = 'conflict') {
        // console.log(`remove(${cause}) '${this.id}' worm in '${this.roomId}'`);
        if (this.roomId !== null) {

            sockIO.send('delete_worm', this.id, { roomId: this.roomId });

            // 룸 내 플레이어 정보 모두 제거
            common.roomList[this.roomId].leave(this.id, this.socketId);
        }

        // 플레이어 리스트 제거
        delete common.playerList[this.id];
    }
}

const self = Player;
module.exports = Player;