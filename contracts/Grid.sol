pragma solidity ^0.4.4;

contract Grid {
  address admin;
  uint16 public size;
  uint public minPrice;
  uint public growthLimit;
  uint public feeRatio;
  uint24[] validColors;

  struct Pixel {
    address owner;
    uint24 color;
    string message;
    uint lastSoldPrice;
    uint price;
  }
  mapping(uint32 => Pixel) pixels;
  mapping(address => uint) pendingWithdrawals;

  event PixelTransfer(uint16 row, uint16 col, address prevOwner, address newOwner);
  event PixelColor(uint16 row, uint16 col, address owner, uint24 color);
  event PixelMessage(uint16 row, uint16 col, address owner, string message);
  event PixelPrice(uint16 row, uint16 col, address owner, uint price);
  event ValidColors(uint24[] colors);

  function Grid(uint16 _size, uint _minPrice, uint _growthLimit, uint _feeRatio) {
    admin = msg.sender;
    growthLimit = _growthLimit;
    minPrice = _minPrice;
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

  modifier validateColor(uint24 color) {
    bool valid = validColors.length == 0;
    if (!valid) {
      for (uint i = 0; i < validColors.length; i++) {
        if (color == validColors[i]) {
          valid = true;
        }
      }
    }
    if (!valid) throw;
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

  function setValidColors(uint24[] _validColors) {
    validColors = _validColors;
    ValidColors(_validColors);
  }

  //============================================================================
  // Public Transaction API
  //============================================================================

  function checkPendingWithdrawal() constant returns (uint) {
    return pendingWithdrawals[msg.sender];
  }

  function withdraw() {
    if (pendingWithdrawals[msg.sender] > 0) {
      uint amount = pendingWithdrawals[msg.sender];
      pendingWithdrawals[msg.sender] = 0;
      msg.sender.transfer(amount);
    }
  }

  function getPixelColor(uint16 row, uint16 col) constant returns (uint24) {
    uint32 key = getKey(row, col);
    if (pixels[key].lastSoldPrice == 0) {
      return 0;
    }
    return pixels[key].color;
  }


  function getPixelOwner(uint16 row, uint16 col) constant returns (address) {
    uint32 key = getKey(row, col);
    if (pixels[key].lastSoldPrice == 0) {
      return admin;
    }
    return pixels[key].owner;
  }

  function getPixelPrice(uint16 row, uint16 col) constant returns (uint) {
    uint32 key = getKey(row, col);
    if (pixels[key].lastSoldPrice == 0) {
      return minPrice;
    }
    return pixels[key].price;
  }

  function buyPixel(uint16 row, uint16 col, uint newPrice) payable {
    pendingWithdrawals[msg.sender] += msg.value;
    uint32 key = getKey(row, col);
    uint price = getPixelPrice(row, col);
    address owner = getPixelOwner(row, col);

    if (msg.value < price) {
      throw;
    }

    uint fee = msg.value / feeRatio;
    uint payout = msg.value - fee;
    pendingWithdrawals[msg.sender] -= msg.value;
    pendingWithdrawals[admin] += fee;
    pendingWithdrawals[owner] += payout;
    pixels[key].lastSoldPrice = price;
    pixels[key].price = price;
    pixels[key].owner = msg.sender;

    PixelTransfer(row, col, owner, msg.sender);
    setPixelPrice(row, col, newPrice);
  }

  //============================================================================
  // Owner Management API
  //============================================================================

  function getValidColors() constant returns(uint24[]) {
    return validColors;
  }

  function setPixelColor(uint16 row, uint16 col, uint24 color) onlyOwner(row, col) validateColor(color) {
    uint32 key = getKey(row, col);
    if (pixels[key].color != color) {
      pixels[key].color = color;
      PixelColor(row, col, pixels[key].owner, color);
    }
  }

  function setPixelMessage(uint16 row, uint16 col, string message) onlyOwner(row, col) {
    uint32 key = getKey(row, col);
    pixels[key].message = message;
    PixelMessage(row, col, pixels[key].owner, message);
  }

  function setPixelPrice(uint16 row, uint16 col, uint newPrice) onlyOwner(row, col) {
    uint32 key = getKey(row, col);
    uint lastSoldPrice = pixels[key].lastSoldPrice;

    // Limit growth rate of list price
    if (newPrice > lastSoldPrice * growthLimit) {
      newPrice = lastSoldPrice * growthLimit;
    }
    if (pixels[key].price != newPrice) {
      pixels[key].price = newPrice;
      PixelPrice(row, col, pixels[key].owner, newPrice);
    }
  }
}
