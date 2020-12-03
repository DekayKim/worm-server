const Utils = require('../object/utils.js');
const sockIO = require('../handler/socket.js');

class Food {
    constructor(id, options) {
        options = Object.assign({
            isInit: false,
            isWreck: false
        }, options);

        this.id = id;
        this.tick = Object.assign({ id }, options.tick);
        this.createDate = options.isInit ?
            Date.now() + Math.round(Math.random() * 100000) :
            Date.now()
        ;
        this.isWreck = options.isWreck;
        this.color = options.color || Utils.getRandomColor();
    }
}

const self = Food;
module.exports = Food;