import { asArray, asNumber, asObject, asString, asUnknown, asOptional } from 'cleaners'
import fetch from 'node-fetch'
import { PartnerPlugin, PluginParams, PluginResult, StandardTx } from '../types'

//CLEANER that verfies the data fetched matches the given format and data types
const asGodexTx = asObject({
    status: asString,
    hash_in: asOptional(asString),
    deposit: asString,
    coin_from: asString,
    deposit_amount: asString,
    withdrawal: asString,
    coin_to: asString,
    withdrawal_amount: asString,
    created_at: asString //Date and time when transaction was created
})

const asGodexTxs = asObject({
    response: asArray(asUnknown)
})


const QUERY_LOOKBACK = 1000 * 60 * 60 * 24 * 20 // 20 days

export async function queryGodex(pluginParams: PluginParams): Promise<PluginResult> {
    const ssFormatTxs: StandardTx[] = []
    const limit = 100
    let apiKey
    let offset = 0
    let lastCheckedTimestamp

    if (typeof pluginParams.settings.latestTimeStamp !== 'number') { //understand the pluginParams.settings.offset
        lastCheckedTimestamp = Date.now() - QUERY_LOOKBACK //checks 5 days ago we want to check everything in the database for production, but for testing we can use 20 days ago
    } else {
        lastCheckedTimestamp = pluginParams.settings.latestTimeStamp
    }
    if (typeof pluginParams.apiKeys.apiKey === 'string') {
        apiKey = pluginParams.apiKeys.apiKey
    } else {
        return {
            settings: { lastCheckedTimestamp: lastCheckedTimestamp },
            transactions: []
        }
    }

    let done = false
    let newestTimestamp = 0
    while (!done) {
        let jsonObj: ReturnType<typeof asGodexTxs>
        let url = `https://api.godex.io/api/v1/affiliate/history?limit=${limit}&offset=${offset}`
        const headers = {
            'Authorization': apiKey
        }

        let resultJSON
        try {
            const result = await fetch(url, { method: 'GET', headers: headers })
            resultJSON = await result.json()
        } catch (e) {
            console.log(e)
        }
        const txs = resultJSON

        for (const rawtx of txs) {
            let tx
            try {
                tx = asGodexTx(rawtx)
            } catch (e) {
                console.log(e)
                throw e
            }
            if (tx.status === 'success') {
                let timestamp = parseInt(tx.created_at) * 1000
                const ssTx = {
                    status: 'complete',
                    inputTXID: tx.hash_in,
                    inputAddress: tx.deposit,
                    inputCurrency: tx.coin_from.toUpperCase(),
                    inputAmount: parseFloat(tx.deposit_amount),
                    outputAddress: tx.withdrawal,
                    outputCurrency: tx.coin_to.toUpperCase(),
                    outputAmount: parseFloat(tx.withdrawal_amount),
                    timestamp: timestamp,
                    isoDate: (new Date(timestamp)).toISOString()
                }
                ssFormatTxs.push(ssTx)
                if (timestamp > newestTimestamp) {
                    newestTimestamp = timestamp
                }
                if (lastCheckedTimestamp > timestamp) {
                    done = true;
                }
            }
        }

        offset += limit
        //this is if the end of the database is reached
        if (txs.length < 100) {
            done = true
        }
    }
    const out: PluginResult = {
        settings: { latestTimeStamp: newestTimestamp },
        transactions: ssFormatTxs
    }
    return out
}
export const godex: PartnerPlugin = {
    // queryFunc will take PluginSettings as arg and return PluginResult
    queryFunc: queryGodex,
    // results in a PluginResult
    pluginName: 'Godex',
    pluginId: 'godex'
}