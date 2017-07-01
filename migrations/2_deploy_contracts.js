const Grid = artifacts.require('./Grid.sol');
const config = require('../config');

module.exports = function(deployer) {
  deployer.deploy(
    Grid,
    config.GRID_SIZE,
    config.DEFAULT_PRICE,
    config.FEE_RATIO,
    {gas: 4499995},
  );
};
