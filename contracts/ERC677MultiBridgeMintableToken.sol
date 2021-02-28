pragma solidity 0.4.24;

import "./ERC677MultiBridgeToken.sol";

/**
 * @title ERC677MultiBridgeMintableToken
 * @dev This contract extends ERC677MultiBridgeToken to support several bridge simulteniously.
 * Every bridge is allowed to mint tokens
 */
contract ERC677MultiBridgeMintableToken is ERC677MultiBridgeToken {
    constructor(string _name, string _symbol, uint8 _decimals, uint256 _chainId)
        public
        ERC677MultiBridgeToken(_name, _symbol, _decimals, _chainId)
    {
    }
    modifier hasMintPermission() {
        require(isBridge(msg.sender));
        _;
    }
}
