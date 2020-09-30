import { asArray, asObject, asString, asUnknown } from 'cleaners'
import fs from 'fs'
import fetch from 'node-fetch'

import { queryChangeNow } from '../../partners/changenow'
import { PluginParams, StandardTx } from '../../types'
import { defaultSettings } from './fioInfo'

const asGetFioNames = asObject({
  fio_addresses: asArray(asUnknown)
})
const asFioAddress = asObject({
  fio_address: asString
})

interface AddressReward {
  [payoutAddress: string]: number
}

const noNamesMessage: string = 'No FIO names'
const {
  maxFioReward,
  fioMultiple,
  defaultDomain,
  currency,
  currencyCode,
  endpoint,
  networks
} = defaultSettings

const configFile: string = fs.readFileSync(
  `${__dirname}/../../../config.json`,
  'utf8'
)
const config = JSON.parse(configFile)

// Returns all customers from ChangeNow who have purchased FIO
export async function getFioTransactions(checkFrom): Promise<StandardTx[]> {
  // Get public keys from offset
  const pluginConfig: PluginParams = {
    settings: {
      offset: checkFrom
    },
    apiKeys: {
      changenowApiKey: config.changenowApiKey
    }
  }

  const txnList = await queryChangeNow(pluginConfig)
  // Return list of Fio Customers
  return txnList.transactions.filter(
    transaction => transaction.payoutCurrency === currencyCode
  )
}

export async function filterDomain( // Test
  fioList: StandardTx[],
  domain: string = defaultDomain // By default check for @edge domains
): Promise<StandardTx[]> {
  const txList: StandardTx[] = []

  for (const tx of fioList) {
    const { payoutAddress } = tx
    if (payoutAddress == null) continue
    const result = await checkDomain(payoutAddress, domain)
    if (result) txList.push(tx)
  }
  return txList // only FIO addresses with an @edge Fio domain
}

// Does FIO public address have specified domain?
export const checkDomain = async (
  pubkey: string | undefined,
  domain: string = defaultDomain, // By default check for @edge domains
  urls: string = networks
): Promise<boolean> => {
  let fioInfo
  let error = ''
  for (const apiUrl of urls) {
    try {
      const result = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ fio_public_key: pubkey })
      })

      fioInfo = await result.json()
      error = ''
      break
    } catch (e) {
      error = e
      console.log(e)
    }
  }
  if (error !== '') throw error
  if (
    Object.entries(fioInfo)
      .toString()
      .includes(noNamesMessage)
  ) {
    // No FIO names
    return false
  } else {
    const fioNames = asGetFioNames(fioInfo)

    for (const fioName of fioNames.fio_addresses) {
      const cleanFioName = asFioAddress(fioName)
      if (cleanFioName.fio_address.includes(`@${domain}`)) {
        return true
      }
    }
    return false
  }
}

// Takes a list of public keys to be checked and returns a 2D array with keys and values
export const getRewards = (
  txList: StandardTx[],
  rewardMax: number = maxFioReward
): AddressReward => {
  const rewards: AddressReward = {}

  // Get possible reward amounts
  for (const tx of txList) {
    const { payoutAddress, payoutAmount } = tx
    if (payoutAddress == null) continue
    // If it's the first time we are using the payoutAddress
    if (rewards[payoutAddress] == null) {
      rewards[payoutAddress] = payoutAmount // Set the new key to the payoutAmount
      // If the payoutAddress exists previously,
    } else {
      rewards[payoutAddress] += payoutAmount // Add the payoutAmount to the previously defined key
    }
  }

  // Make sure every reward is under maximum
  for (const reward in rewards) {
    if (rewards[reward] >= rewardMax) {
      rewards[reward] = rewardMax
    }
  }

  return rewards
}

// Accept AddressReward interface
export const sendRewards = async (
  rewardList: AddressReward,
  rewardCurrency: string = currency,
  devMode: boolean = false
): Promise<string[]> => {
  const txIdList: string[] = []

  for (const reward in rewardList) {
    const sendAmount = fioMultiple * rewardList[reward]
    console.log(`reward address is: ${reward}`)
    console.log(`Rewards amount is: ${rewardList[reward]}`)
    console.log(`Multiple * reward amount: ${sendAmount}`)

    let transaction = {
      txid: `dev mode - address: ${reward}, amount: ${sendAmount}`
    }

    if (!devMode) {
      const result = await fetch(
        `http://localhost:8080/spend/?type=${rewardCurrency}`,
        {
          body: JSON.stringify({
            spendTargets: [
              {
                publicAddress: `${reward}`, // Denominated in smallest unit
                // Need to add in mining fee so exact amount is sent.
                nativeAmount: `${sendAmount}`
              }
            ]
          }),
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST'
        }
      )

      transaction = await result.json()
    }

    console.log(`Transaction is: JSON.stringify(${transaction})`)
    console.log(`Transaction ID: ${transaction.txid}`)

    txIdList.push(transaction.txid)
  }

  return txIdList
  // return ['example hash']
}