const common = require('../handler/common.js');
const Utils = require('../object/utils.js');
const sockIO = require('../handler/socket.js');
const Player = require('../object/player.js');
const Food = require('../object/food.js');

const {
    ONE_AI_WORM_DEBUG,
    TAILING_POINT_PER_BOOST, SUBTRACT_POINT_PER_BOOST,
    STAGE_SIZE, CREATE_FOOD_SIZE_PER_STAGE
} = require('../handler/define.js');
const CREATE_FOOD_MARGIN_PER_STAGE = STAGE_SIZE * (1 - CREATE_FOOD_SIZE_PER_STAGE) / 2;

const ROOM_PLAYER_CAPACITY = 130;
const ROOM_AI_CAPACITY = ONE_AI_WORM_DEBUG ? 1 : 100;

const FOOD_START_CAPACITY = 2000;
const FOOD_MIN_CAPACITY = 1000;
const FOOD_MAX_CAPACITY = 3000;
const FOOD_COUNT_PER_PLAYER = 3;
const FOOD_LIVE_TIME = 30 * 1000;

const FOOD_CREATE_PLAYER_RANGE = 600;
const FOOD_CREATE_MAX_AMOUNT = 10;
const FOOD_PERCENT = Object.entries({
    '1': 0.2,
    '2': 0.125,
    '3': 0.125,
    '4': 0.10,
    '5': 0.10,
    '6': 0.10,
    '7': 0.10,
    '8': 0.05,
    '9': 0.05,
    '10':0.05,
});
const AI_SPEED_PER_FRAME = 200 / 60; // 초당 10px
const AI_DEGREE_CHANGE_TIME = 1000;

const AI_BOOST_COOLTIME = 2000;
const AI_BOOST_CHANCE_PERCENT = 0.4;
const AI_BOOST_MAX_MAINTAIN_TIME = 5000;
const AI_BOOST_SPEED = AI_SPEED_PER_FRAME * 2;
const AI_BOOST_ING_TIME = 300;


