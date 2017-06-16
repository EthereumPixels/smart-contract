const Web3 = require('web3');
const web3 = new Web3();

module.exports = {
  GRID_SIZE: 1000,
  MIN_PRICE: web3.toBigNumber(web3.toWei(0.01, 'ether')),
  GROWTH_LIMIT: 2,
  FEE_RATIO: 100,
};
