var io = require('socket.io')();

const common = require('../handler/common.js');
const Utils = require('../object/utils.js');
const Room = require('../object/room.js');
const doAsync = fn => async (req, res, next) => await fn(req, res, next).catch(next);

io.setRoom = function(sessionId, userObj, type) { // , roomId = null
    return new Promise(async function (resolve, reject) { try {
        let roomId = Room.getNotFull(common.roomList);

        if (roomId === false) {
            console.log("creating room...");
            roomId = Utils.getNewId(common.roomList);
            common.roomList[roomId] = new Room(common.roomList, roomId, io);
            
            common.roomList[roomId].createAI(common.playerList);
        }
        common.roomList[roomId].join(userObj);
            
        common.socketList[sessionId].join(roomId);

        resolve(roomId);
    } catch (error) {
        reject(error);
    }})
}

module.exports = io;