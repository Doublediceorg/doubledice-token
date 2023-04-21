import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import assert from 'assert';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { BigNumber as BigInteger } from 'ethers';
import { ethers } from 'hardhat';
import { 
  MockLazyPool__factory, 
  DoubleDiceDistributeLazyPoolPayout__factory, 
  DummyERC20, 
  DummyERC20__factory, 
  DoubleDiceDistributeLazyPoolPayout, 
  MockLazyPool
} from '../typechain-types';
import { ConfigStruct } from '../typechain-types/DoubleDiceDistributeLazyPoolPayout';

import { $, increaseTimestampByDays, ONE_DAY } from './lib/utils';

chai.use(chaiAsPromised);

describe('DoubleDiceDistributeLazyPoolPayout', () => {

  let ownerSigner: SignerWithAddress;
  let lazyPoolDeployer: SignerWithAddress;

  let USER0: SignerWithAddress;
  let USER1: SignerWithAddress;
  let USER2: SignerWithAddress;
  let USER3: SignerWithAddress;
  let USER4: SignerWithAddress;
  let USER5: SignerWithAddress;
  let USER6: SignerWithAddress;
  let USER7: SignerWithAddress;

  let lazyPool: MockLazyPool;
  let distributeLazyPoolPayout: DoubleDiceDistributeLazyPoolPayout;
  let dummyUSDT: DummyERC20;

  const STAKE_AMOUNT = $(100_000);
  const totalDistributableAmount = 10000000000; // 10,000 USDT
  const ZERO_BIGINT = BigInteger.from(0); 
  // const totalLockedWeightedTokenAmount = BigInteger.from('1239136750000000000000000'); // 1239136.75


  const user3StartTime = 1644879600; // 15/02/2022
  const user4StartTime = 1647298800; // 15/03/2022
  const user5StartTime = 1648162800; // 25/03/2022
  const user6StartTime = 1649977200; // 15/04/2022

  const earliestStakingTime = 1644361200; // 09/02/2022

  const config: ConfigStruct = {
    firstQuarterDay: BigInteger.from(1648767600), // 01/04/2022;
    lastQuarterDay: BigInteger.from(1656543600), // 30/06/2022
    earliestStakingTime: BigInteger.from(earliestStakingTime), // 09/02/2022
    latestStakingTime: BigInteger.from(1649977200),  // 15/04/2022
    maxLockDurationInDays: 1500,
    tokenPerValue: '8070000000000001', // 0.008070
    dateWeight: BigInteger.from('250000000000000000'), // 0.25%
    lengthWeight: BigInteger.from('2000000000000000000'), // 2
  };


  // [1644274800, 1675119600, 1644274800, 1674255600, 2913539, "4332000000000000000", "250000000000000000", "2000000000000000000", "185366159030000000000000000"]


  before(async () => {
    [ownerSigner, lazyPoolDeployer, USER0, USER1, USER2, USER3, USER4, USER5, USER6, USER7] = await ethers.getSigners();

    dummyUSDT = await new DummyERC20__factory(ownerSigner).deploy('USD Tether', 'USDT', 6);

    lazyPool = await new MockLazyPool__factory(lazyPoolDeployer).deploy();

    distributeLazyPoolPayout = await new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
      dummyUSDT.address,
      lazyPool.address
    );

    await distributeLazyPoolPayout.connect(lazyPoolDeployer).setPayoutConfiguration(config);

    await lazyPool.connect(USER1).createLock(STAKE_AMOUNT, earliestStakingTime, increaseTimestampByDays(earliestStakingTime, 720));
    await lazyPool.connect(USER2).createLock(STAKE_AMOUNT, earliestStakingTime, increaseTimestampByDays(earliestStakingTime, 365));
    await lazyPool.connect(USER3).createLock(STAKE_AMOUNT, user3StartTime,      increaseTimestampByDays(user3StartTime, 900));
    await lazyPool.connect(USER4).createLock(STAKE_AMOUNT, user4StartTime,      increaseTimestampByDays(user4StartTime, 365));
    await lazyPool.connect(USER5).createLock(STAKE_AMOUNT, user5StartTime,      increaseTimestampByDays(user5StartTime, 365));
    await lazyPool.connect(USER6).createLock(STAKE_AMOUNT, user6StartTime,      increaseTimestampByDays(user6StartTime, 1500));

    await lazyPool.connect(USER7).createLock(STAKE_AMOUNT, user6StartTime,      increaseTimestampByDays(user6StartTime, 1500));
    
    await lazyPool.connect(USER0).createLock(STAKE_AMOUNT, (earliestStakingTime - ONE_DAY), increaseTimestampByDays(user6StartTime, 1500));

    await dummyUSDT.connect(ownerSigner).mint(distributeLazyPoolPayout.address, totalDistributableAmount);

  });

  describe('Contract deployment', () => {

    it('Should return error when invalid data are used for deployment', async () => {
      await expect(new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        ethers.constants.AddressZero,
        lazyPool.address
      )).to.be.revertedWith('ZeroAddress()');

      await expect(new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        dummyUSDT.address,
        ethers.constants.AddressZero
      )).to.be.revertedWith('ZeroAddress()');

    });

    it('Should deploy with correct params', async () => {
      await expect(new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        dummyUSDT.address,
        lazyPool.address,
      )).to.be.fulfilled;
    });

  });

  describe('Set Configuration', () => {

    it('Should deploy with correct params', async () => {
      const distributeLazyPoolPayout = await new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        dummyUSDT.address,
        lazyPool.address
      );
      const result = await distributeLazyPoolPayout.connect(lazyPoolDeployer).setPayoutConfiguration(config);
      const configData = await distributeLazyPoolPayout.connect(lazyPoolDeployer).getConfigurationByNumber(0);

      expect(configData.earliestStakingTime).to.eq(BigInteger.from(earliestStakingTime));

      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'SetPayoutConfiguration');
      
      expect(event).to.not.be.undefined;

      assert(event?.args);

      expect(event.args['newConfig']['firstQuarterDay']).to.eq(configData.firstQuarterDay);
      expect(event.args['newConfig']['lastQuarterDay']).to.eq(configData.lastQuarterDay);
      expect(event.args['newConfig']['earliestStakingTime']).to.eq(configData.earliestStakingTime);
      expect(event.args['newConfig']['latestStakingTime']).to.eq(configData.latestStakingTime);
      expect(event.args['newConfig']['maxLockDurationInDays']).to.eq(BigInteger.from(configData.maxLockDurationInDays));
      expect(event.args['newConfig']['tokenPerValue'].toString()).to.eq(configData.tokenPerValue);
      expect(event.args['newConfig']['dateWeight']).to.eq(configData.dateWeight);
      expect(event.args['newConfig']['lengthWeight']).to.eq(configData.lengthWeight);
      
      const currentConfigNumber = await distributeLazyPoolPayout.connect(lazyPoolDeployer).currentConfigNumber();
      
      expect(currentConfigNumber).to.eq(BigInteger.from(1));


    });

    it('Should fail if non owner wants to set configuration', async () => {
      const distributeLazyPoolPayout = await new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        dummyUSDT.address,
        lazyPool.address
      );

      await expect(
        distributeLazyPoolPayout.connect(USER0).setPayoutConfiguration(config)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

  });

  describe('Update Configuration', () => {

    it('Should update configuration correctly and revert for invalid config number', async () => {
      const distributeLazyPoolPayout = await new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        dummyUSDT.address,
        lazyPool.address
      );
      await distributeLazyPoolPayout.connect(lazyPoolDeployer).setPayoutConfiguration(config);

      const newTokenValue = BigInteger.from('6204000000000000000');

      await expect(
        distributeLazyPoolPayout.connect(lazyPoolDeployer).updatePayoutConfiguration({ ...config, tokenPerValue: newTokenValue }, 1)
      ).to.be.revertedWith('InvalidConfigNumber()');

      const result = await distributeLazyPoolPayout.connect(lazyPoolDeployer).updatePayoutConfiguration({ ...config, tokenPerValue: newTokenValue }, 0);
      const configData = await distributeLazyPoolPayout.connect(lazyPoolDeployer).getConfigurationByNumber(0);

      expect(configData.tokenPerValue).to.eq(newTokenValue);

      const contractReceipt = await result.wait();
      const event = contractReceipt.events?.find(event => event.event === 'UpdatePayoutConfiguration');
      
      expect(event).to.not.be.undefined;

      assert(event?.args);

      expect(event.args['configNumber']).to.eq(BigInteger.from(0));

      expect(event.args['newConfig']['firstQuarterDay']).to.eq(configData.firstQuarterDay);
      expect(event.args['newConfig']['lastQuarterDay']).to.eq(configData.lastQuarterDay);
      expect(event.args['newConfig']['earliestStakingTime']).to.eq(configData.earliestStakingTime);
      expect(event.args['newConfig']['latestStakingTime']).to.eq(configData.latestStakingTime);
      expect(event.args['newConfig']['maxLockDurationInDays']).to.eq(BigInteger.from(configData.maxLockDurationInDays));
      expect(event.args['newConfig']['tokenPerValue'].toString()).to.eq(newTokenValue);
      expect(event.args['newConfig']['dateWeight']).to.eq(configData.dateWeight);
      expect(event.args['newConfig']['lengthWeight']).to.eq(configData.lengthWeight);
      
    });

    it('Should fail if non owner wants to set configuration', async () => {
      const distributeLazyPoolPayout = await new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        dummyUSDT.address,
        lazyPool.address
      );

      await expect(
        distributeLazyPoolPayout.connect(USER0).setPayoutConfiguration(config)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

  });

  describe('WithdrawToken', () => {

    it('Should be able to withdraw token', async () => {

      const distributeLazyPoolPayout = await new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        dummyUSDT.address,
        lazyPool.address
      );

      await dummyUSDT.connect(ownerSigner).mint(distributeLazyPoolPayout.address, totalDistributableAmount);

      let balance = await dummyUSDT.balanceOf(lazyPoolDeployer.address);
      expect(balance).to.eq(ZERO_BIGINT);
      
      const result = await distributeLazyPoolPayout.connect(lazyPoolDeployer).withdrawToken(dummyUSDT.address, lazyPoolDeployer.address);
      
      balance = await dummyUSDT.balanceOf(lazyPoolDeployer.address);
      expect(balance).to.eq(BigInteger.from(totalDistributableAmount));

      const contractReceipt = await result.wait();

      const event = contractReceipt.events?.find(event => event.event === 'WithdrawToken');

      expect(event).to.not.be.undefined;
      assert(event?.args);

      expect(event.args['receiver']).to.eq(lazyPoolDeployer.address);
      expect(event.args['tokenAddress']).to.eq(dummyUSDT.address);
      expect(event.args['amount']).to.eq(totalDistributableAmount);

      await expect(distributeLazyPoolPayout.connect(lazyPoolDeployer).withdrawToken(dummyUSDT.address, lazyPoolDeployer.address))
        .to.be.revertedWith('ZeroBalance()');

    });

    it('Should fail if non owner wants to withdraw token', async () => {
      const distributeLazyPoolPayout = await new DoubleDiceDistributeLazyPoolPayout__factory(lazyPoolDeployer).deploy(
        dummyUSDT.address,
        lazyPool.address
      );

      await expect(
        distributeLazyPoolPayout.connect(USER0).withdrawToken(dummyUSDT.address, lazyPoolDeployer.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

  });

  describe('Claim', () => {
    it('Should check successful claim event', async () => {
      const totalClaimableAmount = await distributeLazyPoolPayout.connect(USER7).getPayoutAmount(USER7.address);

      const result = await distributeLazyPoolPayout.connect(USER7).claimPayout();
      const contractReceipt = await result.wait();

      const event = contractReceipt.events?.find(event => event.event === 'Claim');

      expect(event).to.not.be.undefined;
      assert(event?.args);     
      
      expect(event.args['sender']).to.eq(USER7.address);
      expect(event.args['amount']).to.eq(totalClaimableAmount);

    });

    it('Should only allow claim in eligible period', async () => {
      let balance = await dummyUSDT.balanceOf(USER0.address);
      expect(balance).to.eq(ZERO_BIGINT);

      await expect(distributeLazyPoolPayout.connect(USER0).claimPayout()).to.be.revertedWith('NoClaimableAmount()');

      balance = await dummyUSDT.balanceOf(USER0.address);
      expect(balance).to.eq(ZERO_BIGINT);

    });

    it('Should correct reward for USER1', async () => {
      
      let balance = await dummyUSDT.connect(USER1).balanceOf(USER1.address);
      expect(balance).to.eq(ZERO_BIGINT);
      
      const eligibleClaimAmount = '1783';

      const totalClaimableAmount = await distributeLazyPoolPayout.connect(USER1).getPayoutAmount(USER1.address);      
      expect(totalClaimableAmount.toString()).to.eq(eligibleClaimAmount);

      await distributeLazyPoolPayout.connect(USER1).claimPayout();

      balance = await dummyUSDT.connect(USER1).balanceOf(USER1.address);
      expect(balance.toString()).to.eq(eligibleClaimAmount);

      await expect(distributeLazyPoolPayout.connect(USER1).claimPayout()).to.be.revertedWith('NoClaimableAmount()');
    });

    it('Should correct reward for USER2', async () => {
      let balance = await dummyUSDT.balanceOf(USER2.address);
      expect(balance).to.eq(ZERO_BIGINT);

      const eligibleClaimAmount = '1401';

      const totalClaimableAmount = await distributeLazyPoolPayout.connect(USER2).getPayoutAmount(USER2.address);
      expect(totalClaimableAmount.toString()).to.eq(eligibleClaimAmount);

      await distributeLazyPoolPayout.connect(USER2).claimPayout();

      balance = await dummyUSDT.balanceOf(USER2.address);
      expect(balance.toString()).to.eq(eligibleClaimAmount);

      await expect(distributeLazyPoolPayout.connect(USER2).claimPayout()).to.be.revertedWith('NoClaimableAmount()');
    });

    it('Should correct reward for USER3', async () => {
      let balance = await dummyUSDT.balanceOf(USER3.address);
      expect(balance).to.eq(ZERO_BIGINT);

      const eligibleClaimAmount = '1958';

      const totalClaimableAmount = await distributeLazyPoolPayout.connect(USER3).getPayoutAmount(USER3.address);
      expect(totalClaimableAmount.toString()).to.eq(eligibleClaimAmount);

      await distributeLazyPoolPayout.connect(USER3).claimPayout();

      balance = await dummyUSDT.balanceOf(USER3.address);
      expect(balance.toString()).to.eq(eligibleClaimAmount);

      await expect(distributeLazyPoolPayout.connect(USER3).claimPayout()).to.be.revertedWith('NoClaimableAmount()');
    });

    it('Should correct reward for USER4', async () => {
      let balance = await dummyUSDT.balanceOf(USER4.address);
      expect(balance).to.eq(ZERO_BIGINT);

      const eligibleClaimAmount = '1295';

      const totalClaimableAmount = await distributeLazyPoolPayout.connect(USER4).getPayoutAmount(USER4.address);
      expect(totalClaimableAmount.toString()).to.eq(eligibleClaimAmount);

      await distributeLazyPoolPayout.connect(USER4).claimPayout();

      balance = await dummyUSDT.balanceOf(USER4.address);
      expect(balance.toString()).to.eq(eligibleClaimAmount);

      await expect(distributeLazyPoolPayout.connect(USER4).claimPayout()).to.be.revertedWith('NoClaimableAmount()');
    });

    it('Should correct reward for USER5', async () => {
      let balance = await dummyUSDT.balanceOf(USER5.address);
      expect(balance).to.eq(ZERO_BIGINT);

      const eligibleClaimAmount = '1264';

      const totalClaimableAmount = await distributeLazyPoolPayout.connect(USER5).getPayoutAmount(USER5.address);
      expect(totalClaimableAmount.toString()).to.eq(eligibleClaimAmount);

      await distributeLazyPoolPayout.connect(USER5).claimPayout();

      balance = await dummyUSDT.balanceOf(USER5.address);
      expect(balance.toString()).to.eq(eligibleClaimAmount);

      await expect(distributeLazyPoolPayout.connect(USER5).claimPayout()).to.be.revertedWith('NoClaimableAmount()');
    });

    it('Should correct reward for USER6', async () => {
      let balance = await dummyUSDT.balanceOf(USER6.address);
      expect(balance).to.eq(ZERO_BIGINT);

      const eligibleClaimAmount = '2295';

      const totalClaimableAmount = await distributeLazyPoolPayout.connect(USER6).getPayoutAmount(USER6.address);
      expect(totalClaimableAmount.toString()).to.eq(eligibleClaimAmount);

      await distributeLazyPoolPayout.connect(USER6).claimPayout();

      balance = await dummyUSDT.balanceOf(USER6.address);
      expect(balance.toString()).to.eq(eligibleClaimAmount);

      await expect(distributeLazyPoolPayout.connect(USER6).claimPayout()).to.be.revertedWith('NoClaimableAmount()');
    });

  });

});