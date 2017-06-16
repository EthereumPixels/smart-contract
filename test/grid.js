const Grid = artifacts.require('./Grid.sol');

const config = require('../config');
const web3 = Grid.web3;

const VALID_ROW = parseInt(config.GRID_SIZE / 2);
const VALID_COL = parseInt(config.GRID_SIZE / 3);
const RGB = [
  parseInt('ff0000', 16),
  parseInt('00ff00', 16),
  parseInt('0000ff', 16),
];

function assertVMException(err) {
  assert.include(err.toString(), 'VM Exception', 'Should be a VM Exception');
}

contract('Grid', function(accounts) {
  const admin = accounts[0];

  it('initializes with the correct size, minPrice and growthLimit', function() {
    let grid;
    return Grid.deployed().then(function(instance) {
      grid = instance;
      return grid.size.call();
    }).then(function(size) {
      assert.equal(size.valueOf(), config.GRID_SIZE, 'The size is wrong');
      return grid.minPrice.call();
    }).then(function(minPrice) {
      assert.equal(minPrice.valueOf(), config.MIN_PRICE, 'The minPrice is wrong');
      return grid.growthLimit.call();
    }).then(function(growthLimit) {
      assert.equal(growthLimit.valueOf(), config.GROWTH_LIMIT, 'The growthLimit is wrong');
    });
  });

  it('calculates the key correctly', function() {
    let grid;
    let expectedKey;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      return instance.size.call();
    }).then(function(size) {
      expectedKey = VALID_ROW * size + VALID_COL;
      return grid.getKey.call(VALID_ROW, VALID_COL);
    }).then(function(key) {
      assert.equal(key.valueOf(), expectedKey, 'The key is wrong');
    });
  });

  it('throws if row exceeds size', function() {
    let grid;
    return Grid.deployed().then(function(instance) {
      grid = instance;
      return instance.size.call();
    }).then(function(size) {
      return grid.getKey.call(size + 1, VALID_COL);
    }).then(assert.fail).catch(assertVMException);
  });

  it('throws if negative row', function() {
    return Grid.deployed().then(function(instance) {
      return instance.getKey.call(-VALID_ROW, VALID_COL);
    }).then(assert.fail).catch(assertVMException);
  });

  it('throws if column exceeds size', function() {
    let grid;
    return Grid.deployed().then(function(instance) {
      grid = instance;
      return instance.size.call();
    }).then(function(size) {
      return grid.getKey.call(VALID_ROW, size + 1);
    }).then(assert.fail).catch(assertVMException);
  });

  it('throws if negative column', function() {
    return Grid.deployed().then(function(instance) {
      return instance.getKey.call(VALID_ROW, -VALID_COL);
    }).then(assert.fail).catch(assertVMException);
  });

  //============================================================================
  // Admin
  //============================================================================

  it('allows the admin to set a new admin', function() {
    const newAdmin = accounts[1];
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      return grid.setAdmin(newAdmin, {from: admin});
    }).then(function() {
      return grid.setAdmin(admin, {from: newAdmin});
    });
  });

  it('forbids non-admin from setting a new admin', function() {
    const badActor = accounts[1];
    Grid.deployed().then(function(instance) {
      return instance.setAdmin(badActor, {from: badActor});
    }).then(assert.fail).catch(assertVMException);
  });

  it('sets valid colors', function() {
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      return grid.setValidColors(RGB, {from: admin});
    }).then(function() {
      return grid.getValidColors.call({from: accounts[2]});
    }).then(function(validColors) {
      RGB.forEach(function(color, i) {
        assert.equal(validColors[i].valueOf(), color, 'Color was not set');
      });
    }).then(function() {
      return grid.setValidColors([], {from: admin});
    });
  });

  //============================================================================
  // Transactions
  //============================================================================

  it('allows initial pixel purchase', function() {
    const buyer = accounts[1];
    const price = config.MIN_PRICE;
    let grid, adminBalance;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      return grid.getPixelOwner.call(0, 0);
    }).then(function(owner) {
      assert.equal(owner, admin, 'Owner is wrong');
      const transaction = {from: buyer, value: price};
      return grid.buyPixel(0, 0, price.times(config.GROWTH_LIMIT), transaction);
    }).then(function() {
      return grid.getPixelOwner.call(0, 0);
    }).then(function(owner) {
      assert.equal(owner, buyer, 'Owner was not updated');
    }).then(function() {
      adminBalance = web3.eth.getBalance(admin);
      return grid.checkPendingWithdrawal({from: admin});
    }).then(function(pendingAmount) {
      assert.equal(
        pendingAmount.valueOf(),
        price.valueOf(),
        'Admin was not credited',
      );
      return grid.withdraw({from: admin});
    }).then(function() {
      const newAdminBalance = web3.eth.getBalance(admin);
      assert.isAbove(
        newAdminBalance.valueOf(),
        adminBalance.valueOf(),
        'Admin was not paid',
      );
    });
  });

  it('allows secondary pixel purchase', function() {
    const primaryBuyer = accounts[1];
    const secondaryBuyer = accounts[2];
    const resalePrice = config.MIN_PRICE.times(1.5);
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      const transaction = {from: primaryBuyer, value: config.MIN_PRICE};
      return grid.buyPixel(1, 1, resalePrice, transaction);
    }).then(function() {
      return grid.getPixelPrice.call(1, 1);
    }).then(function(price) {
      assert.equal(
        price.valueOf(),
        resalePrice.valueOf(),
        'Price was not updated',
      );
      const transaction = {from: secondaryBuyer, value: price};
      return grid.buyPixel(1, 1, resalePrice.times(1.2), transaction);
    }).then(function() {
      return grid.getPixelOwner(1, 1);
    }).then(function(owner) {
      assert.equal(owner, secondaryBuyer, 'Owner was not updated');
      return grid.checkPendingWithdrawal.call({from: primaryBuyer});
    }).then(function(pendingAmount) {
      const fees = resalePrice.dividedToIntegerBy(config.FEE_RATIO);
      assert.equal(
        pendingAmount.valueOf(),
        resalePrice.minus(fees).valueOf(),
        'Owner was not credited',
      );
    });
  });

  it('rejects below minimum price', function() {
    const buyer = accounts[2];
    const price = config.MIN_PRICE.dividedToIntegerBy(2);
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      const transaction = {from: buyer, value: price};
      return grid.buyPixel(2, 2, config.MIN_PRICE, transaction);
    }).then(assert.fail).catch(assertVMException).then(function() {
      return grid.getPixelOwner.call(2, 2);
      return grid.checkPendingWithdrawal({from: buyer});
    }).then(function(pendingAmount) {
      assert(pendingAmount.valueOf(), price.valueOf(), 'Buyer was not refunded');
      return grid.withdraw({from: buyer});
    });
  });

  it('refunds invalid purchase', function() {
    const buyer = accounts[2];
    const price = config.MIN_PRICE;
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      return grid.buyPixel(config.GRID_SIZE + 1, 0, price, {from: buyer, value: price});
    }).then(assert.fail).catch(assertVMException).then(function() {
      return grid.checkPendingWithdrawal({from: buyer});
    }).then(function(pendingAmount) {
      assert(pendingAmount.valueOf(), price.valueOf(), 'Buyer was not refunded');
    }).then(function() {
      return grid.withdraw({from: buyer});
    });
  });

  it('successfully transfers ownership even if new price is too high', function() {
    const buyer = accounts[2];
    const invalidPrice = config.MIN_PRICE.times(config.GROWTH_LIMIT + 10);
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      const transaction = {from: buyer, value: config.MIN_PRICE};
      return grid.buyPixel(3, 3, invalidPrice, transaction);
    }).then(function() {
      return grid.getPixelOwner.call(3, 3);
    }).then(function(owner) {
      assert.equal(owner, buyer, 'Owner was not updated');
      return grid.getPixelPrice.call(3, 3);
    }).then(function(price) {
      assert.notEqual(price.valueOf(), invalidPrice.valueOf(), 'Price was not constrainted');
    });
  });

  it('handles multiple transactions', function() {
    const price = config.MIN_PRICE;
    let grid;
    return Grid.deployed().then(function(instance) {
      grid = instance;
      return grid.buyPixel(4, 4, price.times(2), {from: accounts[3], value: price});
    }).then(function() {
      return grid.buyPixel(4, 4, price.times(4), {from: accounts[4], value: price.times(2)});
    }).then(function() {
      return grid.setPixelPrice(4, 4, price.times(3), {from:accounts[4]});
    }).then(function() {
      return grid.buyPixel(4, 4, price.times(3), {from: accounts[5], value: price.times(3)});
    }).then(function() {
      return grid.getPixelOwner.call(4, 4);
    }).then(function(owner) {
      assert.equal(owner, accounts[5], 'Owner was not updated');
      return grid.withdraw({from: accounts[4]});
    }).then(function() {
      return grid.withdraw({from: accounts[3]});
    }).then(function() {
      return grid.withdraw({from: admin});
    });
  });

  //============================================================================
  // Owner
  //============================================================================

  it('only allows owner to set price', function() {
    const owner = accounts[2];
    const badActor = accounts[3];
    const price = config.MIN_PRICE;
    let grid;
    return Grid.deployed().then(function(instance) {
      grid = instance;
      return grid.buyPixel(5, 5, price, {from: owner, value: price});
    }).then(function() {
      return grid.setPixelPrice(5, 5, price, {from: badActor});
    }).then(assert.fail).catch(assertVMException).then(function() {
      return grid.setPixelPrice(5, 5, price.times(1.2), {from: owner});
    }).then(function() {
      return grid.getPixelPrice.call(5, 5);
    }).then(function(price) {
      assert(price.valueOf(), price.times(1.2).valueOf(), 'Price was not updated');
      return grid.setPixelPrice(5, 5, price.times(2.4), {from: owner});
    }).then(function() {
      return grid.getPixelPrice.call(5, 5);
    }).then(function(price) {
      assert(
        price.valueOf(),
        price.times(config.GROWTH_LIMIT),
        'Price was not constrainted',
      );
    });
  });

  it('allows owner to set color', function() {
    const owner = accounts[2];
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      const price = config.MIN_PRICE.times(2);
      return grid.buyPixel(5, 5, config.MIN_PRICE, {from: owner, value: price});
    }).then(function() {
      return grid.setPixelColor(5, 5, RGB[0], {from: owner});
    }).then(function() {
      return grid.getPixelColor.call(5, 5);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[0], 'Color was not updated');
      return grid.setValidColors(RGB, {from: admin});
    }).then(function() {
      // Try to set invalid color that is not in RGB
      return grid.setPixelColor(5, 5, parseInt('ffffff', 16), {from: owner});
    }).then(assert.fail).catch(assertVMException).then(function() {
      return grid.getPixelColor.call(5, 5);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[0], 'Color was updated errorneously');
    }).then(function() {
      return grid.setPixelColor(5, 5, RGB[2], {from: owner});
    }).then(function() {
      return grid.getPixelColor.call(5, 5);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[2], 'Color was not updated');
    });
  });
});
