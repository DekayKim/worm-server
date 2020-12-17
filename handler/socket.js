// var io = require('socket.io')();
const WebSocket = require("ws");
var io = io || {};

var sp = require('schemapack');
var msgpack = require('msgpack5')();
// sp.setStringEncoding('ascii');

const common = require('../handler/common.js');
const Utils = require('../object/utils.js');

common.SCHEMA_LIST = {
    'events': [
        'enter', 'ai', 'new_worm', 'delete_worm', 'angle', 'angle_all',
        'position', 'position_all', 'tail_position', 'new_food', 'delete_food',
        'bound_check', 'inbound', 'boost_start', 'boost_ing', 'boost_end',
        'eat', 'rank', 'conflict', 'test'
    ],
    'S2C': {
        test: {x: 'string'},
        enter: {
            myId: 'string',
            player: [{ name: 'string', color: 'string', id: 'string', x: 'float32', y: 'float32', point: 'uint16' }],
            food: [{ id: 'string', color: 'string', x: 'float32', y: 'float32', amount: 'uint8' }]
        },
        ai: ['string'],
        new_worm: [{ name: 'string', color: 'string', id: 'string', x: 'float32', y: 'float32', point: 'uint16', delay: 'uint16' }],
        delete_worm: 'string',
        angle_all: [{ id: 'string', angle: 'float32', point: 'uint16', x: 'float32', y: 'float32' }],
        position: { x: 'float32', y: 'float32', angle: 'float32' },
        position_all: [{ id: 'string', angle: 'float32', x: 'float32', y: 'float32', point: 'uint16' }],
        tail_position: { id: 'string' },
        new_food: [{ id: 'string', color: 'string', x: 'float32', y: 'float32', amount: 'uint8' }],
        delete_food: [{ wormId: 'string', foodId: 'string' }],
        bound_check: {
            requestId: 'string',
            bound: { x: 'float32', y: 'float32', width: 'uint16', height: 'uint16' }
        },
        inbound: {
            requestId: 'string',
            responseId: 'string',
            bodies: [{ x: 'float32', y: 'float32' }],
            paths: [{ x: 'float32', y: 'float32' }]
        },
        boost_start: { id: 'string' },
        boost_end: { id: 'string' },
        rank: ['string']
    },
    'C2S': {
        enter: { name: 'string', color: 'string', isMobile: 'boolean' },
        angle: 'float32',
        position: { x: 'float32', y: 'float32', angle: 'float32' },
        // position_all: {},
        tail_position: { id: 'string', x: 'float32', y: 'float32' },
        eat: { wormId: 'string', foodId: 'string' },
        bound_check: {
            requestId: 'string',
            bound: { x: 'float32', y: 'float32', width: 'uint16', height: 'uint16' }
        },
        inbound: {
            requestId: 'string',
            responseId: 'string',
            bodies: [{ x: 'float32', y: 'float32' }],
            paths: [{ x: 'float32', y: 'float32' }]
        },
        conflict: { id: 'string', looserBodies: [{ x: 'float32', y: 'float32' }] },
        // boost_start: {},
        boost_ing: { x: 'float32', y: 'float32' },
        // boost_end: {}
    }
}
const SCHEMA_BUILD = {
    S2C: Object.fromEntries(
        Object.entries(common.SCHEMA_LIST.S2C).map(([name, data]) => [name, sp.build(data)])
    ),
    C2S: Object.fromEntries(
        Object.entries(common.SCHEMA_LIST.C2S).map(([name, data]) => [name, sp.build(data)])
    )
}

io.send = function(eventName, data, options) {
    options = Object.assign({
        encode: true,
        mysock: null,
        roomId: null
    }, options);

    try {
        let sendData = 
            // data
            // options.encode ? msgpack.encode([eventName, data]) : [eventName, data]
            options.encode ? SCHEMA_BUILD.S2C[eventName].encode(data) : data
        ;
        let a = new Uint8Array([common.SCHEMA_LIST.events.indexOf(eventName)]);
        let b = new Uint8Array(sendData);
        var c = new Uint8Array(a.length + b.length);
        c.set(a, 0), c.set(b, a.length);
        sendData = c.buffer
        // console.log('sendData', sendData)

        if (options.mysock && options.roomId === null) {
            options.mysock.readyState === WebSocket.OPEN &&
            options.mysock.send(sendData);
        } else if (options.roomId) {
            let sendList = common.roomList[options.roomId].playerList;
                for (let idx = 0; idx < sendList.length; idx++) {
                    if (sendList[idx].socketId === null) continue; // AI 제외
                    const eachSock = common.socketList[sendList[idx].socketId];

                    eachSock && // socketId가 이미 지워져 있어 undefined
                    eachSock !== options.mysock && // mysock null = 모든 유저
                    eachSock.readyState === WebSocket.OPEN &&
                    eachSock.send(sendData);
                }
        }
    } catch (error) {
        console.error(error);
        console.warn(eventName, data);
    }
}

io.decode = function(dataBuffer) {
    let eventName = null;
    if (sp) {
        const ui8Arr = new Uint8Array(dataBuffer);
        eventName = common.SCHEMA_LIST.events[ui8Arr[0]];
        dataBuffer = ui8Arr.slice(1);
    }
    try {
        // return msgpack.decode(dataBuffer)
        // return dataBuffer;
        if (SCHEMA_BUILD.C2S[eventName] && dataBuffer.length > 0) {
            return [eventName, SCHEMA_BUILD.C2S[eventName].decode(dataBuffer)];
        } else {
            return [eventName, null];
        }
    } catch (error) {
        console.error(error);
        console.warn(eventName, dataBuffer);
    }
}

io.attach = function(server, options) { // socketIO 호환
    // io.wss = new WebSocket.Server({ port: 3638 });
    io.wss = new WebSocket.Server({ server });

    io._onResvList.forEach(([eventName, eventFn]) => {
        io.wss.on(eventName, eventFn);
    });
}

io._onResvList = [];
io.on = function(eventName, eventFn) {
    if (io.wss) { // attach 되어있으면 직접 on
        io.wss.on(eventName, eventFn);
    } else {
        io._onResvList.push([eventName, eventFn]);
    }
}

// io.to = function(roomId) {
//     return common.roomList[roomId].playerList.map(e => common.socketList[e.socketId]);
// }

module.exports = io;