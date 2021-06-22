pragma solidity 0.4.24;

import "./TokensMigrationManager.sol";
import "../Ownable.sol";
import "../Initializable.sol";


/**
* @title BridgedTokensMigrator
* @dev Migrator of the deprecared bridged tokens is used to swap the deprecated token to the upgraded one in 1-1 ratio.
* It is design to be used as implementation contract of EternalStorageProxy contract.
*/
contract BridgedTokensMigrator is Initializable, TokensMigrationManager {

  function initialize(
        address _owner
    ) public onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(_owner != address(0));

        setOwner(_owner);
        setInitialize();

        return isInitialized();
    }

    /**
     * @dev Allows the current owner or proxy to transfer control of the contract to a newOwner
     * @param newOwner the address to transfer ownership to
     */
    function transferOwnership(address newOwner) external onlyRelevantSender {
        require(newOwner != address(0));
        setOwner(newOwner);
    }
}