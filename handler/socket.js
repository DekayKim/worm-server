var io = require('socket.io')();

const common = require('../handler/common.js');
const Utils = require('../object/utils.js');
const Room = require('../object/room.js');
const doAsync = fn => async (req, res, next) => await fn(req, res, next).catch(next);

// io.origins(':');

// 동기화 시킬거면 나중에 await 걸어줘야 함
io.sendByUser = function(userId, name, data) {
    return new Promise(async function (resolve, reject) { try {
        if(userId == 'everyone') {
            io.emit(name, data);
            resolve();
        } else {
            if(name == 'refresh-user') {
                sess.userData = data
            }

            sess && sess.socketId && io.to(sess.socketId).emit(name, data);
            resolve(sess);
        }
    } catch (error) {
        reject(error);
    }})
}

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