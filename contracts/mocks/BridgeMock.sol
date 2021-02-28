pragma solidity 0.4.24;

import "../interfaces/IMintHandler.sol";
import "../interfaces/IBurnableMintableERC677Token.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract BridgeMock is IMintHandler {
    IBurnableMintableERC677Token public token;

    constructor(address _token) public {
        token = IBurnableMintableERC677Token(_token);
    }

    function mint(address _to, uint256 _amount) external returns (bool) {
        return token.mint(_to, _amount);
    }
}
