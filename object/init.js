const {
    promisify
} = require('util');
const schedule = require('node-schedule');

const common = require('../handler/common.js');
const sockIO = require('../handler/socket.js');

const {
    MS_PER_FRAME
} = require('../handler/define.js');

module.exports = function (app) {
    return new Promise(async function (resolve, reject) {
        let prevT = Date.now();

        setInterval(() => {
            for (let roomId in common.roomList) {
                let isCreated = common.roomList[roomId].createAI();
                isCreated && common.roomList[roomId].setAIHandle(common.socketList);

                common.roomList[roomId].createFood();
                common.roomList[roomId].cleanOldFood();
            }
        }, 10000);

        const runFrame = () => {
            const nowT = Date.now();
            const deltaT = nowT - prevT;
            const dt = (nowT - prevT) / MS_PER_FRAME;
            prevT = nowT;
            
            for (let roomId in common.roomList) {
                common.roomList[roomId].controlAI(dt);
                
                sockIO.send('angle_all',
                    Object.values(common.roomList[roomId].lastTick).map(e => {
                        return {
                            id: e.id,
                            angle: e.angle,
                            point: e.point
                        }
                    }),
                    { roomId }
                );
            }
            setTimeout(runFrame, MS_PER_FRAME + (MS_PER_FRAME - deltaT))
        }
        runFrame();
        resolve(true);
    })
}