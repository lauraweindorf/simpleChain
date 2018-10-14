/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/

const SHA256 = require('crypto-js/sha256');

/* ===== Configure to use dbSandbox: implementation of data access layer using LevelDB ================= */

const GENESIS = 'Project 2: simpleChain - Genesis block';

const level = require('level');
const simpleChainData = './simpleChainData';
const db = level(simpleChainData);

/* ===== Block Class ==============================
|  Class with a constructor for block 			   |
|  ===============================================*/

class Block
{
	constructor(data)
  {
     this.hash = '';
     this.height = 0;
     this.body = data;
		 this.time = 0;
     this.previousBlockHash = '';
   }

   toLogString(msg)
   {
     let blockString = (msg === undefined) ? '' : `${msg}\n`;

     blockString +=
      `block.height = ${this.height}\n` +
      `block.body = ${this.body}\n` +
      `block.hash = ${this.hash}\n` +
      `block.time = ${this.time}\n` +
      `block.previousBlockHash = ${this.previousBlockHash}\n`;

      return blockString;
   }
}


class Blockchain
{
  constructor()
  {
    this.addGenesisBlock();
  }

  async addGenesisBlock()
	{
		var genesis = new Block(GENESIS);

		genesis.time = getTimeStamp();
		genesis.hash = getSHA256(genesis);

    try {
      await this.putBlock(0, genesis);
      console.log(genesis.toLogString('GENESIS Block added!'));
    } catch (err) {
      throw new Error(`FATAL. Can't add genesis block to simpleChain: ${err.message}`);
    }
	}

  async addBlock(block)
  {
    try {
      // Make sure GENESIS block gets added
      let blockHeight = await this.getBlockHeight();
      if (blockHeight === -1) {
        this.addGenesisBlock();
        blockHeight++;
      }

      // Get latest block in the simpleChain
      let latestBlock = await this.getBlock(blockHeight);
      // Set new block height
      block.height = blockHeight + 1;
      // Set previous block hash of new block to link
      block.previousBlockHash = latestBlock.hash;
      // UTC timeStamp
      block.time = getTimeStamp();
      // Block hash with SHA256 using newBlock and converting to a string
      block.hash = getSHA256(block);

      // Persisting block object to levelDB
      await this.putBlock(block.height, block);

    } catch (err) {
      throw new Error(`unable to add new block: ${err.message}`);
    }
  }

  // validate block
  async validateBlock(blockHeight)
  {
    // get block object
    let block = await this.getBlock(blockHeight);
    // get block hash
    let blockHash = block.hash;
    // remove block hash to test block integrity
    block.hash = '';
    // generate block hash
    let validBlockHash = SHA256(JSON.stringify(block)).toString();

    // Compare
    if (blockHash === validBlockHash) {
        return true;
      } else {
        console.log('Block #' + blockHeight + ' invalid hash:\n' + blockHash + '<>' + validBlockHash);
        return false;
      }
  }

 // Validate blockchain
  async validateChain()
  {
    let errorLog = [];
    let blockHeight = await this.getBlockHeight();

    for (var i = 0; i < blockHeight; i++) {

      // validate block
      this.validateBlock(i).then((result) => {
        if (result === false) errorLog.push(i);
      });

      // compare blocks hash link
      // get block hash
      let blockHash = (await this.getBlock(i)).hash;
      let previousHash = (await this.getBlock(i+1)).previousBlockHash;

      if (blockHash !== previousHash) {
        errorLog.push(i);
      }
    }
    if (errorLog.length > 0) {
      console.log('Block errors = ' + errorLog.length);
      console.log('Blocks: ' + errorLog);
    } else {
      console.log('No errors detected');
    }
  }

  async showBlock(blockHeight)
  {
    try {
      let block = await this.getBlock(blockHeight);
      console.log(block);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async getBlockCount()
  {
    try {
      let blockHeight = await this.getBlockHeight();
      console.log(`blockHeight is ${blockHeight}`);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  //
  // LevelDB Data Access layer
  //

  // Get current block height of simpleChain
  getBlockHeight()
  {
    return new Promise((resolve, reject) => {
  		let blockHeight = -1;
  		db.createKeyStream()
  				.on('data', (data) => {
  					blockHeight++;
  				}).on('error', (err) => {
  					reject(`getLevelDBHeight: ${err.message}`);
  				}).on('close', () => {
            resolve(blockHeight);
  				});
  	});
  }

  // Get block at blockHeight value
  getBlock(blockHeight)
  {
    return new Promise((resolve, reject) => {
  		db.get(blockHeight)
  			.then((blockValue) => {
  				resolve(JSON.parse(blockValue));
  			}).catch((errmsg) => {
  				console.log('ERROR in getBlockData');
  				reject(`getLevelDBData: ${errmsg}`);
  			});
  		});
  }

  // Put block data
  putBlock(blockHeight, block)
  {
    let blockValue = JSON.stringify(block);

    return new Promise((resolve, reject) => {
      db.put(blockHeight, blockValue)
        .then(() => {
          resolve();
        })
        .catch((errmsg) => {
          reject(`db.put: ${errmsg}`);
        });
    });
  }
}

//
// Block data utils
//

function getTimeStamp()
{
  return new Date().getTime().toString().slice(0, -3);
}

function getSHA256(block)
{
  return SHA256(JSON.stringify(block)).toString();
}

/* ===== Testing ==============================================================|
|  - Self-invoking function to add blocks to chain                             |
|  - Learn more:                                                               |
|   https://scottiestech.info/2014/07/01/javascript-fun-looping-with-a-delay/  |
|                                                                              |
|  * 100 Milliseconds loop = 36,000 blocks per hour                            |
|     (13.89 hours for 500,000 blocks)                                         |
|    Bitcoin blockchain adds 8640 blocks per day                               |
|     ( new block every 10 minutes )                                           |
|  ===========================================================================*/

let blockchain = new Blockchain();
(function theLoop (i) {

  setTimeout(() => {
    i++;
    let newBlock = new Block(`Testing data - block + ${i}`);
    blockchain.addBlock(newBlock).then(() => {
      console.log(newBlock.toLogString(`Block # ${i} added to simpleChain`));
    });

    if (i < 10) theLoop(i);
  }, 100);
})(0);

async function induceErrors()
{
  let inducedErrorBlocks = [2,4,7];
  for (var i = 0; i < inducedErrorBlocks.length; i++) {
    let blockHeight = inducedErrorBlocks[i];
    let block = await blockchain.getBlock(blockHeight);
    block.body = 'induced chain error';
    await blockchain.putBlock(blockHeight, block);
  }
  console.log(`errors induced into simpleChain: ${inducedErrorBlocks}`);
}
