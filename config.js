const Web3 = require('web3');
const web3 = new Web3();

module.exports = {
  GRID_SIZE: 1000,
  DEFAULT_PRICE: web3.toBigNumber(web3.toWei(0.01, 'ether')),
  FEE_RATIO: 100,
  INCREMENT_RATE: 50,
};
