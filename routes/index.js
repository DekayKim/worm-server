var express = require('express');
var router = express.Router();
var md = require('markdown-it')('commonmark');
var fs = require('fs');

const common = require('../handler/common.js');
const Utils = require('../object/utils.js');
const sockIO = require('../handler/socket.js');

const Room = require('../object/room.js');
const Player = require('../object/player.js');

const {
    TAILING_POINT_PER_BOOST,
    SUBTRACT_POINT_PER_BOOST
} = require('../handler/define.js');

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {
        title: 'Express'
    });
});
router.get('/api', function (req, res, next) {
    res.render('md', {
        title: 'API List',
        mdText: md.render(
            fs.readFileSync('API.md', 'utf8')
        )
    });
});


//* socket
sockIO.on('connection', async (socket) => {
    let socketId = Utils.getNewId(common.socketList); // socket.id;
    console.log("[WORMIO] a user connected", socketId);
    common.socketList[socketId] = socket;

    let userId = null;
    let roomId = null;

    // socket.emit('schema', common.SCHEMA_LIST);
    // socket.on("auth", function (data) {}); // console.log('auth', data);

    socket.on('message', async (message) => {
        [eventName, data] = sockIO.decode(null, message);

        //* Message Log
        switch (eventName) {
            case 'boost_start':
            case 'boost_ing':
            case 'boost_end':
            case 'tail_position':
            case 'eat':
                break;
            case 'position':
                if (common.playerList[data.id] && common.playerList[data.id].name == 'Ddd')
                    console.log(`got ${eventName}: `, data, new Date());
                break;
            case 'inbound':
                console.log(`got ${eventName}: `, data.requestId, data.responseId);
                break;
            case 'conflict':
                // console.log(`got ${eventName}: `, `dying player: ` + userId);
                break;
            default:
                console.log(`got ${eventName}: `, data);
                break;
        }

        //* Value check
        if (['enter'].includes(eventName) === false) {
            if (userId === null || roomId === null) return;
        }
        switch (eventName) {
            case 'inbound':
                if (!(data.requestId in common.playerList)) return;
                break;
            case 'position':
            case 'boost_start':
            case 'boost_ing':
            case 'boost_end':
                if (!(userId in common.playerList)) return `no-act pos ${userId}`;
                break;
            case 'tail_position':
            case 'conflict':
                if (!(data.id in common.playerList)) return;
                break;
            case 'eat':
                if (!(data.wormId in common.playerList)) return;
                break;
        }

        //* Event Split
        switch (eventName) {
            case 'enter': //* 게임 시작
                // 우선 로그인이 없으니 게스트만 허용
                if (userId === null) {
                    userId = Utils.getNewId(common.playerList, '', 1000); //, 'guest:');
                }

                // 이후 플레이어 생성 시작
                common.playerList[userId] = new Player(userId, {
                    socketId,
                    isAI: false,
                    name: data.name,
                    color: data.color,
                    lastTick: Player.getDefaultLastTick(),
                });

                // 룸 세팅 (join)
                roomId = await Room.setRoom(common.playerList[userId], 'game');
                //! 임시 정의
                common.playerList[userId].setCurrent({
                    x: 15000,
                    y: 15000,
                    point: data.name.indexOf('p') === 0 ? Number(data.name.substr(1)) :0
                })

                console.log(
                    // Object.values(common.roomList[roomId].lastTick).map(e => `id(${e.id}) / name(${e.name}) / isAI(${e.isAI})`),
                    `현재 '${roomId}' 방 인원: ${Object.values(common.roomList[roomId].lastTick).length}`
                )

                sockIO.send('enter', {
                    myId: userId,
                    player: Object.values(common.roomList[roomId].lastTick).map(e =>
                        Object.assign({
                            name: common.playerList[e.id].name,
                            color: common.playerList[e.id].color
                        }, e)
                    ),
                    food: Object.values(common.roomList[roomId].foodList).map(e =>
                        Object.assign({
                            color: e.color
                        }, e.tick)
                    ),
                    rank: [] //!!
                }, { mysock: socket });

                // AI 할당 및 재분배 알림
                common.roomList[roomId].setAIHandle(common.socketList);

                sockIO.send('new_worm', 
                    [Object.assign(
                        { name: data.name, color: data.color, delay: 0 },
                        common.playerList[userId].myLastTick
                    )],
                    { roomId, mysock: socket }
                );
                break;

            case 'bound_check':
                sockIO.send('bound_check', data, { roomId, mysock: socket });
                break;

            case 'inbound':
                sockIO.send('inbound', data,
                    { mysock: common.socketList[common.playerList[data.requestId].socketId] }
                );
                break;

            case 'position':
                //! 업데이트 검증 필요함

                common.playerList[data.id].setCurrent(data);
                break;

            case 'tail_position':
                common.roomList[roomId].createWreck('tailing', [data], common.playerList[data.id].color);
                break;

            case 'eat':
                try {
                    //! 업데이트 검증 필요함

                    // 이미 해당 food를 누군가 먹었을 경우 없던 일로 처리
                    if (common.roomList[roomId].foodList[data.foodId] === undefined) return;

                    const foodAmount = common.roomList[roomId].foodList[data.foodId].tick.amount;
                    delete common.roomList[roomId].foodList[data.foodId];

                    sockIO.send('delete_food', [data], { roomId, mysock: socket });

                    // setTimeout 이후에는 해당 지렁이가 없을 수 있음
                    if (data.wormId in common.playerList) {
                        common.playerList[data.wormId].setCurrent({
                            point: common.playerList[data.wormId].myLastTick.point + foodAmount
                        });

                        sockIO.send('point', {
                            id: data.wormId,
                            point: common.playerList[data.wormId].myLastTick.point
                        }, { roomId, mysock: socket });
                    }
                } catch (error) {
                    console.error(error);
                }
                break;

            case 'boost_start':
                sockIO.send('boost_start', { id: userId }, { roomId, mysock: socket });
                break;

            case 'boost_ing':
                if (common.playerList[userId].myLastTick.point - SUBTRACT_POINT_PER_BOOST < 0) return;

                common.roomList[roomId].createWreck('tailing', [data], common.playerList[userId].color);

                common.playerList[userId].setCurrent({
                    point: common.playerList[userId].myLastTick.point - SUBTRACT_POINT_PER_BOOST
                });
                break;

            case 'boost_end':
                sockIO.send('boost_end', { id: userId }, { roomId, mysock: socket });
                break;

            case 'conflict':
                try {
                    const looserId = data.id;
                    const bodies = data.looserBodies;
                    const amount = common.playerList[looserId].myLastTick.point;

                    // bodies 타입 체크
                    if (!(bodies && bodies.constructor === Array)) return;

                    // food 뿌리기
                    common.roomList[roomId].createWreck(amount, bodies, common.playerList[looserId].color);

                    // lose 웜 제거
                    common.playerList[looserId].destroy();

                    // AI가 아니라 플레이어 본인이라면 데이터 제거
                    if (looserId === userId) {
                        // AI 할당 및 재분배 알림
                        common.roomList[roomId].setAIHandle(common.socketList, socket);

                        userId = null;
                        roomId = null;
                    } else {
                        common.roomList[roomId].setAIHandle(common.socketList);
                    }
                } catch (error) {
                    console.error(error);
                }
                break;

            default:
                break;
        }
    });
    
    socket.on('close', function close(reason) {
        if (userId === null || roomId === null) return;
        if (!(userId in common.playerList)) return;
        console.log(`[WORMIO] ${userId} user disconnected: `, socketId, reason);

        // common.playerList[userId].convertAI();
        common.playerList[userId].destroy('disconnect');
        common.roomList[roomId].setAIHandle(common.socketList); // AI 할당 및 재분배 알림

        delete common.socketList[socketId];
    });
});

module.exports = router;