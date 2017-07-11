const Web3 = require('web3');
const web3 = new Web3();

module.exports = {
  GRID_SIZE: 1000,
  DEFAULT_PRICE: web3.toBigNumber(web3.toWei(0.002, 'ether')),
  FEE_RATIO: 40,
  INCREMENT_RATE: 25,
};
