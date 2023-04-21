/* eslint-disable no-undef */
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import is from '@sindresorhus/is';
import '@typechain/hardhat';
import assert from 'assert';
import dotenv from 'dotenv';
import 'hardhat-abi-exporter';
import 'hardhat-gas-reporter';
import { HardhatUserConfig } from 'hardhat/types';
import 'solidity-coverage';

const dotenvResult = dotenv.config();

if (dotenvResult.error) {
  throw dotenvResult.error;
}

const {
  PROVIDER_URL,
  OWNER_PRIVATE_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

assert(is.string(PROVIDER_URL));

const compilerSetting = {
  optimizer: {
    enabled: true,
    runs: 200,
  }
};

export default <HardhatUserConfig>{
  networks: {
    local: {
      url: PROVIDER_URL,
      chainId: 31337,
    },
    rinkeby: {
      url: PROVIDER_URL,
      accounts: [OWNER_PRIVATE_KEY],
      chainId: 4,
    },
    goerli: {
      url: PROVIDER_URL,
      accounts: [OWNER_PRIVATE_KEY],
      chainId: 5,
    },
    mumbai: {
      url: PROVIDER_URL,
      accounts: [OWNER_PRIVATE_KEY],
      chainId: 80001,
    },
    mainnet: {
      url: PROVIDER_URL,
      accounts: [OWNER_PRIVATE_KEY],
      chainId: 1,
    },
    polygon: {
      url: PROVIDER_URL,
      accounts: [OWNER_PRIVATE_KEY],
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  solidity: {
    compilers: [
      {
        version: '0.8.6',
        settings: compilerSetting
      },
      {
        version: '0.8.17',
        settings: compilerSetting
      }
    ],
  },
  abiExporter: {
    clear: true,
    flat: true,
    only: [
      ':DoubleDiceToken$',
      ':DoubleDiceTokenLocking$',
      ':DoubleDiceLazyPoolLocking$',
      ':DoubleDiceTokenVesting$',
      ':DoubleDiceTokenVestingProxyFactory$',
      ':DoubleDiceDistributeLazyPoolPayout$',
    ],
  }
};
