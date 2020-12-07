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
    console.log("[ROR] a user connected", socket.id);
    common.socketList[socket.id] = socket;

    let userId = null;
    let roomId = null;
    let socketId = socket.id;

    socket.prependAny((event, ...args) => {
        const data = sockIO.decode(event, args[0]);
        switch (event) {
            case 'boost_start':
            case 'boost_ing':
            case 'boost_end':
            case 'position':
            case 'tail_position':
            case 'eat':
                break;
            case 'inbound':
                console.log(`got ${event}: `, data.requestId, data.responseId);
                break;
            case 'conflict':
                // console.log(`got ${event}: `, `dying player: ` + userId);
                break;
            default:
                console.log(`got ${event}: `, data);
                break;
        }
    })
    socket.emit('schema', common.SCHEMA_LIST);

    // socket.on("auth", function (data) {}); // console.log('auth', data);


    //* 게임 시작
    socket.on('enter', async data => {
        data = sockIO.decode('enter', data);

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
        roomId = await Room.setRoom(
            common.roomList, common.playerList, common.socketList,
            socketId, common.playerList[userId], 'game'
        );
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

        sockIO.send(socket, 'enter', {
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
        });

        // AI 할당 및 재분배 알림
        common.roomList[roomId].setAIHandle(common.socketList);

        sockIO.send(sockIO.to(roomId), 'new_worm', [Object.assign(
            { name: data.name, color: data.color, delay: 0 },
            common.playerList[userId].myLastTick
        )]);
    });
    
    socket.on('bound_check', data => {
        data = sockIO.decode('bound_check', data);
        if (userId === null || roomId === null) return console.warn('wrong access', data);

        sockIO.send(socket.to(roomId), 'bound_check', data);
    });
    
    socket.on('inbound', data => {
        data = sockIO.decode('inbound', data);
        if (userId === null || roomId === null) return console.warn('wrong access', data);
        if (!(data.requestId in common.playerList)) return;

        
        sockIO.send(
            common.socketList[common.playerList[data.requestId].socketId],
            'inbound', data
        );
    });

    socket.on('position', data => {
        data = sockIO.decode('position', data);
        if (userId === null || roomId === null) return;//  console.warn('wrong access', data);
        if (!(userId in common.playerList)) return `no-act pos ${userId}`;

        //! 업데이트 검증 필요함

        common.playerList[data.id].setCurrent(data);
    });

    socket.on('tail_position', data => {
        data = sockIO.decode('tail_position', data);
        if (userId === null || roomId === null) return console.warn('wrong access');
        if (!(data.id in common.playerList)) return;

        common.roomList[roomId].createWreck('tailing', [data], common.playerList[data.id].color);
    });

    socket.on('eat', data => {
        data = sockIO.decode('eat', data);
        if (userId === null || roomId === null) return console.warn('wrong access');
        if (!(data.wormId in common.playerList)) return;
        try {
            //! 업데이트 검증 필요함

            // 이미 해당 food를 누군가 먹었을 경우 없던 일로 처리
            if (common.roomList[roomId].foodList[data.foodId] === undefined) return;

            const foodAmount = common.roomList[roomId].foodList[data.foodId].tick.amount;
            delete common.roomList[roomId].foodList[data.foodId];

            sockIO.send(socket.to(roomId), 'delete_food', [data]);

            // setTimeout 이후에는 해당 지렁이가 없을 수 있음
            if (data.wormId in common.playerList) {
                common.playerList[data.wormId].setCurrent({
                    point: common.playerList[data.wormId].myLastTick.point + foodAmount
                });
                
                sockIO.send(socket.to(roomId), 'point', {
                    id: data.wormId,
                    point: common.playerList[data.wormId].myLastTick.point
                });
            }
        } catch (error) {
            console.error(error);
        }
    });

    socket.on('boost_start', data => {
        if (userId === null || roomId === null) return console.warn('wrong access');
        if (!(userId in common.playerList)) return;

        sockIO.send(socket.to(roomId), 'boost_start', { id: userId });
    });
    socket.on('boost_ing', data => {
        data = sockIO.decode('boost_ing', data);
        if (userId === null || roomId === null) return console.warn('wrong access');
        if (!(userId in common.playerList)) return;

        if (common.playerList[userId].myLastTick.point - SUBTRACT_POINT_PER_BOOST < 0) return;
        
        common.roomList[roomId].createWreck('tailing', [data], common.playerList[userId].color);

        common.playerList[userId].setCurrent({
            point: common.playerList[userId].myLastTick.point - SUBTRACT_POINT_PER_BOOST
        });
    });
    socket.on('boost_end', data => {
        if (userId === null || roomId === null) return console.warn('wrong access');
        if (!(userId in common.playerList)) return;

        sockIO.send(socket.to(roomId), 'boost_end', { id: userId });
    });

    socket.on('conflict', data => {
        data = sockIO.decode('conflict', data);
        if (userId === null || roomId === null) return console.warn('wrong access');
        if (!(data.id in common.playerList)) return;
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
    });

    socket.on('disconnect', reason => {
        if (userId === null || roomId === null) return;
        if (!(userId in common.playerList)) return;
        console.log(`[ROR] ${userId} user disconnected: `, socketId, reason);

        
        // common.playerList[userId].convertAI();
        common.playerList[userId].destroy('disconnect');
        common.roomList[roomId].setAIHandle(common.socketList); // AI 할당 및 재분배 알림
        
        delete common.socketList[socketId];
    });
});

module.exports = router;