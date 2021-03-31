const ERC677MultiBridgeToken = artifacts.require('ERC677MultiBridgeToken.sol')
const ERC677MultiBridgeMintableToken = artifacts.require('ERC677MultiBridgeMintableToken.sol')
const StubContract = artifacts.require('RevertFallback.sol')
const BridgeMock = artifacts.require('BridgeMock.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, F_ADDRESS, BN } = require('./setup')
const { ether } = require('./helpers/helpers')

const MAX_BRIDGES = 5

contract('ERC677MultiBridgeMintableToken', async accounts => {
  let token
  const owner = accounts[0]
  const contracts = []

  const oneEther = ether('1')
  const notOwner = accounts[1]
  const user = accounts[0]
  before(async () => {
    token = await ERC677MultiBridgeMintableToken.new('Test token', 'TEST', 18, 100)

    for (let i = 0; i < MAX_BRIDGES; i++) {
      contracts.push((await BridgeMock.new(token.address)).address)
    }
    await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled
    await token.addBridge(contracts[1], { from: owner }).should.be.fulfilled
  })

  describe('#mint', () => {
    it('mint from not an owner should be rejected', async () => {
      await token.mint(user, oneEther, { from: notOwner }).should.be.rejectedWith(ERROR_MSG)
    })

    it('mint from an owner should be rejected as well', async () => {
      await token.mint(user, oneEther, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })

      
    it('mint from registered bridge contract should be fulfilled', async () => {
      const bridgeContract =  await BridgeMock.at(contracts[0])
      expect(await token.isBridge(bridgeContract.address)).to.be.equal(true)
      await bridgeContract.mint(user, oneEther, { from: owner }).should.be.fulfilled
    })

    it('mint from not registered bridge contract should be rejected', async () => {
      const bridgeContract =  await BridgeMock.at(contracts[3])
      expect(await token.isBridge(bridgeContract.address)).to.be.equal(false)
      await bridgeContract.mint(user, oneEther, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
  })
})
