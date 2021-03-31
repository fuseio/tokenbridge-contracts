pragma solidity 0.4.24;

import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../Ownable.sol";


/**
* @title TokensMigrationManager
* @dev Migrator of deprecared tokens is used to swap the deprecated token to the upgraded one in 1-1 ratio.
*/
contract TokensMigrationManager is Ownable {
    event TokenUpgraded(address indexed deprecatedToken, address indexed upgradedToken);

    /**
     * @dev Registers the pair of the deprecated and upgraded token. Can be called by the contract owner.
     * Is is assumed that the migration contract has a permissions to mint tokens
     * @param _deprecatedToken address of the bridged ERC20/ERC677 deprecated token
     * @param _upgradedToken address of the bridged ERC20/ERC677 new upgraded token
     */
    function upgradeToken(address _deprecatedToken, address _upgradedToken) public onlyOwner {
        require(upgradedTokenAddress(_deprecatedToken) == address(0));
        require(deprecatedTokenAddress(_upgradedToken) == address(0));
        _setDeprecatedTokenAddressPair(_deprecatedToken, _upgradedToken);
        emit TokenUpgraded(_deprecatedToken, _upgradedToken);
    }

    function _setDeprecatedTokenAddressPair(address _deprecatedToken, address _upgradedToken) internal {
        addressStorage[keccak256(abi.encodePacked("deprecatedTokenAddress", _upgradedToken))] = _deprecatedToken;
        addressStorage[keccak256(abi.encodePacked("upgradedTokenAddress", _deprecatedToken))] = _upgradedToken;
    }

    /**
     * @dev Returns the upgraded token by the deprecated one
     * @param _deprecatedToken address of the bridged ERC20/ERC677 deprecated token
     */
    function upgradedTokenAddress(address _deprecatedToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("upgradedTokenAddress", _deprecatedToken))];
    }

    /**
     * @dev Returns the deprecared token by the upgraded one
     * @param _upgradedToken address of the bridged ERC20/ERC677 upgraded token
     */
    function deprecatedTokenAddress(address _upgradedToken) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("deprecatedTokenAddress", _upgradedToken))];
    }

    /**
     * @dev Swaps the deprecated token with the upgraded one
     * @param _deprecatedToken address of the bridged ERC20/ERC677 deprecated token
     * @param _value amount of the deprecated token to swap
     */
    function migrateTokens(IBurnableMintableERC677Token _deprecatedToken, uint256 _value) public {
        address upgradedToken = upgradedTokenAddress(_deprecatedToken);
        require(upgradedToken != address(0));
        _deprecatedToken.transferFrom(msg.sender, address(this), _value);
        IBurnableMintableERC677Token(upgradedToken).mint(msg.sender, _value);
        _deprecatedToken.burn(_value);
    }
}
