const Utils = require('../object/utils.js');
const sockIO = require('../handler/socket.js');
const Player = require('../object/player.js');

const ROOM_PLAYER_CAPACITY = 100;
const ROOM_AI_CAPACITY = 99;

const FOOD_CAPACITY = 1000;
const FOOD_COUNT_PER_PLAYER = 2;

const FOOD_CREATE_PLAYER_RANGE = 600;
const FOOD_CREATE_MAP_RANGE = 10000;
const FOOD_CREATE_MAX_AMOUNT = 10;
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
const AI_SPEED_PER_FRAME = 200 / 60; // 초당 10px
const AI_DEGREE_CHANGE_TIME = 1000;

const TAILING_POINT_PER_BOOST = 2;
const SUBTRACT_POINT_PER_BOOST = 5;

class Room {
    constructor(roomList, id) {
        this.id = id || Utils.getNewId(roomList);
        this.lastTick = {};
        this.playerList = [];
        this.foodList = {};

        // this.createAI(common.playerList);
        this.createFood(true);
    }
    static setRoom(roomList, playerList, socketList, sessionId, userObj, type) { // , roomId = null
        return new Promise(async function (resolve, reject) { try {
            let roomId = self.getNotFull(roomList);
    
            if (roomId === false) {
                console.log("creating room...");
                roomId = Utils.getNewId(roomList);
                roomList[roomId] = new self(roomList, roomId, sockIO);
                
                roomList[roomId].createAI(playerList);
            }
            roomList[roomId].join(userObj);
                
            socketList[sessionId].join(roomId);
    
            resolve(roomId);
        } catch (error) {
            reject(error);
        }})
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
        // let res =  Math.ceil(Math.random() * FOOD_CREATE_MAX_AMOUNT);
        // return (res > FOOD_CREATE_MAX_AMOUNT) ? FOOD_CREATE_MAX_AMOUNT : a;
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
            sockIO.send(sockIO.to(this.id), 'new_food', foodObj);
        }
        console.log(`Food+Wreck: ${Object.keys(this.foodList).length} (+${createCount})`);
        return rtn;
    }

    createFood(isInit = false) {
        let testCounter = 0;

        if (isInit) {
            for (let foodIdx = 0; foodIdx < FOOD_CAPACITY; foodIdx++) {
                const foodObj = {
                    id: Utils.getNewId(this.foodList),
                    x: Math.ceil(Math.random() * FOOD_CREATE_MAP_RANGE),
                    y: Math.ceil(Math.random() * FOOD_CREATE_MAP_RANGE),
                    amount: this.getFoodAmount()
                };
                this.foodList[foodObj.id] = foodObj;
                sockIO.send(sockIO.to(this.id), 'new_food', foodObj);
                testCounter++
            }
        } else {
            if (Object.keys(this.foodList).length >= FOOD_CAPACITY) return;

            this.playerList.forEach(playerData => {
                let {x, y} = playerData.myLastTick;
    
                for (let foodIdx = 0; foodIdx < FOOD_COUNT_PER_PLAYER; foodIdx++) {
                    let deltaX = Math.ceil(Math.random() * FOOD_CREATE_PLAYER_RANGE) - FOOD_CREATE_PLAYER_RANGE / 2;
                    deltaX += (deltaX > 0) ? FOOD_CREATE_PLAYER_RANGE : -FOOD_CREATE_PLAYER_RANGE;
                    x = parseInt(x + deltaX);
                    x = (x > FOOD_CREATE_MAP_RANGE) ? FOOD_CREATE_MAP_RANGE : (x < 0) ? 0 : x;

                    let deltaY = Math.ceil(Math.random() * FOOD_CREATE_PLAYER_RANGE) - FOOD_CREATE_PLAYER_RANGE / 2;
                    deltaY += (deltaY > 0) ? FOOD_CREATE_PLAYER_RANGE : -FOOD_CREATE_PLAYER_RANGE;
                    y = parseInt(y + deltaY);
                    y = (y > FOOD_CREATE_MAP_RANGE) ? FOOD_CREATE_MAP_RANGE : (y < 0) ? 0 : y;

                    // console.log(`${playerData.myLastTick.x} > ${x} / ${playerData.myLastTick.y} > ${y}`);

                    const foodObj = {
                        id: Utils.getNewId(this.foodList),
                        x, y,
                        amount: this.getFoodAmount()
                    };
                    this.foodList[foodObj.id] = foodObj;
                    sockIO.send(sockIO.to(this.id), 'new_food', foodObj);
                    testCounter++
                }
            })
        }
        console.log(`Food: ${Object.keys(this.foodList).length} (+${testCounter})`);
    }

    createAI(playerList) {
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
            const playerData = new Player(playerList, null, {
                socketId: null,
                isAI: true,
                lastTick: Player.getDefaultLastTick(),
            });
            const playerId = playerData.id;
            playerList[playerId] = playerData;

            playerList[playerId].setCurrent({
                x: Math.ceil(Math.random() * FOOD_CREATE_MAP_RANGE), // 400, //
                y: Math.ceil(Math.random() * FOOD_CREATE_MAP_RANGE), // 400, //
                // point: data.name.indexOf('p') === 0 ? Number(data.name.substr(1)) :0 
            })
            this.join(playerList[playerId]);

            sockIO.send(sockIO.to(this.id), 'new_worm', Object.assign(
                { name: playerList[playerId].name },
                playerList[playerId].myLastTick
            ));
        }
        return isCreated;
    }
    convertAI() {

    }
    controlAI(dtms) {
        for (let idx = 0; idx < this.playerList.length; idx++) {
            const playerData = this.playerList[idx];
            if (!playerData.isAI) continue;

            const thatDegree = playerData.aiConf.degree;
            if (thatDegree.timer > AI_DEGREE_CHANGE_TIME) {
                if (playerData.aiConf.target === null) {
                    const targetList = Object.values(this.foodList)
                        .filter(foodData => 
                            Math.abs(playerData.myLastTick.x - foodData.x) < 1000 &&
                            Math.abs(playerData.myLastTick.y - foodData.y) < 1000
                        );
                    playerData.aiConf.target = targetList[Math.floor(Math.random() * targetList.length)];
                }
                thatDegree.timer = Math.round(Math.random() * AI_DEGREE_CHANGE_TIME / 2); // 0~1초 이내
                // thatDegree.timer = 0;

                // playerData.aiConf.target을 반영한 dest 구성
                // ! 충돌 시 playerData.aiConf.target null 처리 필수
                if (playerData.aiConf.target) {
                    const targetDest = 90 - (Math.atan2(
                        playerData.aiConf.target.y - playerData.myLastTick.y,
                        playerData.aiConf.target.x - playerData.myLastTick.x,
                    ) / Math.PI * 180);

                    if (Math.abs(thatDegree.dest - targetDest) <= 45) {
                        thatDegree.dest = targetDest
                    } else {
                        thatDegree.dest += (thatDegree.dest - targetDest > 0) ? -45 : 45;
                    }
                    // console.log(`set target dest(${thatDegree.target.x}/${thatDegree.target.y})`, thatDegree.dest)
                } else {
                    thatDegree.dest += Math.round(Math.random() * 90) - 45; // 45도 이내 변화
                }
                // console.log('AI changing degree....', `${thatDegree.value} > ${thatDegree.dest}`);
            } else {
                thatDegree.timer += dtms;
            }

            // 좌우 1도 변경을 줌
            thatDegree.value += (thatDegree.value < thatDegree.dest) ? 1 : -1;

            // Radian으로 변경해서 속도 반영
            const xV = Math.sin(thatDegree.value * Math.PI / 180) * (AI_SPEED_PER_FRAME);
            const yV = Math.cos(thatDegree.value * Math.PI / 180) * (AI_SPEED_PER_FRAME);

            const data = {
                id: playerData.id,
                x: playerData.myLastTick.x + xV,
                y: playerData.myLastTick.y + yV
            };
            playerData.setCurrent(data);
        }
    }
    setAIHandle(socketList, dyingSocket = null) {
        const aiList = this.playerList.filter(playerData => playerData.isAI);
        const userList = this.playerList.filter(playerData => !playerData.isAI);
        const aiCountPerUser = Math.ceil(aiList.length / (this.playerList.length - aiList.length));

        let aiIdx = 0;
        console.log('userList/aiList...', userList.length, aiList.length)
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
            sockIO.send(eachSockHdlr, 'ai', []);
            // sockIO.send(eachSockHdlr, 'ai', this.getAIHandle(userId));
        })
        if (dyingSocket) {
            sockIO.send(dyingSocket, 'ai', []);
        }
        console.log('setAIHandle 종료')
    }
    getAIHandle(userId) {
        return this.playerList
            .filter(playerData => playerData._aiHandler === userId)
            .map(playerData => playerData.id)
        ;
    }

}

const self = Room;
module.exports = Room;