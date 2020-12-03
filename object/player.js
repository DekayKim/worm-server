const common = require('../handler/common.js');
const Utils = require('../object/utils.js');
const sockIO = require('../handler/socket.js');

const AI_NAME_LIST = require('../ainame.json');

const START_POINT = 0;
const STAGE_SIZE = 10000;
const STAGE_PERCENT = 0.6;
const STAGE_MARGIN = STAGE_SIZE * (1 - STAGE_PERCENT) / 2;


class Player {
    constructor(playerList, id, option = {}) {
        this.id = id || Utils.getNewId(playerList, '', 1000);
        
        this.socketId = option.socketId || null;
        this._aiHandler = option._aiHandler || null;
        this.isAI = option.isAI;
        // this.roomId = option.roomId; //* room join시 입력됨
        this.name = option.name ||
            AI_NAME_LIST[Math.floor(Math.random() * AI_NAME_LIST.length)] ||
            this.id.toUpperCase()
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
                target: null
            }
        }
        
        this.myLastTick = option.lastTick;
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
        }
    }
    static getDefaultLastTick() {
        
        return {
            id: null,
            x: Math.ceil(Math.random() * STAGE_SIZE * STAGE_PERCENT) + STAGE_MARGIN,
            y: Math.ceil(Math.random() * STAGE_SIZE * STAGE_PERCENT) + STAGE_MARGIN,
            point: START_POINT
        };
    }
    destroy(cause = 'conflict') {
        console.log(`remove(${cause}) '${this.id}' worm in '${this.roomId}'`);
        if (this.roomId !== null) {

            sockIO.send(
                sockIO.to(this.roomId),
                'delete_worm', this.id
            );

            // 룸 내 플레이어 정보 모두 제거
            common.roomList[this.roomId].leave(this.id, this.socketId);
        }

        // 플레이어 리스트 제거
        delete common.playerList[this.id];
    }
}

const self = Player;
module.exports = Player;