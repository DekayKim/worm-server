var io = require('socket.io')();
var sp = require('schemapack');
sp.setStringEncoding('ascii');

const common = require('../handler/common.js');
const Utils = require('../object/utils.js');

common.SCHEMA_LIST = {
    'S2C': {
        enter: {
            myId: 'string',
            player: [{ name: 'string', id: 'string', x: 'int32', y: 'int32', point: 'uint16' }],
            food: [{ id: 'string', x: 'int32', y: 'int32', amount: 'uint8' }]
        },
        ai: ['string'],
        new_worm: { name: 'string', id: 'string', x: 'int32', y: 'int32', point: 'uint16' },
        delete_worm: 'string',
        position: { id: 'string', x: 'int32', y: 'int32' },
        position_all: [{ id: 'string', x: 'int32', y: 'int32', point: 'uint16' }],
        point: { id: 'string', point: 'uint16' },
        new_food: { id: 'string', x: 'int32', y: 'int32', amount: 'uint8' },
        delete_food: 'string',
        bound_check: {
            requestId: 'string',
            bound: { x: 'int32', y: 'int32', width: 'uint16', height: 'uint16' }
        },
        inbound: {
            requestId: 'string',
            responseId: 'string',
            bodies: [{ x: 'int32', y: 'int32' }],
            path: [{ x: 'int32', y: 'int32' }]
        },
        map: [{ x: 'int32', y: 'int32' }]
    },
    'C2S': {
        enter: { name: 'string' },
        position: { id: 'string', x: 'int32', y: 'int32' },
        eat: { wormId: 'string', foodId: 'string' },
        boost: { x: 'int32', y: 'int32' },
        bound_check: {
            requestId: 'string',
            bound: { x: 'int32', y: 'int32', width: 'uint16', height: 'uint16' }
        },
        inbound: {
            requestId: 'string',
            responseId: 'string',
            bodies: [{ x: 'int32', y: 'int32' }],
            path: [{ x: 'int32', y: 'int32' }]
        },
        conflict: { id: 'string', looserBodies: [{ x: 'int32', y: 'int32' }] }
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
        return SCHEMA_BUILD.C2S[eventName].decode(dataBuffer);
    } catch (error) {
        console.error(error);
        console.warn(eventName, dataBuffer);
    }
}


module.exports = io;