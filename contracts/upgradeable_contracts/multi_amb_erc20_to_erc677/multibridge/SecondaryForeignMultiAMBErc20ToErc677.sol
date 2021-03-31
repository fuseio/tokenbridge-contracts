pragma solidity 0.4.24;

import "../ForeignMultiAMBErc20ToErc677.sol";
import "./PrimaryHomeMultiAMBErc20ToErc677.sol";

/**
 * @title SecondaryForeignMultiAMBErc20ToErc677
 * @dev Secondary foreign side bridge implementation for multi-erc20-to-erc677 mediator intended to work on top of AMB bridge.
 * Secondary bridge works with a defined set of tokens, only owner can add new pairs to the set.
 * He is reponsible for registration of secondary bridges, and the registration on the tokens by the bridges.
 *
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract SecondaryForeignMultiAMBErc20ToErc677 is ForeignMultiAMBErc20ToErc677 {
    /**
     * @dev Executes action on deposit of bridged tokens
     * @param _token address of the token contract
     * @param _from address of tokens sender
     * @param _value requsted amount of bridged tokens
     * @param _data alternative receiver, if specified
     */
    function bridgeSpecificActionsOnTokenTransfer(
        ERC677 _token,
        address _from,
        uint256 _value,
        bytes _data
    ) internal {
        if (lock()) return;

        bool isKnownToken = isTokenRegistered(_token);
        if (!isKnownToken) {
            require(_from == owner());
            string memory name = TokenReader.readName(_token);
            string memory symbol = TokenReader.readSymbol(_token);
            uint8 decimals = uint8(TokenReader.readDecimals(_token));

            require(bytes(name).length > 0 || bytes(symbol).length > 0);

            _initializeTokenBridgeLimits(_token, decimals);
        }

        require(withinLimit(_token, _value));
        addTotalSpentPerDay(_token, getCurrentDay(), _value);

        bytes memory data;
        address receiver = chooseReceiver(_from, _data);

        if (isKnownToken) {
            data = abi.encodeWithSelector(this.handleBridgedTokens.selector, _token, receiver, _value);
        } else {
            data = abi.encodeWithSelector(
                PrimaryHomeMultiAMBErc20ToErc677(this).deployAndHandleBridgedTokens.selector,
                _token,
                name,
                symbol,
                decimals,
                receiver,
                _value
            );
        }

        _setMediatorBalance(_token, mediatorBalance(_token).add(_value));

        bytes32 _messageId =
            bridgeContract().requireToPassMessage(mediatorContractOnOtherSide(), data, requestGasLimit());

        setMessageToken(_messageId, _token);
        setMessageValue(_messageId, _value);
        setMessageRecipient(_messageId, _from);

        if (!isKnownToken) {
            _setTokenRegistrationMessageId(_token, _messageId);
        }
    }
}