class Room {
    constructor(roomList, id) {
        this.id = id || Utils.getNewId(roomList);
        this.lastTick = {};
        this.playerList = [];
        this.foodList = {};
        this.rank = [];
    }
    static setRoom(roomList, playerList, socketList, sessionId, userObj, type) { // , roomId = null
        return new Promise(async function (resolve, reject) { try {
            let roomId = self.getNotFull(roomList);
            // if (ONE_AI_WORM_DEBUG) roomId = false; // 매번 새로운 방 생성
    
            if (roomId === false) {
                console.log("creating room...");
                roomId = Utils.getNewId(roomList);
                roomList[roomId] = new self(roomList, roomId, sockIO);
                
                roomList[roomId].createFood(true);                
                roomList[roomId].createAI(true);
            }
            roomList[roomId].join(userObj);

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

    leave(userId, userSocketId) {
        delete this.lastTick[userId];

        let idx = this.playerList.findIndex(playerData => playerData.id == userId);
        if (idx === -1) console.error('not found worm in room_playerList: ', userId)
        this.playerList.splice(idx, 1);
    }

    getFoodAmount() {
        // let res =  Math.ceil(Math.random() * FOOD_CREATE_MAX_AMOUNT);
        // return (res > FOOD_CREATE_MAX_AMOUNT) ? FOOD_CREATE_MAX_AMOUNT : a;
        let nowper = Math.random(), calcper = 0;
        return Number(FOOD_PERCENT.find(([am, per]) => {
            calcper += per;
            return (nowper < calcper) ? true : false;
        })[0]);
    }
    
    createWreck(amount, bodies, color = null) {
        let createCount;
        const createList = [];
        for (createCount = 0; createCount < bodies.length; createCount++) {
            const foodId = Utils.getNewId(this.foodList);
            this.foodList[foodId] = new Food(foodId, {
                tick: {
                    x: bodies[createCount].x + Math.floor(Math.random() * 40),
                    y: bodies[createCount].y + Math.floor(Math.random() * 40),
                    amount: (amount == 'tailing') ? 
                        TAILING_POINT_PER_BOOST :
                        Math.ceil(Math.random() * SUBTRACT_POINT_PER_BOOST)
                },
                isWreck: true,
                color
            });
            createList.push(Object.assign({
                color: this.foodList[foodId].color
            }, this.foodList[foodId].tick));
        }
        sockIO.send('new_food', createList, { roomId: this.id });
        // console.log(`Wreck: ${Object.keys(this.foodList).length} (+${createCount})`);
    }

    createFood(isInit = false) {
        let createCount = 0;
        const createList = [];

        if (isInit) {
            for (let foodIdx = 0; foodIdx < FOOD_START_CAPACITY; foodIdx++) {
                const foodId = Utils.getNewId(this.foodList);
                this.foodList[foodId] = new Food(foodId, {
                    tick: {
                        x: Math.ceil(Math.random() * STAGE_SIZE * CREATE_FOOD_SIZE_PER_STAGE) + CREATE_FOOD_MARGIN_PER_STAGE,
                        y: Math.ceil(Math.random() * STAGE_SIZE * CREATE_FOOD_SIZE_PER_STAGE) + CREATE_FOOD_MARGIN_PER_STAGE,
                        amount: this.getFoodAmount()
                    },
                    isInit: true
                });
                createList.push(Object.assign({
                    color: this.foodList[foodId].color
                }, this.foodList[foodId].tick));
                createCount++
            }
        } else {
            if (Object.keys(this.foodList).length >= FOOD_MAX_CAPACITY) return;

            this.playerList.forEach(playerData => {
                let {x, y} = playerData.myLastTick;
    
                for (let foodIdx = 0; foodIdx < FOOD_COUNT_PER_PLAYER; foodIdx++) {
                    let deltaX = Math.ceil(Math.random() * FOOD_CREATE_PLAYER_RANGE) - FOOD_CREATE_PLAYER_RANGE / 2;
                    deltaX += (deltaX > 0) ? FOOD_CREATE_PLAYER_RANGE : -FOOD_CREATE_PLAYER_RANGE;
                    x = parseInt(x + deltaX);
                    x = (x > STAGE_SIZE) ? STAGE_SIZE : (x < 0) ? 0 : x;

                    let deltaY = Math.ceil(Math.random() * FOOD_CREATE_PLAYER_RANGE) - FOOD_CREATE_PLAYER_RANGE / 2;
                    deltaY += (deltaY > 0) ? FOOD_CREATE_PLAYER_RANGE : -FOOD_CREATE_PLAYER_RANGE;
                    y = parseInt(y + deltaY);
                    y = (y > STAGE_SIZE) ? STAGE_SIZE : (y < 0) ? 0 : y;

                    // console.log(`${playerData.myLastTick.x} > ${x} / ${playerData.myLastTick.y} > ${y}`);

                    const foodId = Utils.getNewId(this.foodList);
                    this.foodList[foodId] = new Food(foodId, {
                        tick: { x, y, amount: this.getFoodAmount() }
                    });
                    createList.push(Object.assign({
                        color: this.foodList[foodId].color
                    }, this.foodList[foodId].tick));
                    createCount++
                }
            })
        }
        sockIO.send('new_food', createList, { roomId: this.id });
        console.log(`Food: ${Object.keys(this.foodList).length} (+${createCount})`);
    }
    cleanOldFood() {
        const deleteList = [];
        Object.entries({
            'Food': Object.values(this.foodList).filter(e => 
                e.isWreck == false &&
                Date.now() - e.createDate > FOOD_LIVE_TIME
            ),
            'Wreck': Object.values(this.foodList).filter(e => 
                e.isWreck == true &&
                Date.now() - e.createDate > FOOD_LIVE_TIME
            )
        }).forEach(([expireName, expireList]) => {
            let testCounter = 0;

            for (let idx = 0; idx < expireList.length; idx++) {
                if (
                    expireList[idx].isWreck == false &&
                    Object.keys(this.foodList).length <= FOOD_MIN_CAPACITY
                ) break;
    
                delete this.foodList[expireList[idx].id];
                deleteList.push({ foodId: expireList[idx].id, wormId: 'n' })
                testCounter++;
            }
            console.log(`${expireName} delete... remain ${Object.values(this.foodList).length}EA (-${testCounter})`);
        })
        sockIO.send('delete_food', deleteList, { roomId: this.id });
    }

    createAI(isInit = false) {
        const createList = [];
        let isCreated = false;
        for (let idx = 0; idx < ROOM_AI_CAPACITY; idx++) {
            //! 빠르게 두명 접속할 경우 createList가 0이라서 더만듬...createList 임시저장필요
            // console.log('check AI cap.. ',
            //     `현재 AI수: ${this.playerList.filter(playerData => playerData.isAI).length + createList.length} /`,
            //     `유저수 제한: ${this.playerList.length >= ROOM_PLAYER_CAPACITY + createList.length} /`,
            //     `AI수 제한: ${this.playerList.filter(playerData => playerData.isAI).length + createList.length >= ROOM_AI_CAPACITY}`
            // )
            if (this.playerList.length + createList.length >= ROOM_PLAYER_CAPACITY) break;
            if (this.playerList.filter(playerData => playerData.isAI).length + createList.length >= ROOM_AI_CAPACITY) break;

            isCreated = true;
            const playerData = new Player(null, {
                socketId: null,
                isAI: true,
                name: null,
                lastTick: Player.getDefaultLastTick(),
            });

            createList.push(playerData);
        }
        const delayTerm = 9900 / createList.length;

        createList.forEach((playerData, idx) => {
            let delay;

            delay = idx * delayTerm;
            setTimeout(() => {
                playerData.initId();
                common.playerList[playerData.id] = playerData;
                ONE_AI_WORM_DEBUG && common.playerList[playerData.id].setCurrent({ x: 5200, y: 5200 });
                this.join(playerData);
                
                sockIO.send('new_worm',
                    [Object.assign(
                        { name: playerData.name, color: playerData.color, delay: 0 },
                        playerData.myLastTick
                    )],
                    { roomId: this.id }
                );
            }, delay);
        })
        console.log(`AI수..: ${this.playerList.filter(playerData => playerData.isAI).length} (+${createList.length})`);
        return isCreated;
    }
    convertAI() {

    }
    controlAI(dtms) {
        for (let idx = 0; idx < this.playerList.length; idx++) {
            const playerData = this.playerList[idx];
            if (!playerData.isAI) continue;

            // 부스터 체크
            const thatBoost = playerData.aiConf.boost;
            if (!thatBoost.isRunning && thatBoost.checkTime >= Date.now()) {
                if (
                    playerData.myLastTick.point - SUBTRACT_POINT_PER_BOOST > 0 &&
                    Math.random() <= AI_BOOST_CHANCE_PERCENT
                ) { // 부스트 성공
                    thatBoost.isRunning = true;
                    thatBoost.dropTimer = 0;
                    thatBoost.endTime = Date.now() + Math.round(Math.random() * AI_BOOST_MAX_MAINTAIN_TIME);
                    sockIO.send('boost_start', { id: playerData.id }, { roomId: this.id });
                }

                thatBoost.checkTime = Date.now() + AI_BOOST_COOLTIME - Math.round(Math.random() * AI_BOOST_COOLTIME * 0.2); // 쿨타임 20% 이내
            } else {
                thatBoost.dropTimer += dtms;

                if (thatBoost.isRunning) {
                    if (Date.now() >= thatBoost.endTime) {
                        thatBoost.isRunning = false;
                        thatBoost.endTime = null
                        sockIO.send('boost_end', { id: playerData.id }, { roomId: this.id });
                    }
                    // 드랍타이머 확인하여 드랍 또는 러닝 중지
                    else if (thatBoost.dropTimer >= AI_BOOST_ING_TIME) {
                        thatBoost.dropTimer = 0;
                        
                        if (playerData.myLastTick.point - SUBTRACT_POINT_PER_BOOST < 0) {
                            thatBoost.isRunning = false;
                            thatBoost.endTime = null
                            sockIO.send('boost_end', { id: playerData.id }, { roomId: this.id });
                        } else {
                            // 이놈을 컨트롤하는 AI핸들러가 있을 경우에만
                            common.playerList[playerData._aiHandler] &&
                            sockIO.send('tail_position',
                                { id: playerData.id },
                                { mysock: common.socketList[common.playerList[playerData._aiHandler].socketId] }
                            );

                            playerData.setCurrent({
                                point: playerData.myLastTick.point - SUBTRACT_POINT_PER_BOOST
                            });
                        }
                    }
                }
                
            }

            // 각도 정의
            const thatDegree = playerData.aiConf.degree;
            if (thatDegree.timer > AI_DEGREE_CHANGE_TIME) {
                if (
                    playerData.aiConf.target &&
                    Math.abs(playerData.aiConf.target.tick.x - playerData.myLastTick.x) < 10 &&
                    Math.abs(playerData.aiConf.target.tick.y - playerData.myLastTick.y) < 10
                ) {
                    playerData.aiConf.target = null
                }
                if (playerData.aiConf.target) {
                    const targetList = Object.values(this.foodList)
                        .filter(foodData => 
                            Math.abs(playerData.myLastTick.x - foodData.tick.x) < 1000 &&
                            Math.abs(playerData.myLastTick.y - foodData.tick.y) < 1000
                        );
                    playerData.aiConf.target = targetList[Math.floor(Math.random() * targetList.length)];
                }
                thatDegree.timer = Math.round(Math.random() * AI_DEGREE_CHANGE_TIME * 0.5); // 쿨타임 50% 이내

                // playerData.aiConf.target을 반영한 dest 구성
                // ! 충돌 시 playerData.aiConf.target null 처리 필수
                if (playerData.aiConf.target) {
                    const targetDest = 90 - (Math.atan2(
                        playerData.aiConf.target.tick.y - playerData.myLastTick.y,
                        playerData.aiConf.target.tick.x - playerData.myLastTick.x,
                    ) / Math.PI * 180);

                    if (Math.abs(thatDegree.dest - targetDest) <= 45) {
                        thatDegree.dest = targetDest
                    } else {
                        thatDegree.dest += (thatDegree.dest - targetDest > 0) ? -45 : 45;
                    }
                    // console.log(`set target dest(${playerData.aiConf.target.tick.x}/${playerData.aiConf.target.tick.y})`, thatDegree.dest)
                } else {
                    thatDegree.dest += Math.round(Math.random() * 90) - 45; // 45도 이내 변화
                }
                // console.log('AI changing degree....', `${thatDegree.value} > ${thatDegree.dest}`);
            } else {
                thatDegree.timer += dtms;
            }

            // 좌우 1도 변경을 줌
            thatDegree.value +=
                (Math.abs(thatDegree.value - thatDegree.dest) < 1) ? 0 :
                (thatDegree.value < thatDegree.dest) ? 1 :
                (thatDegree.value > thatDegree.dest) ? -1 :
                0;

            // Radian으로 변경해서 속도 반영
            const nowSpeed = thatBoost.isRunning ? AI_BOOST_SPEED : AI_SPEED_PER_FRAME;
            const xV = Math.sin(thatDegree.value * Math.PI / 180) * nowSpeed;
            const yV = Math.cos(thatDegree.value * Math.PI / 180) * nowSpeed;

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
        // console.log('userList/aiList...', userList.length, aiList.length)
        userList.map(userData => {
            // if (userData.name == 'Ddd') return {
            //     eachSockHdlr: socketList[userData.socketId],
            //     userId: userData.id
            // } ;
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
            // console.log(`할당된 AI: ${userId} > ${this.getAIHandle(userId).length}EA`);
            // sockIO.send('ai', [], { mysock: eachSockHdlr });
            sockIO.send('ai', this.getAIHandle(userId), { mysock: eachSockHdlr });
        })
        if (dyingSocket) {
            sockIO.send('ai', [], { mysock: dyingSocket });
        }
        // console.log('setAIHandle 종료')
    }
    getAIHandle(userId) {
        return this.playerList
            .filter(playerData => playerData._aiHandler === userId)
            .map(playerData => playerData.id)
        ;
    }

    // checkRank() {
    //     let nowRank = Object.values(this.lastTick)
    //         .sort((a, b) => a.point < b.point ? 1 : -1)
    //         .map(e => [e.id, e.point]).filter((e,i) => i < 10)
    //     ;

    //     for (let idx = 0; idx < this.rank.length; idx++) {
    //         if (this.rank[idx] !== nowRank[idx][0]) {
    //             // console.log('!!!!!!!!!!!!!!rank change', JSON.stringify(nowRank))
    //             sockIO.send(sockIO.to(this.id), 'rank', nowRank.map(e => e[0]));
    //             break;
    //         };
    //     }
    //     this.rank = nowRank.map(e => e[0]);
    // }

}

const self = Room;
module.exports = Room;