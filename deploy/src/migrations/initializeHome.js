const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, HOME_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  homeContracts: { EternalStorageProxy, BridgedTokensMigrator: HomeMigrator }
} = require('../loadContracts')
const {
  privateKeyToAddress,
  sendRawTxHome,
  assertStateWithRetry,
  transferProxyOwnership
} = require('../deploymentUtils')

const {
  HOME_MEDIATOR_ADDRESS,
  HOME_UPGRADEABLE_ADMIN,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY
} = require('../loadEnv')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initializeMigrator({
  contract,
  params: {
    owner
  }
}) {
  console.log(`
    OWNER: ${owner}
  `)

  return contract.methods
    .initialize(
      owner
    )
    .encodeABI()
}

async function initialize({ homeMigrator }) {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const migratorContract = new web3Home.eth.Contract(HomeMigrator.abi, homeMigrator)

  console.log('\n[Home] Initializing Tokens Migrator with following parameters:')

  const initializeMigratorData = await initializeMigrator({
    contract: migratorContract,
    params: {
      owner: HOME_MEDIATOR_ADDRESS
    }
  })

  const txInitializeMigrator = await sendRawTxHome({
    data: initializeMigratorData,
    nonce,
    to: homeMigrator,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })

  if (txInitializeMigrator.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitializeMigrator.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(migratorContract.methods.isInitialized().call, true)
  }
  nonce++

  console.log('\n[Home] Transferring bridge migrator proxy ownership to upgradeability admin')
  const migratorProxy = new web3Home.eth.Contract(EternalStorageProxy.abi, homeMigrator)
  await transferProxyOwnership({
    proxy: migratorProxy,
    newOwner: HOME_UPGRADEABLE_ADMIN,
    nonce,
    url: HOME_RPC_URL
  })
}

module.exports = initialize
