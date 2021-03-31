const { web3Home, web3Foreign } = require('../web3')
const {
  HOME_MEDIATOR_ADDRESS
} = require('../loadEnv')
const { isContract } = require('../deploymentUtils')

async function preDeploy() {
  const isHomeMediatorAContract = await isContract(web3Home, HOME_MEDIATOR_ADDRESS)
  if (!isHomeMediatorAContract) {
    throw new Error(`HOME_MEDIATOR_ADDRESS should be a contract address`)
  }
}

module.exports = preDeploy
