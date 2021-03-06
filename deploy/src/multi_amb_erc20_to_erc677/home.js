const assert = require('assert')
const { web3Home, HOME_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  HOME_ERC677_TOKEN_IMAGE,
  SECONDARY_MULTI_AMB_BRIDGE,
  MULTI_AMB_BRIDGE
} = require('../loadEnv')

const {
  homeContracts: { EternalStorageProxy, HomeMultiAMBErc20ToErc677, SecondaryHomeMultiAMBErc20ToErc677, PrimaryHomeMultiAMBErc20ToErc677, ERC677BridgeTokenPermittable, ERC677MultiBridgeMintableToken }
} = require('../loadContracts')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)
let HomeBridge, ERC677BridgeToken

if (MULTI_AMB_BRIDGE) {
  ERC677BridgeToken = ERC677MultiBridgeMintableToken
  if (SECONDARY_MULTI_AMB_BRIDGE) {
    HomeBridge = SecondaryHomeMultiAMBErc20ToErc677
  } else {
    HomeBridge = PrimaryHomeMultiAMBErc20ToErc677
  }
} else {
  HomeBridge = HomeMultiAMBErc20ToErc677
  ERC677BridgeToken = ERC677BridgeTokenPermittable
}

console.log(`\n[Home] Using ${HomeBridge.contractName} implementation of Multi AMB bridge`)

async function deployHome() {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  console.log('\n[Home] Deploying Bridge Mediator storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Bridge Mediator Storage: ', homeBridgeStorage.options.address)

  console.log('\n[Home] Deploying Bridge Mediator implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Bridge Mediator Implementation: ', homeBridgeImplementation.options.address)

  console.log('\n[Home] Hooking up Mediator storage to Mediator implementation')
  await upgradeProxy({
    proxy: homeBridgeStorage,
    implementationAddress: homeBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  let homeTokenImage = HOME_ERC677_TOKEN_IMAGE
  if (HOME_ERC677_TOKEN_IMAGE === "") {
    console.log('\n[Home] Deploying new ERC677 token image')
    const chainId = await web3Home.eth.getChainId()
    assert.strictEqual(chainId > 0, true, 'Invalid chain ID')
    const erc677token = await deployContract(
      ERC677BridgeToken,
      ["", "", 0, chainId], 
      { from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce }
    )
    homeTokenImage = erc677token.options.address
    console.log('\n[Home] New ERC677 token image has been deployed: ', homeTokenImage)
  } else {
    console.log('\n[Home] Using existing ERC677 token image: ', homeTokenImage)
  }

  console.log('\nHome part of MULTI_AMB_ERC20_TO_ERC677 bridge deployed\n')
  return {
    homeBridgeMediator: { address: homeBridgeStorage.options.address },
    homeTokenImage: { address: homeTokenImage }
  }
}

module.exports = deployHome
