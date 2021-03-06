pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "../HomeMultiAMBErc20ToErc677.sol";

/**
 * @title SecondaryHomeMultiAMBErc20ToErc677
 * @dev Primary home side bridge implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
 * Primary bridge is the master of the various multi-erc20-to-erc677 bridges connected to different blockchains.
 * He is reponsible for registration of secondary bridges, and the registration on the tokens by the bridges.
 *
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract SecondaryHomeMultiAMBErc20ToErc677 is HomeMultiAMBErc20ToErc677 {
    /**
     * @dev Handles the bridged tokens for the first time, includes token registration via the Primary bridge.
     * Checks that the value is inside the execution limits and invokes the method
     * to execute the Mint or Unlock accordingly.
     * @param _token address of the bridged ERC20/ERC677 token on the foreign side.
     * @param _homeToken address of the existing ERC677 MultiBridgeToken
     */
    function registerBridgedTokens(address _token, address _homeToken) external onlyOwner {
        require(homeTokenAddress(_token) == address(0));
        require(foreignTokenAddress(_homeToken) == address(0));
        _setTokenAddressPair(_token, _homeToken);
        _initializeTokenBridgeLimits(_homeToken, DetailedERC20(_homeToken).decimals());
        _setFee(HOME_TO_FOREIGN_FEE, _homeToken, getFee(HOME_TO_FOREIGN_FEE, address(0)));
        _setFee(FOREIGN_TO_HOME_FEE, _homeToken, getFee(FOREIGN_TO_HOME_FEE, address(0)));
    }

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
        address homeToken = homeTokenAddress(_token);
        _handleBridgedTokens(ERC677(homeToken), _recipient, _value);
        emit NewTokenRegistered(_token, homeToken);
    }
}
