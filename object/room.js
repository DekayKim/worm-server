const Utils = require('../object/utils.js');
const Player = require('../object/player.js');

const ROOM_PLAYER_CAPACITY = 33;
const ROOM_AI_CAPACITY = 30;
const FEED_CAPACITY = 1000;
const FEED_COUNT_PER_PLAYER = 2;
const FEED_CREATE_PLAYER_RANGE = 600;
const FEED_CREATE_INIT_RANGE = 10000;
const FEED_CREATE_MAX_AMOUNT = 10;
const FOOD_PERCENT = Object.entries({
    '1': 0.2,
    '2': 0.325,
    '3': 0.45,
    '4': 0.55,
    '5': 0.65,
    '6': 0.75,
    '7': 0.85,
    '8': 0.9,
    '9': 0.95,
    '10': 1.0
});
const TAILING_POINT_PER_BOOST = 2;
const SUBTRACT_POINT_PER_BOOST = 5;

class Room {
    constructor(roomList, id, socketHdlr) {
        this.id = id || Utils.getNewId(roomList);
        this.lastTick = {};
        this.playerList = [];
        this.foodList = {};
        this.socketHdlr = socketHdlr;

        // this.createAI(common.playerList);
        this.createFood(true);
    }

    static getNotFull(roomList) {
        const roomEntry = Object.entries(roomList)
            .find(([roomId, roomData]) => 
                roomData.playerList.filter(playerData => !playerData.isAI).length <
                ROOM_PLAYER_CAPACITY - ROOM_AI_CAPACITY
            );

        return roomEntry ? roomEntry[0] : false;
    }

    join(playerObj) {
        playerObj.roomId = this.id;
        this.playerList.push(playerObj);
        
        this.lastTick[playerObj.id] = playerObj.myLastTick;
    }

    getFoodAmount() {
        // let res =  Math.ceil(Math.random() * FEED_CREATE_MAX_AMOUNT);
        // return (res > FEED_CREATE_MAX_AMOUNT) ? FEED_CREATE_MAX_AMOUNT : a;
        let nowper = Math.random();
        return Number(FOOD_PERCENT.find((am, per) => nowper < per)[0]);
    }
    
    createWreck(amount, bodies) {
        const rtn = (amount == 'tailing') ?  SUBTRACT_POINT_PER_BOOST : null;
        amount = (amount == 'tailing') ? TAILING_POINT_PER_BOOST : amount;

        let createCount;
        for (createCount = 0; createCount < bodies.length; createCount++) {

            const foodObj = {
                id: Utils.getNewId(this.foodList),
                x: bodies[createCount].x + Math.floor(Math.random() * 40),
                y: bodies[createCount].y + Math.floor(Math.random() * 40),
                // amount: 1 + additionalAmount
                amount: Math.ceil(Math.random() * SUBTRACT_POINT_PER_BOOST)
            };
            this.foodList[foodObj.id] = foodObj;
            this.socketHdlr.to(this.id).emit(`new_food`, Utils.ec(foodObj));
        }
        console.log(`Food+Wreck: ${Object.keys(this.foodList).length} (+${createCount})`);
        return rtn;
    }

