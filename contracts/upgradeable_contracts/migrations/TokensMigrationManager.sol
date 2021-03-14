pragma solidity 0.4.24;

import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../Ownable.sol";

contract TokensMigrationManager is Ownable {
    event TokenUpgraded(address indexed deprecatedToken, address indexed upgradedToken);

    function upgradeToken(address _deprecatedToken, address _upgradedToken) public onlyOwner {
        _setDeprecatedTokenAddressPair(_deprecatedToken, _upgradedToken);
        emit TokenUpgraded(_deprecatedToken, _upgradedToken);
    }

    function _setDeprecatedTokenAddressPair(address _deprecatedToken, address _upgradedToken) internal {
        addressStorage[keccak256(abi.encodePacked("deprecatedTokenAddress", _upgradedToken))] = _deprecatedToken;
        addressStorage[keccak256(abi.encodePacked("upgradedTokenAddress", _deprecatedToken))] = _upgradedToken;
    }

    function upgradedTokenAddress(address _deprecatedToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("upgradedTokenAddress", _deprecatedToken))];
    }

    function deprecatedTokenAddress(address _upgradedToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("deprecatedTokenAddress", _upgradedToken))];
    }

    // CHeck if re-enterncy is possible here. seems like no way.
    function migrateTokens(IBurnableMintableERC677Token deprecatedToken, uint256 _value) public {
        address upgradedToken = upgradedTokenAddress(deprecatedToken);
        require(upgradedToken != address(0));
        deprecatedToken.transferFrom(msg.sender, address(this), _value);
        IBurnableMintableERC677Token(upgradedToken).mint(msg.sender, _value);
        deprecatedToken.burn(_value);
    }
}
