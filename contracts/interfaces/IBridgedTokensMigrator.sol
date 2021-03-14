pragma solidity 0.4.24;

interface IBridgedTokensMigrator {
    function upgradeToken(address _deprecatedToken, address _upgradedToken) public;
}
