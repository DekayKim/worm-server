var io = require('socket.io')();
var sp = require('schemapack');
// sp.setStringEncoding('ascii');

const common = require('../handler/common.js');
const Utils = require('../object/utils.js');

common.SCHEMA_LIST = {
    'S2C': {
        enter: {
            myId: 'string',
            player: [{ name: 'string', color: 'string', id: 'string', x: 'float32', y: 'float32', point: 'uint16' }],
            food: [{ id: 'string', color: 'string', x: 'float32', y: 'float32', amount: 'uint8' }]
        },
        ai: ['string'],
        new_worm: { name: 'string', color: 'string', id: 'string', x: 'float32', y: 'float32', point: 'uint16' },
        delete_worm: 'string',
        position: { id: 'string', x: 'float32', y: 'float32' },
        position_all: [{ id: 'string', x: 'float32', y: 'float32', point: 'uint16' }],
        point: { id: 'string', point: 'uint16' },
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
        map: [{ x: 'float32', y: 'float32' }],
        boost_start: { id: 'string' },
        boost_end: { id: 'string' }
    },
    'C2S': {
        enter: { name: 'string', color: 'string' },
        position: { id: 'string', x: 'float32', y: 'float32' },
        eat: { wormId: 'string', foodId: 'string' },
        boost: { x: 'float32', y: 'float32' },
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

io.send = function(sockHdlr, eventName, data) {
    try {
        sockHdlr.emit(
            eventName,
            // data,
            SCHEMA_BUILD.S2C[eventName].encode(data)
        );
    } catch (error) {
        console.error(error);
        console.warn(eventName, data);
    }
}

io.decode = function(eventName, dataBuffer) {
    try {
        // return dataBuffer;
        if (SCHEMA_BUILD.C2S[eventName]) {
            return SCHEMA_BUILD.C2S[eventName].decode(dataBuffer);
        } else {
            return null;
        }
    } catch (error) {
        console.error(error);
        console.warn(eventName, dataBuffer);
    }
}


module.exports = io;