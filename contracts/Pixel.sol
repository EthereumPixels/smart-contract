pragma solidity ^0.4.4;

contract Pixel {
  address public owner;
  bytes8 public color;
  string public message;
  uint public price;

  function Pixel(address _owner, bytes8 _color) {
    color = _color;
    owner = _owner;
  }
}