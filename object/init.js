const {
    promisify
} = require('util');
const schedule = require('node-schedule');

const common = require('../handler/common.js');
const socketHdlr = require('../handler/socket.js');
// const redis = require('../handler/redis.js');

const Utils = require('../object/utils.js');
const Room = require('../object/room.js');
const Player = require('../object/player.js');

module.exports = function (app) {
    return new Promise(async function (resolve, reject) {
        // common.roomList[Utils.getNewId(common.roomList)] = new Room(common.roomList);

        // await Guild.init();
        // schedule.scheduleJob('* * * * * *', async function() { // sec/min/hour/day/month/week
        // });

        setInterval(() => {
            for (let roomId in common.roomList) {
                common.roomList[roomId].createFood();
            }
        }, 2000);

        setInterval(() => {
            for (let roomId in common.roomList) {
                let isCreated = common.roomList[roomId].createAI(common.playerList);
                isCreated && common.roomList[roomId].setAIHandle(common.socketList);

                socketHdlr.to(roomId).emit('map', Utils.ec(
                    Object.values(common.roomList[roomId].lastTick)
                    .map(e => {return { x: e.x, y: e.y }})
                ));
            }
        }, 10000);
        resolve(true);
    })
}