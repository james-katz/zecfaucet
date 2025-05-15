const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize instance
const sequelize = new Sequelize({
    host: 'localhost',
    dialect: 'sqlite',
    storage: 'db/zecfaucet.sqlite',
    logging: false,
});

const Transaction = sequelize.define('transaction', {
    txid: {
        type: DataTypes.STRING,
        allowNull: true,
        primaryKey: true,
        // unique: true,
    },
    value: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    fee: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    kind: {
        type: DataTypes.STRING,
        allowNull: false,        
    },
    memo: {
        type: DataTypes.STRING,
        allowNull: false,        
    }
});

const Claim = sequelize.define('claim', {
    address: {
        type: DataTypes.STRING
    },
    ip: {
        type: DataTypes.STRING
    },
    pending: {
        type: DataTypes.BOOLEAN
    }
});

const Challenge = sequelize.define('challenge', {
    message: {
        type: DataTypes.STRING
    },
    difficulty: {
        type: DataTypes.INTEGER
    }
});

const Voucher = sequelize.define('voucher', {    
    code: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    payout: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    memo: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    max_supply: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
});

// Setup relationships
Transaction.hasMany(Claim);
Claim.belongsTo(Transaction, {
    foreignKey: {
        name: 'transactionTxid',
        allowNull: true  // <== Important
    },
    targetKey: 'txid'
});

Voucher.hasMany(Claim, { foreignKey: 'voucherId' });
Claim.belongsTo(Voucher, { 
    foreignKey: {
        name: 'voucherId', 
        allowNull: true 
    }
});

// reset database
const resetDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        await sequelize.sync({force: true}); // Sync models to the database
        console.log('All models were synchronized successfully.');
    } catch (error) {
        // console.error('Unable to connect to the database:', error);
        throw(error);
    }
};

// Sync database and export
const initializeDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        await sequelize.sync(); // Sync models to the database
        console.log('All models were synchronized successfully.');
    } catch (error) {
        // console.error('Unable to connect to the database:', error);
        throw(error);
    }
};

module.exports = { sequelize, initializeDatabase, resetDatabase, Transaction, Claim, Challenge, Voucher };
