pragma solidity 0.4.24;

interface IBridgeRegistry {
    function addBridge(address _bridge) external;
    function removeBridge(address _bridge) external;
    function bridgeList() external view returns (address[]);
    function isBridge(address _address) public view returns (bool);
}
