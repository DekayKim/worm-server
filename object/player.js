const Utils = require('../object/utils.js');
const sockIO = require('../handler/socket.js');

const START_POINT = 0;
const STAGE_SIZE = 100;
const STAGE_PERCENT = 0.8;
const STAGE_MARGIN = Math.ceil(STAGE_SIZE * (1 - STAGE_PERCENT) / 2);


class Player {
    constructor(playerList, id, option = {}) {
        this.id = id || Utils.getNewId(playerList);
        
        this.socketId = option.socketId || null;
        this._aiHandler = option._aiHandler || null;
        this.isAI = option.isAI;
        // this.roomId = option.roomId; //* room join시 입력됨
        this.name = option.name;
        
        this.myLastTick = option.lastTick;
        this.myLastTick.id = this.id;
        this.myLastTick.name = this.name;
        this.myLastTick.isAI = this.isAI;
    }

    setCurrent(data) {
        this.myLastTick.x = data.x || this.myLastTick.x;
        this.myLastTick.y = data.y || this.myLastTick.x;
        this.myLastTick.point = data.point || this.myLastTick.point;
    }
    static getDefaultLastTick() {
        
        return {
            id: null,
            name: null,
            isAI: null,
            x: Math.ceil(Math.random() * STAGE_SIZE * STAGE_PERCENT) + STAGE_MARGIN,
            y: Math.ceil(Math.random() * STAGE_SIZE * STAGE_PERCENT) + STAGE_MARGIN,
            point: START_POINT
        };
    }
    destroy(roomList, playerList) {
        console.log(`remove '${this.id}' worm in '${this.roomId}'`);
        if (this.roomId !== null) {

            sockIO.send(
                sockIO.to(this.roomId),
                'delete_worm', this.id
            );

            // 룸 내 플레이어 정보 모두 제거
            delete roomList[this.roomId].lastTick[this.id];
            roomList[this.roomId].playerList.splice(
                roomList[this.roomId].playerList.findIndex(playerData => playerData.id == this.id)
            , 1);
        }

        // 플레이어 리스트 제거
        delete playerList[this.id];
    }
}

const self = Player;
module.exports = Player;