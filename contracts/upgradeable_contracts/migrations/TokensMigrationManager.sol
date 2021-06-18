pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../../interfaces/IAMB.sol";
import "../../interfaces/IBridgeRegistry.sol";
import "../Ownable.sol";
import "../multi_amb_erc20_to_erc677/TokenProxy.sol";

interface IPrimaryHomeMultiAMBErc20ToErc677 {
    function tokenImage() external view returns (address);
    function bridgeContract() external view returns (IAMB);
}

/**
* @title TokensMigrationManager
* @dev Migrator of deprecared tokens is used to swap the deprecated token to the upgraded one in 1-1 ratio.
*/
contract TokensMigrationManager is Ownable {
    event TokenUpgraded(address indexed deprecatedToken, address indexed upgradedToken);

    /**
     * @dev Handles upgrading of decprecated token, by deploying a new TokenProxy contract.
     * Checks if token has already been upgraded and registers the pair of the deprecated and upgraded token.
     * @param _deprecatedToken address of the bridged ERC20/ERC677 deprecated token
     * @param _bridge address of the primary home token bridge
     */
    function upgradeToken(DetailedERC20 _deprecatedToken, IPrimaryHomeMultiAMBErc20ToErc677 _bridge) public onlyOwner {
        address upgradedToken = new TokenProxy(
            _bridge.tokenImage(), 
            _deprecatedToken.name(), 
            _deprecatedToken.symbol(), 
            _deprecatedToken.decimals(), 
            _bridge.bridgeContract().sourceChainId()
        );
        
        require(upgradedTokenAddress(_deprecatedToken) == address(0));
        require(deprecatedTokenAddress(_deprecatedToken) == address(0));
        _setDeprecatedTokenAddressPair(_deprecatedToken, upgradedToken);
        
        emit TokenUpgraded(_deprecatedToken, upgradedToken);
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

        /**
     * @dev Adding new bridge to the provided multibridge token. The mew bridge contract will be allowed to mint
     * @param _bridge address of a new token bridge to another network
     * @param _token address of the bridged ERC20/ERC677 token on the home side.
     */
    function addBridgePerToken(address _bridge, address _token) external onlyOwner {
        IBridgeRegistry(_token).addBridge(_bridge);
    }

    /**
     * @dev Removing the bridge from the provided multibridge token. The bridge contract will be restricted from minting
     * @param _bridge address of a new token bridge to another network
     * @param _token address of the bridged ERC677MultiBridgeMintableToken token on the home side.
     */
    function removeBridgePerToken(address _bridge, address _token) external onlyOwner {
        IBridgeRegistry(_token).removeBridge(_bridge);
    }
}
