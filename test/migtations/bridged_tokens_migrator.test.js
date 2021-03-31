const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC677MultiBridgeMintableToken = artifacts.require('ERC677MultiBridgeMintableToken.sol')
const BridgedTokensMigrator = artifacts.require('BridgedTokensMigrator.sol')
const { expect } = require('chai')
const { getEvents, expectEventInLogs, ether, strip0x } = require('../helpers/helpers')
const { ZERO_ADDRESS, toBN } = require('../setup')

const ZERO = toBN(0)
const halfEther = ether('0.5')
const oneEther = ether('1')
const twoEthers = ether('2')

contract('BridgedTokensMigrator', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]

  let token, deprecatedToken
  beforeEach(async () => {
    contract = await BridgedTokensMigrator.new()
    deprecatedToken = await ERC677BridgeToken.new('depTEST', 'DTST', 18)
    token = await ERC677MultiBridgeMintableToken.new('TEST', 'TST', 18, 1337)
  })

  describe('initialize', () => {
    it('should initialize parameters', async () => {
      // Given
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)

      // not valid owner
      await contract.initialize(
        ZERO_ADDRESS
      ).should.be.rejected

      await contract.initialize(
        owner
      ).should.be.fulfilled
      
      // already initialized
      await contract.initialize(
        owner
      ).should.be.rejected

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.owner()).to.be.equal(owner)
    })

    it('before initialization upgradeToken is rejected', async () => {
      await contract.upgradeToken(deprecatedToken.address, token.address, { from: user }).should.be.rejected
    })

    describe('afterInitialization', () => {
      beforeEach(async () => {
        await contract.initialize(
          owner
        ).should.be.fulfilled
      })

      describe('upgradeToken', () => {
        it('upgrading token from not an user should be rejected', async () => {
          await contract.upgradeToken(deprecatedToken.address, token.address, { from: user }).should.be.rejected
        })

        it('upgrading token from owner should pass', async () => {
          const { logs } = await contract.upgradeToken(deprecatedToken.address, token.address, { from: owner }).should.be.fulfilled
          expectEventInLogs(logs, 'TokenUpgraded')
          const events = await getEvents(contract, { event: 'TokenUpgraded' })
          expect(events.length).to.be.equal(1)
          expect(events[0].returnValues.deprecatedToken).to.be.equal(deprecatedToken.address)
          expect(events[0].returnValues.upgradedToken).to.be.equal(token.address)

          expect(await contract.upgradedTokenAddress(deprecatedToken.address)).to.be.equal(token.address)
          expect(await contract.deprecatedTokenAddress(token.address)).to.be.equal(deprecatedToken.address)
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
          beforeEach(async () => {
            await contract.upgradeToken(deprecatedToken.address, token.address, { from: owner }).should.be.fulfilled
          })

          it('upgrading same deprecated token should be rejected', async () => {
            const newToken = await ERC677MultiBridgeMintableToken.new('TEST', 'TST', 18, 1337)
            await contract.upgradeToken(deprecatedToken.address, newToken.address, { from: owner }).should.be.rejected
          })
  
          it('upgrading to same upgraded token should be rejected', async () => {
            const newDeprecatedToken = await ERC677MultiBridgeMintableToken.new('TEST', 'TST', 18, 1337)
            await contract.upgradeToken(newDeprecatedToken.address, token.address, { from: owner }).should.be.rejected
          })

          describe('migrateTokens', async () => {

            it('migrate tokens should pass', async () => {
              await deprecatedToken.mint(user, oneEther).should.be.fulfilled
              await token.addBridge(contract.address).should.be.fulfilled
              await deprecatedToken.approve(contract.address, oneEther, { from: user }).should.be.fulfilled

              await contract.migrateTokens(deprecatedToken.address, oneEther, { from: user }).should.be.fulfilled

              expect(await deprecatedToken.balanceOf(user)).to.be.bignumber.equal(ZERO)
              expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
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