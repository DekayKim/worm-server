let mysql = require('mysql');

class Mysql {
    constructor(dbconfig) {
        const mysqlConfig = Object.assign({
            host: "dev.zip-lab.co.kr",
            user: "test",
            password: "test1!",
            database: "test",
            connectTimeout: 30000,
            multipleStatements: true,
            timezone: 'local',
            connectionLimit: 140,
            connectTimeout: 60 * 1000,
            acquireTimeout: 60 * 1000,
            timeout: 60 * 1000,
        }, dbconfig);
        this.pool = mysql.createPool(mysqlConfig);
    }

    query(query, value = [], opt = {}) {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    console.log(err);
                    return reject(err.code || `ER_DB${err.errno}`);
                }
                connection.query(query, value, (err, results) => {
                    connection.release();
                    if (err) {
                        if (err.code == 'ER_DUP_ENTRY' || err.errno == 1062) {
                            console.warn(`${err.code}: ${err.sqlMessage}`);
                            return reject('ER_DUP_ENTRY');
                        } else {
                            console.warn(err);
                            return reject(err.code || `ER_DB${err.errno}`);
                        }
                    }

                    // custom Error 확인
                    if (opt.isAffectedOne) {
                        if (results.affectedRows !== 1) {
                            return reject('ER_DIFF_DATACNT');
                        } else {
                            results = true;
                        }
                    }
                    if (opt.isReturnedOne) {
                        if (results.length !== 1) {
                            return reject('ER_DIFF_DATACNT');
                        } else {
                            results = results[0];
                        }
                    }
                    resolve(results);
                });
            });
        });
    }
}

module.exports = Mysql;