const Grid = artifacts.require('./Grid.sol');

const config = require('../config');
const web3 = Grid.web3;

const INCREMENT_RATIO = 1 + (config.INCREMENT_RATE / 100);
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

  it('initializes with the correct size, defaultPrice and incrementRate', function() {
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    p = p.then(function() {
      return grid.size.call();
    }).then(function(size) {
      assert.equal(size.valueOf(), config.GRID_SIZE, 'The size is wrong');
    });

    p = p.then(function() {
      return grid.defaultPrice.call();
    }).then(function(defaultPrice) {
      assert.equal(
        defaultPrice.valueOf(),
        config.DEFAULT_PRICE,
        'The defaultPrice is wrong',
      );
    });

    p = p.then(function() {
      return grid.incrementRate.call();
    }).then(function(incrementRate) {
      assert.equal(
        incrementRate.valueOf(),
        config.INCREMENT_RATE,
        'The incrementRate is wrong',
      );
    });

    return p;
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

  it('allows admin to successfully change an unowned pixel', function() {
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    p = p.then(function() {
      return grid.getPixelOwner(9, 9);
    }).then(function(owner) {
      assert.equal(owner, admin, 'Pixel does not belong to admin');
    });

    p = p.then(function() {
      return grid.setPixelColor(9, 9, RGB[2], {from: admin});
    }).then(function() {
      return grid.getPixelColor.call(9, 9);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[2].valueOf(), 'Color was not updated');
    });

    return p;
  });

  //============================================================================
  // Transactions
  //============================================================================

  it('allows initial pixel purchase', function() {
    const buyer = accounts[1];
    const price = config.DEFAULT_PRICE;
    let grid, adminBalance;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    // Clear out any existing balance
    p = p.then(function() {
      return grid.withdraw({from: admin});
    });

    p = p.then(function() {
      return grid.getPixelOwner.call(0, 0);
    }).then(function(owner) {
      assert.equal(owner, admin, 'Owner is wrong');
      const transaction = {from: buyer, value: price};
      return grid.buyPixel(0, 0, RGB[1], transaction);
    }).then(function() {
      return grid.getPixelOwner.call(0, 0);
    }).then(function(owner) {
      assert.equal(owner, buyer, 'Owner was not updated');
      return grid.getPixelColor.call(0, 0);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[1], 'Color was not updated');
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

    return p;
  });

  it('allows secondary pixel purchase', function() {
    const primaryBuyer = accounts[1];
    const secondaryBuyer = accounts[2];
    const resalePrice = config.DEFAULT_PRICE.times(INCREMENT_RATIO);
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      const transaction = {from: primaryBuyer, value: config.DEFAULT_PRICE};
      return grid.buyPixel(1, 1, RGB[0], transaction);
    }).then(function() {
      return grid.getPixelColor.call(1, 1);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[0], 'Color was not updated');
    }).then(function() {
      return grid.getPixelPrice.call(1, 1);
    }).then(function(price) {
      assert.equal(
        price.valueOf(),
        resalePrice.valueOf(),
        'Price was not updated',
      );
      const transaction = {from: secondaryBuyer, value: price};
      return grid.buyPixel(1, 1, RGB[2], transaction);
    }).then(function() {
      return grid.getPixelOwner(1, 1);
    }).then(function(owner) {
      assert.equal(owner, secondaryBuyer, 'Owner was not updated');
      return grid.getPixelColor.call(1, 1);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[2], 'Color was not updated');
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
    const buyer = accounts[6];
    const price = config.DEFAULT_PRICE.dividedToIntegerBy(2);
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    // Clear out any existing balance
    p = p.then(function() {
      return grid.withdraw({from: buyer});
    })

    p = p.then(function() {
      const transaction = {from: buyer, value: price};
      return grid.buyPixel(2, 2, RGB[1], transaction);
    }).then(function() {
      return grid.getPixelOwner.call(2, 2);
    }).then(function(owner) {
      assert.notEqual(owner, buyer, 'Owner should not be updated');
    });

    p = p.then(function() {
      return grid.checkPendingWithdrawal({from: buyer});
    }).then(function(pendingAmount) {
      assert.equal(
        pendingAmount.valueOf(),
        price.valueOf(),
        'Buyer was not refunded',
      );
    }).then(function() {
      return grid.withdraw({from: buyer});
    });

    p = p.then(function() {
      return grid.getPixelColor(2, 2);
    }).then(function(color) {
      assert.notEqual(color.valueOf(), RGB[1], 'Color should not be updated');
    });

    return p;
  });

  it('refunds invalid purchase', function() {
    const buyer = accounts[2];
    const price = config.DEFAULT_PRICE;
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    // Clear out any existing balance
    p = p.then(function() {
      return grid.withdraw({from: buyer});
    });

    p = p.then(function() {
      return grid.buyPixel(config.GRID_SIZE + 1, 0, RGB[0], {from: buyer, value: price});
    }).then(function() {
      return grid.checkPendingWithdrawal({from: buyer});
    }).then(function(pendingAmount) {
      assert.equal(pendingAmount.valueOf(), price.valueOf(), 'Buyer was not refunded');
    }).then(function() {
      return grid.withdraw({from: buyer});
    });

    return p;
  });

  it('handles multiple transactions', function() {
    let price = config.DEFAULT_PRICE;
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    // First price increase
    p = p.then(function() {
      return grid.buyPixel(4, 4, RGB[1], {from: accounts[3], value: price});
    }).then(function() {
      return grid.getPixelPrice.call(4, 4);
    }).then(function(newPrice) {
      assert.equal(
        newPrice.valueOf(),
        price.times(INCREMENT_RATIO).valueOf(),
        'Price was not automatically adjusted',
      );
      price = newPrice;
    });

    // Second price increase
    p = p.then(function() {
      return grid.buyPixel(4, 4, RGB[1], {from: accounts[4], value: price});
    }).then(function() {
      return grid.getPixelPrice.call(4, 4);
    }).then(function(newPrice) {
      assert.equal(
        newPrice.valueOf(),
        price.times(INCREMENT_RATIO).valueOf(),
        'Price was not automatically adjusted',
      );
    });

    // New owner lowers the price
    p = p.then(function() {
      price = price.times(0.5);
      return grid.setPixelPrice(4, 4, price, {from: accounts[4]});
    }).then(function() {
      return grid.buyPixel(4, 4, RGB[1], {from: accounts[5], value: price});
    }).then(function() {
      return grid.getPixelPrice.call(4, 4);
    }).then(function(newPrice) {
      assert.equal(
        newPrice.valueOf(),
        price.times(INCREMENT_RATIO).valueOf(),
        'Price was not automatically adjusted',
      );
    });

    // Verify owner
    p = p.then(function() {
      return grid.getPixelOwner.call(4, 4);
    }).then(function(owner) {
      assert.equal(owner, accounts[5], 'Owner was not updated');
    });

    // Clean up
    p = p.then(function() {
      grid.withdraw({from: accounts[4]});
    }).then(function() {
      return grid.withdraw({from: accounts[3]});
    }).then(function() {
      return grid.withdraw({from: admin});
    });

    return p;
  });

  //============================================================================
  // Owner
  //============================================================================

  it('only allows owner to set price', function() {
    const owner = accounts[2];
    const badActor = accounts[3];
    const price = config.DEFAULT_PRICE;
    let grid;
    return Grid.deployed().then(function(instance) {
      grid = instance;
      return grid.buyPixel(5, 5, RGB[1], {from: owner, value: price});
    }).then(function() {
      return grid.getPixelPrice(5, 5);
    }).then(function(newPrice) {
      assert.equal(
        newPrice.valueOf(),
        price.times(INCREMENT_RATIO).valueOf(),
        'Price was not automatically adjusted',
      );
    }).then(function() {
      return grid.setPixelPrice(5, 5, price, {from: badActor});
    }).then(assert.fail).catch(assertVMException).then(function() {
      return grid.setPixelPrice(5, 5, price, {from: owner});
    }).then(function() {
      return grid.getPixelPrice.call(5, 5);
    }).then(function(newPrice) {
      assert.equal(
        newPrice.valueOf(),
        price.valueOf(),
        'Price was not updated',
      );
    }).then(function() {
      return grid.setPixelPrice(5, 5, price.times(0.4), {from: owner});
    }).then(function() {
      return grid.getPixelPrice.call(5, 5);
    }).then(function(newPrice) {
      assert.equal(
        newPrice.valueOf(),
        price.times(0.4).valueOf(),
        'Price was not updated',
      );
    });
  });

  it('allows owner to set color', function() {
    const owner = accounts[2];
    let grid;

    return Grid.deployed().then(function(instance) {
      grid = instance;
      const price = config.DEFAULT_PRICE.times(2);
      return grid.buyPixel(6, 6, price, RGB[1], {from: owner, value: price});
    }).then(function() {
      return grid.setPixelColor(6, 6, RGB[0], {from: owner});
    }).then(function() {
      return grid.getPixelColor.call(6, 6);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[0], 'Color was not updated');
    }).then(function() {
      return grid.setPixelColor(6, 6, RGB[2], {from: owner});
    }).then(function() {
      return grid.getPixelColor.call(6, 6);
    }).then(function(color) {
      assert.equal(color.valueOf(), RGB[2], 'Color was not updated');
    });
  });

  it('does not allow owner to raise price', function() {
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    p = p.then(function() {
      const transaction = {from: accounts[2], value: config.DEFAULT_PRICE};
      return grid.buyPixel(10, 10, RGB[0], transaction);
    });

    p = p.then(function() {
      return grid.getPixelOwner(10, 10);
    }).then(function(owner) {
      assert.equal(owner, accounts[2], 'Owner was not updated');
    });

    p = p.then(function() {
      const newPrice = config.DEFAULT_PRICE.times(1 + INCREMENT_RATIO);
      return grid.setPixelPrice(10, 10, newPrice, {from: accounts[2]});
    }).then(assert.fail).catch(assertVMException);

    return p;
  });

  it('allows owner to transfer ownership', function() {
    const price = config.DEFAULT_PRICE;
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    // Purchase pixel
    p = p.then(function() {
      return grid.buyPixel(7, 7, RGB[1], {from: accounts[3], value: price});
    });

    // Perform transfer
    p = p.then(function() {
      return grid.transferPixel(7, 7, accounts[4], {from: accounts[3]});
    });

    // Verify new owner
    p = p.then(function() {
      return grid.getPixelOwner.call(7, 7);
    }).then(function(owner) {
      assert.equal(owner, accounts[4], 'Owner was not updated');
    });

    return p;
  });

  it('disallows non-owner from transferring ownership', function() {
    const price = config.DEFAULT_PRICE;
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    // Purchase pixel
    p = p.then(function() {
      return grid.buyPixel(8, 8, RGB[0], {from: accounts[3], value: price});
    });

    // Attempt to perform transfer
    p = p.then(function() {
      return grid.transferPixel(8, 8, accounts[5], {from: accounts[4]});
    }).then(assert.fail).catch(assertVMException);

    // Verify owner did not change
    p = p.then(function() {
      return grid.getPixelOwner.call(8, 8);
    }).then(function(owner) {
      assert.equal(owner, accounts[3], 'Owner should not be updated');
    })

    return p;
  });


  //============================================================================
  // User
  //============================================================================

  it('returns an empty message for new users', function() {
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    p = p.then(function() {
      return grid.getUserMessage.call(accounts[2]);
    }).then(function(message) {
      assert.equal(message, '', 'Message is not empty');
    });

    return p;
  });

  it('allows user to set message', function() {
    let grid;
    const litany = `
      I must not fear.
      Fear is the mind-killer.
      Fear is the little-death that brings total obliteration.
      I will face my fear.
      I will permit it to pass over me and through me.
      And when it has gone past I will turn the inner eye to see its path.
      Where the fear has gone there will be nothing. Only I will remain.
    `;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    // Set new message
    p = p.then(function() {
      return grid.setUserMessage(litany, {from: accounts[2]});
    });

    // Verify the message
    p = p.then(function() {
      return grid.getUserMessage(accounts[2]);
    }).then(function(message) {
      assert.equal(message, litany, 'Message was not updated');
    });

    return p;
  });

  it('allows user to set a unicode message', function() {
    let grid;

    let p = Grid.deployed().then(function(instance) {
      grid = instance;
    });

    // Set new message
    p = p.then(function() {
      return grid.setUserMessage('ローマでは三連休', {from: accounts[2]});
    });

    // Verify the message
    p = p.then(function() {
      return grid.getUserMessage(accounts[2]);
    }).then(function(message) {
      assert.equal(message, 'ローマでは三連休', 'Message was not updated');
    });

    return p;
  });
});
