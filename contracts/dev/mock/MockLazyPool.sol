// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.17;


contract MockLazyPool {

  struct UserLock {
    uint256 amount;
    uint256 startTime;
    uint256 expiryTime;
    bool    hasLock;
    bool    claimed;
  }

  mapping(address => UserLock) public userLock;
  
  event UserLockInfo(
    address indexed user, 
    uint256 amount,
    uint256 startTime,
    uint256 expiryTime
  );    

  function createLock(uint256 amount, uint256 startTime, uint256 expiryTime) external {
    require(!userLock[msg.sender].hasLock, "User already created a lock");

    userLock[msg.sender] = UserLock({
      amount: amount,
      startTime: startTime,
      expiryTime: expiryTime,
      hasLock: true,
      claimed: false
    });
    
    emit UserLockInfo(msg.sender, amount, startTime, expiryTime);
  }

  function getUserLockInfo(address user) external view returns(UserLock memory) {
    return userLock[user];
  }
    
}