    createFood(isInit = false) {
        let testCounter = 0;

        if (isInit) {
            for (let foodIdx = 0; foodIdx < FEED_CAPACITY; foodIdx++) {
                const foodObj = {
                    id: Utils.getNewId(this.foodList),
                    x: Math.ceil(Math.random() * FEED_CREATE_INIT_RANGE),
                    y: Math.ceil(Math.random() * FEED_CREATE_INIT_RANGE),
                    amount: this.getFoodAmount()
                };
                this.foodList[foodObj.id] = foodObj;
                this.socketHdlr.to(this.id).emit(`new_food`, Utils.ec(foodObj));
                testCounter++
            }
        } else {
            if (Object.keys(this.foodList).length >= FEED_CAPACITY) return;

            this.playerList.forEach(playerData => {
                let {x, y} = playerData.myLastTick;
    
                for (let foodIdx = 0; foodIdx < FEED_COUNT_PER_PLAYER; foodIdx++) {
                    let deltaX = Math.ceil(Math.random() * FEED_CREATE_PLAYER_RANGE) - FEED_CREATE_PLAYER_RANGE / 2;
                    deltaX += (deltaX > 0) ? FEED_CREATE_PLAYER_RANGE : -FEED_CREATE_PLAYER_RANGE;
                    x = parseInt(x + deltaX);
                    x = (x > FEED_CREATE_INIT_RANGE) ? FEED_CREATE_INIT_RANGE : (x < 0) ? 0 : x;

                    let deltaY = Math.ceil(Math.random() * FEED_CREATE_PLAYER_RANGE) - FEED_CREATE_PLAYER_RANGE / 2;
                    deltaY += (deltaY > 0) ? FEED_CREATE_PLAYER_RANGE : -FEED_CREATE_PLAYER_RANGE;
                    y = parseInt(y + deltaY);
                    y = (y > FEED_CREATE_INIT_RANGE) ? FEED_CREATE_INIT_RANGE : (y < 0) ? 0 : y;

                    // console.log(`${playerData.myLastTick.x} > ${x} / ${playerData.myLastTick.y} > ${y}`);

                    const foodObj = {
                        id: Utils.getNewId(this.foodList),
                        x, y,
                        amount: this.getFoodAmount()
                    };
                    this.foodList[foodObj.id] = foodObj;
                    this.socketHdlr.to(this.id).emit(`new_food`, Utils.ec(foodObj));
                    testCounter++
                }
            })
        }
        console.log(`Food: ${Object.keys(this.foodList).length} (+${testCounter})`);
    }

    createAI(playerList, x, y) {
        let isCreated = false;
        for (let idx = 0; idx < ROOM_AI_CAPACITY; idx++) {
            console.log('check AI cap..',
                `현재 AI수: ${this.playerList.filter(playerData => playerData.isAI).length}\n`,
                `유저수 제한: ${this.playerList.length >= ROOM_PLAYER_CAPACITY}\n`,
                `AI수 제한: ${this.playerList.filter(playerData => playerData.isAI).length >= ROOM_AI_CAPACITY}\n`
            )
            if (this.playerList.length >= ROOM_PLAYER_CAPACITY) break;
            if (this.playerList.filter(playerData => playerData.isAI).length >= ROOM_AI_CAPACITY) break;

            isCreated = true;
            const userId = Utils.getNewId(playerList);

            playerList[userId] = new Player(playerList, userId, {
                socketId: null,
                isAI: true,
                name: userId.toUpperCase(),
                lastTick: Player.getDefaultLastTick(),
            });
            playerList[userId].setCurrent({
                x: Math.ceil(Math.random() * FEED_CREATE_INIT_RANGE),
                y: Math.ceil(Math.random() * FEED_CREATE_INIT_RANGE),
                // point: data.name.indexOf('p') === 0 ? Number(data.name.substr(1)) :0 
            })
            this.join(playerList[userId]);
            
            this.socketHdlr.to(this.id).emit('new_worm', Utils.ec(Object.assign(
                { name: playerList[userId].name },
                playerList[userId].myLastTick
            )));
        }
        return isCreated;
    }
    convertAI() {

    }
    setAIHandle(socketList, dyingSocket = null) {
        const aiList = this.playerList.filter(playerData => playerData.isAI);
        const userList = this.playerList.filter(playerData => !playerData.isAI);
        const aiCountPerUser = Math.ceil(aiList.length / (this.playerList.length - aiList.length));

        let aiIdx = 0;
        console.log('userList ;leng', userList.length, aiList.length)
        userList.map(userData => {
            let aiCount = 0;
            // 유저당AI할당수보다 적고, 할당할 AI가 남아있을 경우
            while (aiCount++ < aiCountPerUser &&  aiIdx < aiList.length) {
                aiList[aiIdx++]._aiHandler = userData.id;
            }
            return {
                eachSockHdlr: socketList[userData.socketId],
                userId: userData.id
            };
        }).forEach(({ eachSockHdlr, userId }) => { // 재분배된 AI 알림
            console.log(`할당된 AI: ${userId} > ${this.getAIHandle(userId).length}EA`);
            eachSockHdlr.emit('ai', Utils.ec(this.getAIHandle(userId)) );
        })
        if (dyingSocket) {
            dyingSocket.emit('ai', Utils.ec([]));
        }
        console.log('setAIHandle 종료')
    }
    getAIHandle(userId) {
        return this.playerList
            .filter(playerData => playerData._aiHandler === userId)
            // .map(playerData => playerList[playerData].myLastTick)
        ;
    }

}

const self = Room;
module.exports = Room;