// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./IDoubleDiceLazyPoolLocking.sol";
import "./library/FixedPointTypes.sol";

contract DoubleDiceDistributeLazyPoolPayout is Ownable, ReentrancyGuard {

  using FixedPointTypes for UFixed256x18;
  using SafeERC20 for IERC20;

  IDoubleDiceLazyPoolLocking immutable public doubleDiceLazyPoolLocking;
  IERC20 immutable public distributableToken;

  struct Config {
    uint256 firstQuarterDay;
    uint256 lastQuarterDay;
    uint256 earliestStakingTime;
    uint256 latestStakingTime;
    uint256 maxLockDurationInDays;
    uint256 tokenPerValue;
    uint256 dateWeight;
    uint256 lengthWeight;
  }
  mapping(uint256 => Config) public config;
  mapping(address => mapping(uint256 => uint256)) public userAmountClaimed;

  uint256 public currentConfigNumber = 0;
  uint32 public constant ONE_DAY = 1 days;

  error TransferFailed();
  error ZeroAddress();

  constructor(address _distributableToken, address lazyPoolAddress) {

    if (_distributableToken == address(0)) revert ZeroAddress();
    if (lazyPoolAddress == address(0)) revert ZeroAddress();

    distributableToken = IERC20(_distributableToken);
    doubleDiceLazyPoolLocking = IDoubleDiceLazyPoolLocking(lazyPoolAddress);
  }

  error NoClaimableAmount();

  event Claim(
    address indexed sender,
    uint256 amount 
  );

  function claimPayout() external nonReentrant {
    uint256 totalPayoutAmount = 0;
    IDoubleDiceLazyPoolLocking.UserLock memory lockInfo = doubleDiceLazyPoolLocking.getUserLockInfo(_msgSender());

    uint256 startTime = lockInfo.startTime;
    uint256 expiryTime = lockInfo.expiryTime;
    uint256 amount = lockInfo.amount;

    for (uint256 i = 0; i < currentConfigNumber; i++) {
      Config memory _config = config[i];

      if (
        (startTime >= _config.earliestStakingTime && startTime <= _config.latestStakingTime) &&
        userAmountClaimed[msg.sender][i] == 0
      ) {
        uint256 payoutAmount = weightedToken(startTime, expiryTime, amount, i).mul0(_config.tokenPerValue).floorToUint256() / 1e18;

        userAmountClaimed[msg.sender][i] = payoutAmount;
        totalPayoutAmount += payoutAmount;
      } 
    }

    if (totalPayoutAmount == 0) revert NoClaimableAmount();

    bool isSent = distributableToken.transfer(_msgSender(), totalPayoutAmount);

    if (!isSent) revert TransferFailed();

    emit Claim(_msgSender(), totalPayoutAmount);
  }

  event SetPayoutConfiguration(Config newConfig);

  function setPayoutConfiguration(Config memory newConfig) external onlyOwner {
    config[currentConfigNumber] = Config({
      firstQuarterDay: newConfig.firstQuarterDay,
      lastQuarterDay: newConfig.lastQuarterDay,
      earliestStakingTime: newConfig.earliestStakingTime,
      latestStakingTime: newConfig.latestStakingTime,
      maxLockDurationInDays: newConfig.maxLockDurationInDays,
      tokenPerValue: newConfig.tokenPerValue,
      dateWeight: newConfig.dateWeight,
      lengthWeight: newConfig.lengthWeight
    });

    emit SetPayoutConfiguration(config[currentConfigNumber]);

    currentConfigNumber++;

  }

  event UpdatePayoutConfiguration(
    uint256 configNumber,
    Config newConfig
  );

  error InvalidConfigNumber();

  function updatePayoutConfiguration(Config memory newConfig, uint256 configNumber) external onlyOwner {
    if (configNumber >= currentConfigNumber) revert InvalidConfigNumber();

    Config storage config_ = config[configNumber];

    config_.firstQuarterDay = newConfig.firstQuarterDay;
    config_.lastQuarterDay = newConfig.lastQuarterDay;
    config_.earliestStakingTime = newConfig.earliestStakingTime;
    config_.latestStakingTime = newConfig.latestStakingTime;
    config_.maxLockDurationInDays = newConfig.maxLockDurationInDays;
    config_.tokenPerValue = newConfig.tokenPerValue;
    config_.dateWeight = newConfig.dateWeight;
    config_.lengthWeight = newConfig.lengthWeight;

    emit UpdatePayoutConfiguration(configNumber, config[configNumber]);

  }

  event WithdrawToken(
    address indexed receiver,
    address indexed tokenAddress,
    uint256 amount
  );

  error ZeroBalance();

  function withdrawToken(address tokenAddress, address receiver) external onlyOwner nonReentrant{
    uint256 balance = IERC20(tokenAddress).balanceOf(address(this));

    if (balance > 0) {
      bool isSent = IERC20(tokenAddress).transfer(receiver, balance);
      if (!isSent) revert TransferFailed();
    }
    else revert ZeroBalance();

    emit WithdrawToken(receiver, tokenAddress, balance);
  }

  function getPayoutAmount(address userAddress) external view returns (uint256 payoutAmount) {
    payoutAmount = 0;
    IDoubleDiceLazyPoolLocking.UserLock memory lockInfo = doubleDiceLazyPoolLocking.getUserLockInfo(userAddress);

    uint256 startTime = lockInfo.startTime;
    uint256 expiryTime = lockInfo.expiryTime;
    uint256 amount = lockInfo.amount;

    for (uint256 i = 0; i < currentConfigNumber; i++) {
      Config memory _config = config[i];
      if (
        (startTime >= _config.earliestStakingTime && startTime <= _config.latestStakingTime) &&
        userAmountClaimed[msg.sender][i] == 0
      ) {
        payoutAmount += weightedToken(startTime, expiryTime, amount, i).mul0(_config.tokenPerValue).floorToUint256() / 1e18;
      } 
    }
  }

  function getConfigurationByNumber(uint256 configNumber) external view returns (Config memory) {
    return config[configNumber];
  }

  function getUserAmountClaimed(address user, uint256 configNumber) external view returns (uint256) {
    return userAmountClaimed[user][configNumber];
  }

  function distanceFromEarliestStaking(uint256 startTime, uint256 configNumber) internal view returns (uint256) {
    return (startTime - config[configNumber].earliestStakingTime) / ONE_DAY;
  }

  function dateCoefficient(uint256 startTime, uint256 configNumber) internal view returns (UFixed256x18) {
    uint256 distanceFromEarliestStake = distanceFromEarliestStaking(startTime, configNumber);
    uint256 daysBetweenEarliestAndLatestStake = (config[configNumber].latestStakingTime - config[configNumber].earliestStakingTime) / ONE_DAY;

    UFixed256x18 earliestTimeDiff = FixedPointTypes.toUFixed256x18(distanceFromEarliestStake).div0(daysBetweenEarliestAndLatestStake);

    return UFIXED256X18_ONE.sub(earliestTimeDiff);
  }

  function lengthOfLock(uint256 startTime, uint256 expiryTime) internal pure returns (uint256) {
    return (expiryTime - startTime) / ONE_DAY;
  }

  function lengthCoefficient(uint256 startTime, uint256 expiryTime, uint256 configNumber) internal view returns (UFixed256x18) {
    return FixedPointTypes.toUFixed256x18(lengthOfLock(startTime, expiryTime)).div0(config[configNumber].maxLockDurationInDays);
  }

  function lockDaysWithinQuarter(uint256 startTime, uint256 configNumber) internal view returns (uint256) {
    Config memory _config = config[configNumber];
    uint256 _firstQuarterDay = 0;
    if (startTime < _config.firstQuarterDay) {
      _firstQuarterDay = _config.firstQuarterDay;
    } else {
      _firstQuarterDay = startTime;
    }
    return (_config.lastQuarterDay - _firstQuarterDay) / ONE_DAY;
  }

  function quarterlyCoverage(uint256 startTime, uint256 configNumber) internal view returns (UFixed256x18) {
    Config memory _config = config[configNumber];
    uint256 daysWithinFirstAndLastQuater = (_config.lastQuarterDay - _config.firstQuarterDay) / ONE_DAY;
    return FixedPointTypes.toUFixed256x18(lockDaysWithinQuarter(startTime, configNumber)).div0(daysWithinFirstAndLastQuater);
  }

  function overallWeight(uint256 startTime, uint256 expiryTime, uint256 configNumber) internal view returns (UFixed256x18) {
    Config memory _config = config[configNumber];

    UFixed256x18 firstSummation = dateCoefficient(startTime, configNumber).mul0(_config.dateWeight).div0(1e18);
    UFixed256x18 secondSummation = lengthCoefficient(startTime, expiryTime, configNumber).mul0(_config.lengthWeight).div0(1e18);

    UFixed256x18 summation = firstSummation.add(secondSummation);
    return summation.add(quarterlyCoverage(startTime, configNumber));
  }

  function weightedToken(uint256 startTime, uint256 expiryTime, uint256 amountStaked, uint256 configNumber) internal view returns (UFixed256x18) {
    return overallWeight(startTime, expiryTime, configNumber).mul0(amountStaked).div0(1e18);
  }
    
}
