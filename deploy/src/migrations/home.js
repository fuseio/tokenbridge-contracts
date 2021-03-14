const assert = require('assert')
const { web3Home, HOME_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY
} = require('../loadEnv')

const {
  homeContracts: { EternalStorageProxy, BridgedTokensMigrator }
} = require('../loadContracts')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHome() {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  console.log('\n[Home] Deploying Tokens Migrator storage\n')
  const homeMigratorStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Tokens Migrator Storage: ', homeMigratorStorage.options.address)

  console.log('\n[Home] Deploying Tokens Migrator implementation\n')
  const homeMigratorImplementation = await deployContract(BridgedTokensMigrator, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Tokens Migrator Implementation: ', homeMigratorImplementation.options.address)

  console.log('\n[Home] Hooking up Migrator storage to Migrator implementation')
  await upgradeProxy({
    proxy: homeMigratorStorage,
    implementationAddress: homeMigratorImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('\nHome part of BRIDGES_TOKENS_MIGRATOR is deployed\n')
  return {
    homeTokensMigrator: { address: homeMigratorStorage.options.address },
  }
}

module.exports = deployHome
