const Grid = artifacts.require('./Grid.sol');
const config = require('../config');

module.exports = function(deployer) {
  deployer.deploy(
    Grid,
    config.GRID_SIZE,
    config.MIN_PRICE,
    config.GROWTH_LIMIT,
    config.FEE_RATIO,
  );
};
