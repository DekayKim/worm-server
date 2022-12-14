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
    DEBUG_OPTION,
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

router.get('/scheme', function (req, res, next) {
    res.json(common.SCHEMA_LIST);
});


//* socket
sockIO.on('connection', async (socket) => {
    let socketId = Utils.getNewId(common.socketList); // socket.id;
    console.log("[WORMIO] a user connected", socketId);
    common.socketList[socketId] = socket;

    let userId = null;
    let roomId = null;
    let userIdx = null;

    // sockIO.send('test', {x:'testData'}, { encode: true, mysock: socket });
    // socket.on("auth", function (data) {}); // console.log('auth', data);

    socket.on('message', async (message) => {
        // console.log('!', message);
        // eventName = message.slice(0, 1);
        // data = message.slice(1);
        [eventName, data] = sockIO.decode(message);

        //* Message Log
        switch (eventName) {
            case 'boost_start':
            case 'boost_ing':
            case 'boost_end':
            case 'position_all':
            case 'tail_position':
            case 'eat':
                break;
            case 'angle':
            case 'position':
                // if (common.playerList[data.id] && common.playerList[data.id].name == 'Ddd')
                //     console.log(`got ${eventName}: `, data, new Date());
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
            case 'angle':
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
            case 'enter': //* ?????? ??????
                // ?????????????????? ?????? ID?????? ??????????????? ???????????? axios ??????
                if (data.userId === 0) {
                    userId = Utils.getNewId(common.playerList, '', 1000); //, 'guest:');
                } else {
                    userId = 'among_' + data.userId;
                    userIdx = data.userId;
                }

                // ?????? ???????????? ?????? ??????
                common.playerList[userId] = new Player(userId, {
                    socketId,
                    isAI: false,
                    isMobile: data.isMobile,
                    name: data.name,
                    color: data.color,
                    lastTick: Player.getDefaultLastTick(),
                });

                // ??? ?????? (join)
                roomId = await Room.setRoom(common.playerList[userId], 'game');
                if (DEBUG_OPTION.USER_SET_POS) {
                    common.playerList[userId].setCurrent(Object.assign(DEBUG_OPTION.USER_SET_POS, {
                        point: data.name.indexOf('p') === 0 ? Number(data.name.substr(1)) : 0
                    }))
                }

                console.log(
                    // Object.values(common.roomList[roomId].lastTick).map(e => `id(${e.id}) / name(${e.name}) / isAI(${e.isAI})`),
                    `?????? '${roomId}' ??? ??????: ${Object.values(common.roomList[roomId].lastTick).length}`
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
                    )
                }, { mysock: socket });

                // AI ?????? ??? ????????? ??????
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

            case 'position': // ?????????
                //! ???????????? ?????? ?????????
                common.playerList[userId].setCurrent(data);
                break;

            case 'angle':
                //! ???????????? ?????? ?????????
                common.playerList[userId].setCurrent({ angle: data });
                break;

            case 'position_all': // ?????????
                sockIO.send('position_all',
                    Object.values(common.roomList[roomId].lastTick),
                    { mysock: socket }
                );
                break;

            case 'tail_position':
                common.roomList[roomId].createWreck('tailing', [data], common.playerList[data.id].color, data.id);
                break;

            case 'eat':
                try {
                    //! ???????????? ?????? ?????????

                    // ?????? ?????? food??? ????????? ????????? ?????? ?????? ?????? ??????
                    if (common.roomList[roomId].foodList[data.foodId] === undefined) return;

                    const foodAmount = common.roomList[roomId].foodList[data.foodId].tick.amount;
                    delete common.roomList[roomId].foodList[data.foodId];

                    sockIO.send('delete_food', [data], { roomId, mysock: socket });

                    // setTimeout ???????????? ?????? ???????????? ?????? ??? ??????
                    if (data.wormId in common.playerList) {
                        common.playerList[data.wormId].setCurrent({
                            point: common.playerList[data.wormId].myLastTick.point + foodAmount
                        });
                    }
                } catch (error) {
                    console.error(error);
                }
                break;

            case 'boost_start':
                common.playerList[userId].isBoosting = true;
                sockIO.send('boost_start', { id: userId }, { roomId, mysock: socket });
                break;

            case 'boost_ing':
                if (common.playerList[userId].myLastTick.point - SUBTRACT_POINT_PER_BOOST < 0) return;

                common.roomList[roomId].createWreck('tailing', [data], common.playerList[userId].color, userId);

                common.playerList[userId].setCurrent({
                    point: common.playerList[userId].myLastTick.point - SUBTRACT_POINT_PER_BOOST
                });
                break;

            case 'boost_end':
                common.playerList[userId].isBoosting = false;
                sockIO.send('boost_end', { id: userId }, { roomId, mysock: socket });
                break;

            case 'conflict':
                try {
                    const looserId = data.id;
                    const bodies = data.looserBodies;
                    const amount = common.playerList[looserId].myLastTick.point;
                    const userName = common.playerList[looserId].name; // userIdx ?????? ?????? setRank??? ??????

                    // bodies ?????? ??????
                    if (!(bodies && bodies.constructor === Array)) return;

                    // food ?????????
                    common.roomList[roomId].createWreck(amount, bodies, common.playerList[looserId].color);

                    // lose ??? ??????
                    common.playerList[looserId].destroy();

                    // AI??? ????????? ???????????? ??????????????? ????????? ??????
                    if (looserId === userId) {
                        // ????????? ???????????? ?????? ??????
                        if (userIdx !== null) {
                            await Player.setRank(userIdx, userName, amount);
                        }
                        Player.getRank(userIdx).then(record => {
                            record.best && sockIO.send('record_best', record.best, { mysock: socket });
                            sockIO.send('record_world', record.world, { mysock: socket });
                        });

                        // AI ?????? ??? ????????? ??????
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
        common.roomList[roomId].setAIHandle(common.socketList); // AI ?????? ??? ????????? ??????

        delete common.socketList[socketId];
    });
});

module.exports = router;