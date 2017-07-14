# Ethereum Pixels Smart Contract

This is the smart contract that powers the backend logic of [Ethereum Pixels](https://www.ethereumpixels.com), an interactive 1000x1000 grid that allows Ethereum users to own and maintain Pixels. It runs on the main Ethereum blockchain and was partly inspired by Reddit's r/place.

## Contract Features
- Mapping of one million Pixels containing ownership, price and color information
- Mapping of Ethereum addresses to stored balance and a personalized message that is displayed on all Pixels owned by the address
- Any Ethereum account may purchase Pixels by interacting with the API
- Current owner of a Pixel is paid when the Pixel is purchased by another account
- Stored balance and payments using the [withdrawal pattern](https://medium.com/@jgm.orinoco/why-use-the-withdrawal-pattern-d5255921ca2a)
- Automatic refunds on a failed purchase due to invalid coordinates or unmet price
- Automatic price increment logic when a Pixel changes ownership
- Small maintenance fee levied for each successful purchase

## Color Format
The Pixel colors are stored as 24-bit unsigned integers that mostly correspond to a typical web color palette. For example, `#ff0000` (red) is stored as 16711680. The only exception is that 0, which is also the value returned by Solidity for uninitialized memory, is rendered on the front end as transparent instead of `#000000` (black).

## Important Methods
- `buyPixel(uint16 row, uint16 col, uint24 newColor)`
- `getPixelColor(uint16 row, uint16 col)`
- `getPixelPrice(uint16 row, uint16 col)`
- `checkPendingWithdrawal()`
- `withdraw()`
