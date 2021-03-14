pragma solidity 0.4.24;

import "./TokensMigrationManager.sol";
import "../Ownable.sol";
import "../Initializable.sol";


/**
* @title BridgedTokensMigrator
* @dev Migrator of the bridges tokens is used to swap the deprecated token the upgraded one with 1-1 ratio.
* It is design to be used as implementation contract of EternalStorageProxy contract.
*/
contract BridgedTokensMigrator is Initializable, TokensMigrationManager {

  function initialize(
        address _owner
    ) public onlyRelevantSender returns (bool) {
        require(!isInitialized());
        setOwner(_owner);
        setInitialize();

        return isInitialized();
    }
}