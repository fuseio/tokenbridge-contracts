const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC677MultiBridgeMintableToken = artifacts.require('ERC677MultiBridgeMintableToken.sol')
const BridgedTokensMigrator = artifacts.require('BridgedTokensMigrator.sol')
const PrimaryHomeMultiAMBErc20ToErc677 = artifacts.require('PrimaryHomeMultiAMBErc20ToErc677.sol')
const ForeignMultiAMBErc20ToErc677 = artifacts.require('ForeignMultiAMBErc20ToErc677.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const { expect } = require('chai')
const { getEvents, expectEventInLogs, ether, strip0x } = require('../helpers/helpers')
const { ZERO_ADDRESS, toBN } = require('../setup')

const ZERO = toBN(0)
const halfEther = ether('0.5')
const oneEther = ether('1')
const twoEthers = ether('2')
const maxGasPerTx = oneEther
const dailyLimit = twoEthers
const maxPerTx = oneEther
const minPerTx = ether('0.01')
const executionDailyLimit = dailyLimit
const executionMaxPerTx = maxPerTx

contract('BridgedTokensMigrator', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]

  let token
  let deprecatedToken
  let bridge
  let contract
  beforeEach(async () => {
    contract = await BridgedTokensMigrator.new()
    deprecatedToken = await ERC677BridgeToken.new('depTEST', 'DTST', 18)
    token = await ERC677MultiBridgeMintableToken.new('TEST', 'TST', 18, 1337)

    bridge = await PrimaryHomeMultiAMBErc20ToErc677.new()
    const ambBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    const otherSideMediator = await ForeignMultiAMBErc20ToErc677.new()

    await bridge.initialize(
      ambBridgeContract.address,
      otherSideMediator.address,
      [dailyLimit, maxPerTx, minPerTx],
      [executionDailyLimit, executionMaxPerTx],
      maxGasPerTx,
      owner,
      token.address,
      [],
      [ZERO, ZERO]
    )
  })

  describe('initialize', () => {
    it('should initialize parameters', async () => {
      // Given
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)

      // not valid owner
      await contract.initialize(ZERO_ADDRESS).should.be.rejected

      await contract.initialize(owner).should.be.fulfilled

      // already initialized
      await contract.initialize(owner).should.be.rejected

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.owner()).to.be.equal(owner)
    })

    it('before initialization upgradeToken is rejected', async () => {
      await contract.upgradeToken(deprecatedToken.address, bridge.address, { from: user }).should.be.rejected
    })

    describe('afterInitialization', () => {
      beforeEach(async () => {
        await contract.initialize(owner).should.be.fulfilled
      })

      describe('upgradeToken', () => {
        it('upgrading token from not an user should be rejected', async () => {
          await contract.upgradeToken(deprecatedToken.address, bridge.address, { from: user }).should.be.rejected
        })

        it('upgrading token from owner should pass', async () => {
          const { logs } = await contract.upgradeToken(deprecatedToken.address, bridge.address, { from: owner }).should
            .be.fulfilled
          const events = await getEvents(contract, { event: 'TokenUpgraded' })
          const deprecated = events[0].returnValues.deprecatedToken
          const upgradedToken = events[0].returnValues.upgradedToken

          expectEventInLogs(logs, 'TokenUpgraded')
          expect(events.length).to.be.equal(1)

          expect(deprecated).to.be.equal(deprecatedToken.address)
          // TODO: test for upgraded token
          // expect(upgradedToken).to.be.equal(token.address)

          expect(await contract.upgradedTokenAddress(deprecated)).to.be.equal(upgradedToken)
          expect(await contract.deprecatedTokenAddress(upgradedToken)).to.be.equal(deprecated)
        })

        it('migrate tokens should be rejected if tokens are not registered', async () => {
          await deprecatedToken.mint(user, oneEther).should.be.fulfilled
          await token.addBridge(contract.address).should.be.fulfilled
          await deprecatedToken.approve(contract.address, oneEther, { from: user }).should.be.fulfilled

          await contract.migrateTokens(deprecatedToken.address, oneEther, { from: user }).should.be.rejected
        })

        it('upgradedTokenAddress returns zero address for not registered token', async () => {
          expect(await contract.upgradedTokenAddress(deprecatedToken.address)).to.be.equal(ZERO_ADDRESS)
        })

        it('deprecatedTokenAddress returns zero address for not registered token', async () => {
          expect(await contract.deprecatedTokenAddress(deprecatedToken.address)).to.be.equal(ZERO_ADDRESS)
        })

        describe('after upgradeToken', () => {
          let upgradedToken

          beforeEach(async () => {
            await contract.upgradeToken(deprecatedToken.address, bridge.address, { from: owner })

            const events = await getEvents(contract, { event: 'TokenUpgraded' })
            const upgradedTokenAddress = events[0].returnValues.upgradedToken
            upgradedToken = await ERC677MultiBridgeMintableToken.at(upgradedTokenAddress)
          })

          it('upgrading same deprecated token should be rejected', async () => {
            await contract.upgradeToken(deprecatedToken.address, bridge.address, { from: owner }).should.be.rejected
          })

          it('upgrading to same upgraded token should be rejected', async () => {
            await contract.upgradeToken(upgradedToken.address, bridge.address, { from: owner }).should.be.rejected
          })

          // TODO: add tests #addBridgePerToken
          // TODO: add tests for #removeBridgePerToken

          describe('migrateTokens', async () => {
            it('migrate tokens should pass', async () => {
              await deprecatedToken.mint(user, oneEther).should.be.fulfilled
              await contract.addBridgePerToken(contract.address, upgradedToken.address, { from: owner })
              await deprecatedToken.approve(contract.address, oneEther, { from: user }).should.be.fulfilled

              await contract.migrateTokens(deprecatedToken.address, oneEther, { from: user })

              expect(await deprecatedToken.balanceOf(user)).to.be.bignumber.equal(ZERO)
              expect(await upgradedToken.balanceOf(user)).to.be.bignumber.equal(oneEther)
            })

            it('migrate tokens without balance should be rejected', async () => {
              await token.addBridge(contract.address).should.be.fulfilled
              await deprecatedToken.approve(contract.address, oneEther, { from: user }).should.be.fulfilled

              await contract.migrateTokens(deprecatedToken.address, oneEther, { from: user }).should.be.rejected
            })
          })
        })
      })
    })
  })
})
