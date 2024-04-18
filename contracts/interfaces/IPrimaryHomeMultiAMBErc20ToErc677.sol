pragma solidity 0.4.24;

import "./IAMB.sol";

interface IPrimaryHomeMultiAMBErc20ToErc677 {
    function tokenImage() external view returns (address);
    function bridgeContract() external view returns (IAMB);
}
