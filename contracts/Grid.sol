pragma solidity ^0.4.4;

contract Grid {
  // The account address with admin privilege to this contract
  // This is also the default owner of all unowned pixels
  address admin;

  // The size in number of pixels of the square grid on each side
  uint16 public size;

  // The default price of unowned pixels
  uint public defaultPrice;

  // The price-fee ratio used in the following formula:
  //   salePrice / feeRatio = fee
  //   payout = salePrice - fee
  // Higher feeRatio equates to lower fee percentage
  uint public feeRatio;

  // A record of a user who may at any time be an owner of pixels or simply has
  // unclaimed withdrawal from a failed purchase or a successful sale
  struct User {
    // Number of Wei that can be withdrawn by the user
    uint pendingWithdrawal;

    // Number of Wei in total ever credited to the user as a result of a
    // successful sale
    uint totalSales;

    // An optional message that is shown in some parts of the UI and in the
    // details pane of every owned pixel
    string message;
  }

  struct Pixel {
    // User with permission to modify the pixel. A successful sale of the
    // pixel will result in payouts being credited to the pendingWithdrawal of
    // the User
    address owner;

    // Current listed price of the pixel
    uint price;

    // Current color of the pixel. A valid of 0 is considered transparent and
    // not black. Use 1 for black.
    uint24 color;
  }

  // The state of the pixel grid
  mapping(uint32 => Pixel) pixels;

  // The state of all users who have transacted with this contract
  mapping(address => User) users;

  //============================================================================
  // Events
  //============================================================================

  event PixelTransfer(uint16 row, uint16 col, uint price, address prevOwner, address newOwner);
  event PixelColor(uint16 row, uint16 col, address owner, uint24 color);
  event PixelPrice(uint16 row, uint16 col, address owner, uint price);
  event UserMessage(address user, string message);

  //============================================================================
  // Basic API and helper functions
  //============================================================================

  function Grid(uint16 _size, uint _defaultPrice, uint _feeRatio) {
    admin = msg.sender;
    defaultPrice = _defaultPrice;
    feeRatio = _feeRatio;
    size = _size;
  }

  modifier onlyAdmin {
    if (msg.sender != admin) throw;
    _;
  }

  modifier onlyOwner(uint16 row, uint16 col) {
    if (msg.sender != getPixelOwner(row, col)) throw;
    _;
  }

  function getKey(uint16 row, uint16 col) constant returns (uint32) {
    if (row >= size || col >= size) throw;
    return uint32(row) * size + col;
  }

  function() payable { }

  //============================================================================
  // Admin API
  //============================================================================

  function setAdmin(address _admin) onlyAdmin {
    admin = _admin;
  }

  function setFeeRatio(uint _feeRatio) onlyAdmin {
    feeRatio = _feeRatio;
  }

  function setDefaultPrice(uint _defaultPrice) onlyAdmin {
    defaultPrice = _defaultPrice;
  }

  //============================================================================
  // Public Querying API
  //============================================================================

  function getPixelColor(uint16 row, uint16 col) constant returns (uint24) {
    uint32 key = getKey(row, col);
    return pixels[key].color;
  }


  function getPixelOwner(uint16 row, uint16 col) constant returns (address) {
    uint32 key = getKey(row, col);
    if (pixels[key].owner == 0) {
      return admin;
    }
    return pixels[key].owner;
  }

  function getPixelPrice(uint16 row, uint16 col) constant returns (uint) {
    uint32 key = getKey(row, col);
    if (pixels[key].owner == 0) {
      return defaultPrice;
    }
    return pixels[key].price;
  }

  function getUserMessage(address user) constant returns (string) {
    return users[user].message;
  }

  function getUserTotalSales(address user) constant returns (uint) {
    return users[user].totalSales;
  }

  //============================================================================
  // Public Transaction API
  //============================================================================

  function checkPendingWithdrawal() constant returns (uint) {
    return users[msg.sender].pendingWithdrawal;
  }

  function withdraw() {
    if (users[msg.sender].pendingWithdrawal > 0) {
      uint amount = users[msg.sender].pendingWithdrawal;
      users[msg.sender].pendingWithdrawal = 0;
      msg.sender.transfer(amount);
    }
  }

  function buyPixel(uint16 row, uint16 col, uint newPrice, uint24 newColor) payable {
    users[msg.sender].pendingWithdrawal += msg.value;
    uint32 key = getKey(row, col);
    uint price = getPixelPrice(row, col);
    address owner = getPixelOwner(row, col);

    if (msg.value < price) {
      throw;
    }

    uint fee = msg.value / feeRatio;
    uint payout = msg.value - fee;

    users[msg.sender].pendingWithdrawal -= msg.value;
    users[admin].pendingWithdrawal += fee;
    users[owner].pendingWithdrawal += payout;
    users[owner].totalSales += payout;

    pixels[key].price = price;
    pixels[key].owner = msg.sender;

    PixelTransfer(row, col, price, owner, msg.sender);
    setPixelPrice(row, col, newPrice);
    setPixelColor(row, col, newColor);
  }

  //============================================================================
  // Owner Management API
  //============================================================================

  function transferPixel(uint16 row, uint16 col, address newOwner) onlyOwner(row, col) {
    uint32 key = getKey(row, col);
    address owner = pixels[key].owner;
    if (owner != newOwner) {
      pixels[key].owner = newOwner;
      PixelTransfer(row, col, 0, owner, newOwner);
    }
  }

  function setPixelColor(uint16 row, uint16 col, uint24 color) onlyOwner(row, col) {
    uint32 key = getKey(row, col);
    if (pixels[key].color != color) {
      pixels[key].color = color;
      PixelColor(row, col, pixels[key].owner, color);
    }
  }

  function setPixelPrice(uint16 row, uint16 col, uint newPrice) onlyOwner(row, col) {
    uint32 key = getKey(row, col);
    if (pixels[key].price != newPrice) {
      pixels[key].price = newPrice;
      PixelPrice(row, col, pixels[key].owner, newPrice);
    }
  }

  //============================================================================
  // User Management API
  //============================================================================

  function setUserMessage(string message) {
    users[msg.sender].message = message;
    UserMessage(msg.sender, message);
  }
}
