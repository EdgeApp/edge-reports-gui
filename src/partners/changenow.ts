import {
  asArray,
  asNumber,
  asObject,
  asOptional,
  asString,
  asUnknown
} from 'cleaners'
import fetch from 'node-fetch'

import { PartnerPlugin, PluginParams, PluginResult, StandardTx } from '../types'
import { datelog } from '../util'

const asChangeNowTx = asObject({
  id: asString,
  updatedAt: asString,
  payinHash: asString,
  payoutHash: asString,
  payinAddress: asString,
  fromCurrency: asString,
  amountSend: asNumber,
  payoutAddress: asString,
  toCurrency: asString,
  amountReceive: asNumber
})

const asChangeNowRawTx = asObject({
  status: asString,
  payinHash: asOptional(asString),
  amountSend: asOptional(asNumber),
  amountReceive: asOptional(asNumber)
})

const asChangeNowResult = asArray(asUnknown)
const LIMIT = 100
const ROLLBACK = 500

export async function queryChangeNow(
  pluginParams: PluginParams,
  startDate: Date = new Date(0),
  endDate: Date = new Date() // By default check to current date
): Promise<PluginResult> {
  const ssFormatTxs: StandardTx[] = []
  let apiKey = ''
  let { offset = 0 } = pluginParams.settings
  if (typeof pluginParams.apiKeys.changenowApiKey === 'string') {
    apiKey = pluginParams.apiKeys.changenowApiKey
  } else {
    return {
      settings: { offset },
      transactions: []
    }
  }
  const partnerHost = `https://changenow.io/api`
  const apiVersion = `/v1`
  const endPoint = `/transactions`
  const options = `?limit=${LIMIT}&offset=${offset}`
  // https://changenow.io/api/v1/transactions?limit=100&offset=135000
  let url = `${partnerHost}${apiVersion}${endPoint}/${apiKey}${options}`
  while (true) {
    let jsonObj: ReturnType<typeof asChangeNowResult>
    try {
      const result = await fetch(url, {
        method: 'GET'
      })
      jsonObj = asChangeNowResult(await result.json())
    } catch (e) {
      datelog(e)
      break
    }
    const txs = jsonObj
    console.log('65. txs', txs)
    for (const rawtx of txs) {
      const checkTx = asChangeNowRawTx(rawtx) // Check RAW trasaction
      if (
        checkTx.status === 'finished' &&
        checkTx.payinHash != null &&
        checkTx.amountSend != null &&
        checkTx.amountReceive != null
      ) {
        const tx = asChangeNowTx(rawtx) // Set NORMAL trasaction
        const date = new Date(tx.updatedAt)

        // If we reached end date, stop checking
        if (endDate <= date) break
        if (startDate <= date) {
          // If tx is past start date
          const timestamp = date.getTime() / 1000
          const ssTx: StandardTx = {
            status: 'complete',
            orderId: tx.id,
            depositTxid: tx.payinHash,
            depositAddress: tx.payinAddress,
            depositCurrency: tx.fromCurrency.toUpperCase(),
            depositAmount: tx.amountSend,
            payoutTxid: tx.payoutHash,
            payoutAddress: tx.payoutAddress,
            payoutCurrency: tx.toCurrency.toUpperCase(),
            payoutAmount: tx.amountReceive,
            timestamp,
            isoDate: tx.updatedAt,
            usdValue: undefined,
            rawTx: rawtx
          }
          ssFormatTxs.push(ssTx)
        }
      }
    }
    if (txs.length < LIMIT) {
      // datelog('length < 100, stopping query')
      break
    }
    offset += LIMIT
    url = `https://changenow.io/api/v1/transactions/${apiKey}?limit=${LIMIT}&offset=${offset}`
  }
  if (offset >= ROLLBACK) {
    offset -= ROLLBACK
  }
  const out: PluginResult = {
    settings: { offset },
    transactions: ssFormatTxs
  }
  return out
}

export const changenow: PartnerPlugin = {
  // queryFunc will take PluginSettings as arg and return PluginResult
  queryFunc: queryChangeNow,
  // results in a PluginResult
  pluginName: 'Changenow',
  pluginId: 'changenow'
}
