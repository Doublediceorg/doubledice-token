// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;

interface IDoubleDiceLazyPoolLocking {

    struct UserLock {
        uint256 amount;
        uint256 startTime;
        uint256 expiryTime;
        bool    hasLock;
        bool    claimed;
    }

    function getUserLockInfo(address user) external view returns(UserLock memory);
}
