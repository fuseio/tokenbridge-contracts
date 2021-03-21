pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "../HomeMultiAMBErc20ToErc677.sol";
import "../../../interfaces/IBridgeRegistry.sol";
import "../../../interfaces/IBridgedTokensMigrator.sol";

/**
 * @title PrimaryHomeMultiAMBErc20ToErc677
 * @dev Primary home side bridge implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
 * Primary bridge is the master of the various multi-erc20-to-erc677 bridges connected to different blockchains.
 * He is reponsible for registration of secondary bridges, and the registration on the tokens by the bridges.
 *
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract PrimaryHomeMultiAMBErc20ToErc677 is HomeMultiAMBErc20ToErc677 {
    event TokenDeprecated(address indexed token);

    /**
     * @dev Handles the bridged tokens for the first time, includes deployment of new TokenProxy contract.
     * Checks that the value is inside the execution limits and invokes the method
     * to execute the Mint or Unlock accordingly.
     * @param _token address of the bridged ERC20/ERC677 token on the foreign side.
     * @param _name name of the bridged token, "x" will be appended, if empty, symbol will be used instead.
     * @param _symbol symbol of the bridged token, "x" will be appended, if empty, name will be used instead.
     * @param _decimals decimals of the bridge foreign token.
     * @param _recipient address that will receive the tokens.
     * @param _value amount of tokens to be received.
     */
    function deployAndHandleBridgedTokens(
        address _token,
        string _name,
        string _symbol,
        uint8 _decimals,
        address _recipient,
        uint256 _value
    ) external onlyMediator {
        string memory name = _name;
        string memory symbol = _symbol;
        if (bytes(name).length == 0) {
            name = symbol;
        } else if (bytes(symbol).length == 0) {
            symbol = name;
        }
        name = string(abi.encodePacked(name, " on Fuse"));
        address homeToken = initializeTokenPair(_token, name, symbol, _decimals);
        _handleBridgedTokens(ERC677(homeToken), _recipient, _value);
        emit NewTokenRegistered(_token, homeToken);
    }

    function initializeTokenPair(
        address _token,
        string _name,
        string _symbol,
        uint8 _decimals
    ) internal returns (address) {
        address homeToken = new TokenProxy(tokenImage(), _name, _symbol, _decimals, bridgeContract().sourceChainId());
        IBridgeRegistry(homeToken).addBridge(address(this));
        _setTokenAddressPair(_token, homeToken);
        _initializeTokenBridgeLimits(homeToken, _decimals);
        _setFee(HOME_TO_FOREIGN_FEE, homeToken, getFee(HOME_TO_FOREIGN_FEE, address(0)));
        _setFee(FOREIGN_TO_HOME_FEE, homeToken, getFee(FOREIGN_TO_HOME_FEE, address(0)));
        return homeToken;
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

    function upgradeToken(address _deprecatedToken, IBridgedTokensMigrator migratorContract) external onlyOwner {
        require(isTokenRegistered(_deprecatedToken));
        address foreignToken = foreignTokenAddress(_deprecatedToken);

        // disable relaying the token to foregin network
        _setMaxPerTx(_deprecatedToken, uint256(0));
        // unregistering the deprecated token
        _setMinPerTx(_deprecatedToken, uint256(0));

        DetailedERC20 token = DetailedERC20(_deprecatedToken);
        string memory name = token.name();
        string memory symbol = token.symbol();
        uint8 decimals = token.decimals();
        address upgradedToken = initializeTokenPair(foreignToken, name, symbol, decimals);
        // Adding migrator contract as a bridge, so it will be able to mint tokens
        IBridgeRegistry(upgradedToken).addBridge(migratorContract);
        migratorContract.upgradeToken(_deprecatedToken, upgradedToken);

        emit TokenDeprecated(_deprecatedToken);
        emit NewTokenRegistered(foreignToken, upgradedToken);
    }

}
