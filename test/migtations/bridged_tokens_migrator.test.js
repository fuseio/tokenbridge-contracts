const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC677MultiBridgeMintableToken = artifacts.require('ERC677MultiBridgeMintableToken.sol')
const BridgedTokensMigrator = artifacts.require('BridgedTokensMigrator.sol')
const PrimaryHomeMultiAMBErc20ToErc677 = artifacts.require('PrimaryHomeMultiAMBErc20ToErc677.sol')
const ForeignMultiAMBErc20ToErc677 = artifacts.require('ForeignMultiAMBErc20ToErc677.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const BridgeMock = artifacts.require('BridgeMock.sol')
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

contract.only('BridgedTokensMigrator', async accounts => {
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

        it('upgrading token from owner should deploy new upgraded token', async () => {
          await contract.upgradeToken(deprecatedToken.address, bridge.address, { from: owner }).should.be.fulfilled
          const events = await getEvents(contract, { event: 'TokenUpgraded' })
          const upgradedTokenAddress = events[0].returnValues.upgradedToken

          const upgradedToken = await ERC677MultiBridgeMintableToken.at(upgradedTokenAddress)
          expect(await upgradedToken.name()).to.be.equal(await deprecatedToken.name())
          expect(await upgradedToken.symbol()).to.be.equal(await deprecatedToken.symbol())
          expect(await upgradedToken.decimals()).to.be.bignumber.equal(await deprecatedToken.decimals())
        })

        it('upgrading token from owner should register tokens', async () => {
          await contract.upgradeToken(deprecatedToken.address, bridge.address, { from: owner }).should.be.fulfilled
          const events = await getEvents(contract, { event: 'TokenUpgraded' })
          const upgradedTokenAddress = events[0].returnValues.upgradedToken

          expect(await contract.upgradedTokenAddress(deprecatedToken.address)).to.be.equal(upgradedTokenAddress)
          expect(await contract.deprecatedTokenAddress(upgradedTokenAddress)).to.be.equal(deprecatedToken.address)
        })

        it('upgrading token from owner should emit events', async () => {
          const { logs } = await contract.upgradeToken(deprecatedToken.address, bridge.address, { from: owner }).should
            .be.fulfilled
          const events = await getEvents(contract, { event: 'TokenUpgraded' })
          const deprecatedTokenAddress = events[0].returnValues.deprecatedToken

          expectEventInLogs(logs, 'TokenUpgraded')
          expect(events.length).to.be.equal(1)
          expect(deprecatedTokenAddress).to.be.equal(deprecatedToken.address)
        })

        it('migrate tokens should be rejected if tokens are not registered', async () => {
          await deprecatedToken.mint(user, oneEther).should.be.fulfilled
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

          describe('migrateTokens', async () => {
            it('migrate tokens should pass', async () => {
              await deprecatedToken.mint(user, oneEther).should.be.fulfilled
              await contract.addBridgePerToken(contract.address, upgradedToken.address, { from: owner })
              await deprecatedToken.approve(contract.address, oneEther, { from: user }).should.be.fulfilled

              await contract.migrateTokens(deprecatedToken.address, oneEther, { from: user }).should.be.fulfilled

              expect(await deprecatedToken.balanceOf(user)).to.be.bignumber.equal(ZERO)
              expect(await upgradedToken.balanceOf(user)).to.be.bignumber.equal(oneEther)
            })

            it('migrate tokens without balance should be rejected', async () => {
              await token.addBridge(contract.address).should.be.fulfilled
              await deprecatedToken.approve(contract.address, oneEther, { from: user }).should.be.fulfilled

              await contract.migrateTokens(deprecatedToken.address, oneEther, { from: user }).should.be.rejected
            })

            it('migrate tokens is burning old tokens and mints the new one', async () => {
              await deprecatedToken.mint(user, oneEther).should.be.fulfilled
              expect(await deprecatedToken.balanceOf(user)).to.be.bignumber.equal(oneEther)
              expect(await upgradedToken.balanceOf(user)).to.be.bignumber.equal(ZERO)

              await deprecatedToken.approve(contract.address, oneEther, { from: user }).should.be.fulfilled
              await contract.addBridgePerToken(contract.address, upgradedToken.address, { from: owner }).should.be
                .fulfilled
              await contract.migrateTokens(deprecatedToken.address, halfEther, { from: user }).should.be.fulfilled
              expect(await deprecatedToken.balanceOf(user)).to.be.bignumber.equal(halfEther)
              expect(await upgradedToken.balanceOf(user)).to.be.bignumber.equal(halfEther)

              await contract.migrateTokens(deprecatedToken.address, halfEther, { from: user }).should.be.fulfilled
              expect(await deprecatedToken.balanceOf(user)).to.be.bignumber.equal(ZERO)
              expect(await upgradedToken.balanceOf(user)).to.be.bignumber.equal(oneEther)

              await contract.migrateTokens(deprecatedToken.address, halfEther, { from: user }).should.be.rejected
            })

            it('cannot migrateTokens with upgraded token', async () => {
              await deprecatedToken.mint(user, oneEther).should.be.fulfilled
              expect(await deprecatedToken.balanceOf(user)).to.be.bignumber.equal(oneEther)
              expect(await upgradedToken.balanceOf(user)).to.be.bignumber.equal(ZERO)

              await deprecatedToken.approve(contract.address, oneEther, { from: user }).should.be.fulfilled
              await contract.addBridgePerToken(contract.address, upgradedToken.address, { from: owner }).should.be
                .fulfilled
              await contract.migrateTokens(upgradedToken.address, halfEther, { from: user }).should.be.rejected
            })

            it('cannot call migrateTokens with balance less than value', async () => {
              await deprecatedToken.mint(user, oneEther).should.be.fulfilled
              expect(await deprecatedToken.balanceOf(user)).to.be.bignumber.equal(oneEther)
              expect(await upgradedToken.balanceOf(user)).to.be.bignumber.equal(ZERO)

              await deprecatedToken.approve(contract.address, twoEthers, { from: user }).should.be.fulfilled
              await contract.migrateTokens(deprecatedToken.address, twoEthers, { from: user }).should.be.rejected
            })
          })

          describe('addBridgePerToken', () => {
            let secondaryBridge

            beforeEach(async () => {
              secondaryBridge = await BridgeMock.new(upgradedToken.address)
            })

            it('adding bridge from not owner should be rejected', async () => {
              await contract.addBridgePerToken(secondaryBridge.address, upgradedToken.address, { from: user }).should.be
                .rejected
              expect(await upgradedToken.isBridge(secondaryBridge.address)).to.be.equal(false)
              expect(await upgradedToken.bridgeCount()).to.be.bignumber.equal('0')
              await secondaryBridge.mint(user, oneEther).should.be.rejected
            })

            it('adding bridge from an owner should fulfilled', async () => {
              await contract.addBridgePerToken(secondaryBridge.address, upgradedToken.address, { from: owner })
              expect(await upgradedToken.isBridge(secondaryBridge.address)).to.be.equal(true)
              expect(await upgradedToken.bridgeCount()).to.be.bignumber.equal('1')
              await secondaryBridge.mint(user, oneEther).should.be.fulfilled
            })

            it('adding multiple bridges from an owner should fulfilled', async () => {
              const thirdBridge = await BridgeMock.new(upgradedToken.address)
              await contract.addBridgePerToken(secondaryBridge.address, upgradedToken.address, { from: owner }).should
                .be.fulfilled
              await contract.addBridgePerToken(thirdBridge.address, upgradedToken.address, { from: owner }).should.be
                .fulfilled
              expect(await upgradedToken.bridgeCount()).to.be.bignumber.equal('2')
              await secondaryBridge.mint(user, oneEther).should.be.fulfilled
              await thirdBridge.mint(user, oneEther).should.be.fulfilled
            })

            it('adding same bridge multiple times should be rejected', async () => {
              await contract.addBridgePerToken(secondaryBridge.address, upgradedToken.address, { from: owner }).should
                .be.fulfilled
              await contract.addBridgePerToken(secondaryBridge.address, upgradedToken.address, { from: owner }).should
                .be.rejected
              expect(await upgradedToken.bridgeCount()).to.be.bignumber.equal('1')
            })
          })

          describe('removeBridgePerToken', () => {
            beforeEach(async () => {
              await contract.addBridgePerToken(contract.address, upgradedToken.address, { from: owner }).should.be
                .fulfilled
            })

            it('removing bridge from not an owner should be rejected', async () => {
              await contract.removeBridgePerToken(contract.address, upgradedToken.address, { from: user }).should.be
                .rejected
              expect(await upgradedToken.isBridge(contract.address)).to.be.equal(true)
              expect(await upgradedToken.bridgeCount()).to.be.bignumber.equal('1')
            })

            it('removing bridge from an owner should be fulfilled', async () => {
              await contract.removeBridgePerToken(contract.address, upgradedToken.address, { from: owner }).should.be
                .fulfilled
              expect(await upgradedToken.isBridge(contract.address)).to.be.equal(false)
              expect(await upgradedToken.bridgeCount()).to.be.bignumber.equal('0')
            })

            it('removing bridge twice from an owner should be rejected', async () => {
              await contract.removeBridgePerToken(contract.address, upgradedToken.address, { from: owner }).should.be
                .fulfilled
              expect(await upgradedToken.isBridge(contract.address)).to.be.equal(false)
              expect(await upgradedToken.bridgeCount()).to.be.bignumber.equal('0')
              await contract.removeBridgePerToken(contract.address, upgradedToken.address, { from: owner }).should.be
                .rejected
            })
          })
        })
      })
    })
  })

  describe('transferOwnership', () => {
    let storage
    beforeEach(async () => {
      storage = await EternalStorageProxy.new()

      await storage.upgradeTo('1', contract.address).should.be.fulfilled
      contract = await BridgedTokensMigrator.at(storage.address)

      await contract.initialize(owner, { from: owner }).should.be.fulfilled
    })

    it('should fail if not proxy owner', async () => {
      await contract.transferOwnership(user, { from: user }).should.be.rejected
    })

    it('should allow proxy owner to change owner', async () => {
      expect(await contract.owner()).to.be.equal(owner)
      await contract.transferOwnership(user, { from: owner }).should.be.fulfilled
      expect(await contract.owner()).to.be.equal(user)
    })
  })
})
