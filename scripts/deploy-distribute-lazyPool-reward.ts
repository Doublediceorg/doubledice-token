import is from '@sindresorhus/is';
import assert from 'assert';
import { BigNumber as BigInteger } from 'ethers';

import hre, { ethers } from 'hardhat';
import { DoubleDiceDistributeLazyPoolPayout__factory } from '../typechain-types';
import { ConfigStruct } from '../typechain-types/DoubleDiceDistributeLazyPoolPayout';
import { pressAnyKey } from './utils';

const {
  OWNER_ADDRESS,
  INIT_TOKEN_SUPPLY,
  INIT_TOKEN_HOLDER_ADDRESS,
  TOTAL_YIELD_AMOUNT,
  MAX_FEE_PER_GAS_IN_GWEI,
  MAX_PRIORITY_FEE_PER_GAS_IN_GWEI,
  CHAIN_ID
} = process.env;


async function main() {
  assert(is.string(OWNER_ADDRESS), `OWNER_ADDRESS = ${OWNER_ADDRESS}`);
  assert(is.string(INIT_TOKEN_SUPPLY), `INIT_TOKEN_SUPPLY = ${INIT_TOKEN_SUPPLY}`);
  assert(is.string(TOTAL_YIELD_AMOUNT), `TOTAL_YIELD_AMOUNT = ${TOTAL_YIELD_AMOUNT}`);
  assert(is.string(INIT_TOKEN_HOLDER_ADDRESS), `INIT_TOKEN_HOLDER_ADDRESS = ${INIT_TOKEN_HOLDER_ADDRESS}`);
  assert(is.string(MAX_FEE_PER_GAS_IN_GWEI), `MAX_FEE_PER_GAS_IN_GWEI = ${MAX_FEE_PER_GAS_IN_GWEI}`);
  assert(is.string(MAX_PRIORITY_FEE_PER_GAS_IN_GWEI), `MAX_PRIORITY_FEE_PER_GAS_IN_GWEI = ${MAX_PRIORITY_FEE_PER_GAS_IN_GWEI}`);
  assert(is.string(CHAIN_ID), `CHAIN_ID = ${CHAIN_ID}`);

  const { name, chainId } = await ethers.provider.getNetwork();

  const [owner] = await ethers.getSigners();

  const maxFeePerGas = ethers.utils.parseUnits(MAX_FEE_PER_GAS_IN_GWEI, 'gwei');
  const maxPriorityFeePerGas = ethers.utils.parseUnits(MAX_PRIORITY_FEE_PER_GAS_IN_GWEI, 'gwei');

  const ownerEthBalance = await owner.getBalance();

  console.log(`To be deployed from  = ${owner.address} (balance = ${ethers.utils.formatEther(ownerEthBalance)} ETH)`);
  console.log(`maxFeePerGas         = ${ethers.utils.formatUnits(maxFeePerGas, 'gwei')} gwei`);
  console.log(`maxPriorityFeePerGas = ${ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei')} gwei`);
  console.log();

  await pressAnyKey(`to deploy to network "${name}" (🔗 ${chainId})`);

  console.log(
    '=============================================== Deploying contracts ==============================================='
  );

  const earliestStakingTime = 1644274800; // 08/02/2022;

  const config: ConfigStruct = {
    firstQuarterDay: BigInteger.from(1644274800), // 08/02/2022;
    lastQuarterDay: BigInteger.from(1675119600), // 31/01/2023
    earliestStakingTime: BigInteger.from(earliestStakingTime), // 08/02/2022;
    latestStakingTime: BigInteger.from(1674255600),  // 21/01/2023
    maxLockDurationInDays: 2913539,
    tokenPerValue: '6204000000000000000', // 6.204
    dateWeight: BigInteger.from('250000000000000000'), // 0.25%
    lengthWeight: BigInteger.from('2000000000000000000'), // 2
  };

  const factory = new DoubleDiceDistributeLazyPoolPayout__factory(owner);

  const distributableToken = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // Mainnet
  const lazyPoolAddress = '0x473BEdE43716bAa1AB1b4ED34B4209bC942B7882'; // Mainnet

  const contract = await factory.deploy(
    distributableToken,
    lazyPoolAddress,
    {
      type: 2,
      maxFeePerGas,
      maxPriorityFeePerGas
    }
  );

  const { deployTransaction: { hash } } = contract;

  console.log(`Tx sent with hash ${hash}`);
  console.log(`Waiting for deployment to ${contract.address}...`);
  await contract.deployed();

  const { blockNumber, blockHash } = await contract.deployTransaction.wait();
  console.log(`Contract deployed to ${contract.address}, tx mined in block № ${blockNumber} (${blockHash})`);

  await contract.connect(owner).setPayoutConfiguration(config);

  console.log('Done.');

  console.log(
    '=============================================== Verifying contracts ==============================================='
  );

  try {
    await hre.run('verify:verify', {
      address: contract.address,
      network: name,
      constructorArguments: [distributableToken, lazyPoolAddress],
    });
  } catch (e) {
    console.log(e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
